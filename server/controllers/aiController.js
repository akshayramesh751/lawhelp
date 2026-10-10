const path = require('path');
const Tesseract = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { uploadToS3, downloadFromS3, deleteFromS3 } = require('../utils/s3');
const OriginalDocument = require('../models/OriginalDocument');
const DocumentSummary = require('../models/DocumentSummary');

const serverDir = path.resolve(__dirname, '..');

const extractText = async (req, res) => {
    let documentId = null;
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // ==========================================
        // STEP 1: DURABLE FILE REGISTRY INTAKE
        // ==========================================
        documentId = uuidv4();
        console.log(`[Registry] Ingesting files under Document ID: ${documentId}`);

        const uploadPromises = req.files.map(async (file, index) => {
            // Upload to S3 (or local disk in fallback mode) with server-side encryption
            const s3Key = await uploadToS3(file.buffer, file.originalname, file.mimetype);

            // Save raw file metadata record to MongoDB with Firebase UID
            const originalDoc = new OriginalDocument({
                documentId,
                userId: req.user?.uid || 'anonymous',
                fileName: file.originalname,
                s3Key,
                mimeType: file.mimetype,
                size: file.size,
                sequenceIndex: index,
                status: 'pending' // Initial status is pending
            });

            return await originalDoc.save();
        });

        // Wait for all uploads and database records to resolve
        await Promise.all(uploadPromises);
        console.log(`[Registry] Durably registered ${req.files.length} file(s) for Document ID: ${documentId}`);

        const firstFile = req.files[0];
        const mimeType = firstFile.mimetype;
        let extractedText = '';
        let aiResult = null;

        if (mimeType === 'application/pdf') {
            if (req.files.length > 1) {
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(400).json({ message: 'Please upload only 1 PDF document at a time.' });
            }
            
            const fileBuffer = firstFile.buffer;
            if (!fileBuffer || fileBuffer.length < 100) {
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(400).json({ message: `The uploaded PDF is empty or corrupted (${fileBuffer ? fileBuffer.length : 0} bytes). If the file lives in OneDrive/Google Drive, make sure it is fully downloaded locally, then re-upload.` });
            }

            
            // ==========================================
            // NATIVE-FIRST ROUTING (PDFs -> Python)
            // ==========================================
            try {
                // Send raw file to Python for Native Text Extraction (PyMuPDF)
                const blob = new Blob([fileBuffer], { type: 'application/pdf' });
                const formData = new FormData();
                formData.append('file', blob, firstFile.originalname || 'document.pdf');
                formData.append('source_language', 'auto');

                const aiResponse = await fetch('http://localhost:8000/process-pdf', {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(300000)
                });

                if (aiResponse.status === 422) {
                    // Python detected a scanned PDF (low text density). Fall back to Tesseract OCR using rendered page images!
                    console.log("Python reported Scanned PDF. Converting page images to OCR...");
                    const errorData = await aiResponse.json();
                    const pageImagesBase64 = errorData.detail?.page_images || [];
                    const pageIndices = errorData.detail?.page_indices || pageImagesBase64.map((_, i) => i);
                    const nativePages = errorData.detail?.native_pages || [];
                    const ocrByPage = {};

                    for (let i = 0; i < pageImagesBase64.length; i++) {
                        const imgBuffer = Buffer.from(pageImagesBase64[i], 'base64');
                        const pageNo = pageIndices[i];
                        try {
                            const r = await Tesseract.recognize(imgBuffer, 'eng+kan', { langPath: serverDir });
                            if (r.data?.text?.trim()) ocrByPage[pageNo] = r.data.text.trim();
                        } catch (ocrErr) {
                            console.warn(`[OCR Warning] Page ${pageNo + 1} eng+kan error, retrying eng:`, ocrErr.message);
                            try {
                                const r2 = await Tesseract.recognize(imgBuffer, 'eng', { langPath: serverDir });
                                if (r2.data?.text?.trim()) ocrByPage[pageNo] = r2.data.text.trim();
                            } catch (e2) {
                                console.warn(`[OCR Warning] Page ${pageNo + 1} retry failed:`, e2.message);
                            }
                        }
                    }

                    // Merge: per page, native text + OCR of that page's images (keeps stamp-paper text AND scanned body)
                    const totalPages = Math.max(nativePages.length, ...Object.keys(ocrByPage).map(k => Number(k) + 1), 0);
                    const merged = [];
                    for (let p = 0; p < totalPages; p++) {
                        const parts = [];
                        if (nativePages[p] && nativePages[p].trim()) parts.push(nativePages[p].trim());
                        if (ocrByPage[p]) parts.push(ocrByPage[p]);
                        if (parts.length) merged.push(`--- PAGE ${p + 1} ---\n${parts.join('\n')}`);
                    }
                    extractedText = merged.join('\n\n');
                    if (errorData.detail?.truncated) console.warn('[OCR] Document had more image pages than the OCR cap; remaining pages skipped.');
                    if (!extractedText.trim()) {
                        throw new Error('Unable to extract legible text from scanned document pages.');
                    }
                    
                    // Route the extracted text via Text-First routing
                    aiResult = await sendTextToPython(extractedText);
                } else if (!aiResponse.ok) {
                    const errBody = await aiResponse.text().catch(() => '');
                    console.error(`Python AI Engine error ${aiResponse.status}:`, errBody);
                    await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                    let detail = '';
                    try { const j = JSON.parse(errBody); detail = typeof j.detail === 'string' ? j.detail : (j.detail?.message || ''); } catch (_) {}
                    return res.status(aiResponse.status === 400 ? 400 : 500).json({ message: `Error processing PDF natively${detail ? ': ' + detail : ''}` });
                } else {
                    aiResult = await aiResponse.json();
                }
            } catch (err) {
                console.error("Failed Native PDF processing:", err);
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(500).json({ message: 'AI processing failed natively' });
            }
        } else if (mimeType.startsWith('image/')) {
            // Check if all files are images
            const allImages = req.files.every(f => f.mimetype.startsWith('image/'));
            if (!allImages) {
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(400).json({ message: 'Cannot mix PDFs and images. Please upload up to 5 images OR 1 PDF.' });
            }
            
            // Process scanned images using Tesseract OCR sequentially
            console.log(`Processing ${req.files.length} image(s) sequentially...`);
            const ocrTexts = [];
            for (let i = 0; i < req.files.length; i++) {
                try {
                    const r = await Tesseract.recognize(req.files[i].buffer, 'eng+kan', { langPath: serverDir });
                    if (r.data?.text?.trim()) {
                        ocrTexts.push(`--- PAGE ${i + 1} ---\n${r.data.text.trim()}`);
                    }
                } catch (ocrErr) {
                    console.warn(`[OCR Warning] Image ${i + 1} eng+kan error, retrying eng:`, ocrErr.message);
                    try {
                        const r2 = await Tesseract.recognize(req.files[i].buffer, 'eng', { langPath: serverDir });
                        if (r2.data?.text?.trim()) {
                            ocrTexts.push(`--- PAGE ${i + 1} ---\n${r2.data.text.trim()}`);
                        }
                    } catch (e2) {
                        console.warn(`[OCR Warning] Image ${i + 1} retry failed:`, e2.message);
                    }
                }
            }
            
            // Combine extracted text with page separators
            extractedText = ocrTexts.join('\n\n');
            if (!extractedText.trim()) {
                throw new Error('Unable to extract legible text from uploaded image(s).');
            }
            
            // Route extracted text to Python AI Engine
            aiResult = await sendTextToPython(extractedText);
        } else {
            await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
            return res.status(400).json({ message: 'Unsupported file type. Please upload a PDF or Image(s).' });
        }

        // Update document status in the registry to processed upon success
        await OriginalDocument.updateMany({ documentId }, { status: 'processed' });

        // Retrieve all original documents associated with this bundle
        const originalDocs = await OriginalDocument.find({ documentId }).sort({ sequenceIndex: 1 });

        // Calculate SHA-256 hash of raw OCR text
        const rawText = aiResult.raw_text || extractedText || '';
        const documentHash = crypto.createHash('sha256').update(rawText).digest('hex');
        
        const countKannada = (rawText.match(/[\u0C80-\u0CFF]/g) || []).length;
        const detectedLang = countKannada > 0 ? (countKannada / rawText.length > 0.3 ? 'kn' : 'mixed') : 'en';

        // Extract preamble, parties, and clauses from python result
        const preambleText = aiResult.structure?.preamble || '';
        const partiesList = aiResult.structure?.parties || [];
        const clausesList = aiResult.structure?.clauses || [];
        const primaryLessor = partiesList.find(p => p.role.includes('Lessor') || p.role.includes('Owner') || p.role.includes('Vendor'))?.name || partiesList[0]?.name || 'Executing Party 1';
        const primaryLessee = partiesList.find(p => p.role.includes('Lessee') || p.role.includes('Tenant') || p.role.includes('Purchaser'))?.name || partiesList[1]?.name || 'Executing Party 2';

        // Create and save DocumentSummary record
        const docClassification = aiResult.classification || {
            domain: (function() {
                const fn = (originalDocs[0]?.fileName || '').toLowerCase();
                if (fn.includes('sale') || fn.includes('deed')) return 'Sale Deed';
                if (fn.includes('os') || fn.includes('suit') || fn.includes('court') || fn.includes('plaint')) return 'Court Pleading / Original Suit (OS)';
                if (fn.includes('rent') || fn.includes('lease')) return 'Rental Agreement';
                if (fn.includes('nda')) return 'Non-Disclosure Agreement (NDA)';
                if (fn.includes('service')) return 'Service Level Agreement';
                if (fn.includes('employ') || fn.includes('offer')) return 'Employment Contract';
                return 'Legal Agreement';
            })(),
            confidence: 0.95,
            method: 'Hybrid-Taxonomy'
        };

        const summary = new DocumentSummary({
            originalDocumentId: documentId,
            originalDocuments: originalDocs.map(d => d._id),
            userId: req.user?.uid || 'anonymous',
            documentHash,
            pipelineStatus: 'ANALYZED',
            metadata: {
                fileName: originalDocs[0]?.fileName || 'document',
                mimeType: originalDocs[0]?.mimeType || 'application/pdf',
                detectedLanguage: detectedLang,
                pageCount: originalDocs.length,
                wordCount: rawText.split(/\s+/).filter(Boolean).length
            },
            classification: docClassification,
            textContent: {
                rawOcrText: rawText,
                sanitizedRegionalText: aiResult.sanitized_regional_text || rawText,
                translatedEnglishText: aiResult.translated_text || rawText,
                redactedEnglishText: aiResult.anonymized_text || rawText,
                redactedPiiEntities: aiResult.pii_entities || []
            },
            structure: {
                preamble: preambleText,
                parties: partiesList,
                clauses: clausesList
            },
            summaryOutput: aiResult.summary_output || {},
            riskAnalysis: aiResult.risk_analysis || []
        });

        await summary.save();

        // Respond to frontend with the documentId and structured data included
        res.json({ 
            documentId,
            text: summary.textContent.redactedEnglishText,
            original_length: summary.metadata.wordCount,
            is_anonymized: true,
            classification: docClassification,
            structure: summary.structure,
            summaryOutput: summary.summaryOutput,
            riskAnalysis: summary.riskAnalysis,
            summaryId: summary._id
        });

    } catch (error) {
        console.error('Error during extraction:', error);
        if (documentId) {
            await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
        }
        res.status(500).json({ message: 'Error processing document', error: error.message });
    }
};

/**
 * Helper function to determine domain classification from saved DocumentSummary.
 */
const getClassificationForSummary = (summary) => {
    if (summary.classification && summary.classification.domain && summary.classification.domain !== 'Unknown') {
        return summary.classification;
    }
    const textSnippet = (
        (summary.metadata?.fileName || '') + ' ' +
        (summary.summaryOutput?.executiveSummary || '') + ' ' +
        (summary.structure?.clauses?.map(c => (c.clauseHeader || '') + ' ' + (c.detectedType || '')).join(' ') || '')
    ).toLowerCase();

    let domain = 'Legal Agreement';
    if (textSnippet.includes('sale deed') || textSnippet.includes('deed of sale') || textSnippet.includes('conveyance') || textSnippet.includes('absolute sale')) {
        domain = 'Sale Deed';
    } else if (textSnippet.includes('original suit') || textSnippet.includes('o.s.') || textSnippet.includes('os ') || textSnippet.includes('court') || textSnippet.includes('plaint') || textSnippet.includes('pleading') || textSnippet.includes('petition')) {
        domain = 'Court Pleading / Original Suit (OS)';
    } else if (textSnippet.includes('rent') || textSnippet.includes('lease') || textSnippet.includes('tenan') || textSnippet.includes('landlord') || textSnippet.includes('premise') || textSnippet.includes('lessor') || textSnippet.includes('lessee')) {
        domain = 'Rental Agreement';
    } else if (textSnippet.includes('nda') || textSnippet.includes('non-disclosure') || textSnippet.includes('confidential')) {
        domain = 'Non-Disclosure Agreement (NDA)';
    } else if (textSnippet.includes('service') || textSnippet.includes('contractor') || textSnippet.includes('freelance') || textSnippet.includes('consult')) {
        domain = 'Service Level Agreement';
    } else if (textSnippet.includes('employ') || textSnippet.includes('remuneration') || textSnippet.includes('probation') || textSnippet.includes('offer letter') || textSnippet.includes('employee')) {
        domain = 'Employment Contract';
    } else if (textSnippet.includes('notice') || textSnippet.includes('demand')) {
        domain = 'Legal Notice';
    }

    return {
        domain,
        confidence: 0.95,
        method: 'Hybrid-Taxonomy'
    };
};

/**
 * Helper function to send OCR-extracted text to Python AI Engine for processing
 */
async function sendTextToPython(text) {
    try {
        const response = await fetch('http://localhost:8000/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                state: null,
                country: 'India'
            }),
            signal: AbortSignal.timeout(300000)
        });

        if (!response.ok) {
            throw new Error(`Python AI Engine failed with status ${response.statusText}`);
        }

        return await response.json();
    } catch (err) {
        console.error("sendTextToPython error:", err);
        return { text, error: 'AI processing failed' };
    }
};

/**
 * Retrieve document status and summary details for a given documentId.
 */
const getDocumentSummary = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Check if DocumentSummary exists for this documentId and userId
        const summary = await DocumentSummary.findOne({ originalDocumentId: documentId, userId });
        if (summary) {
            return res.json({
                status: 'processed',
                documentId,
                rawExtractedText: summary.textContent.rawOcrText,
                translatedText: summary.textContent.translatedEnglishText,
                anonymizedText: summary.textContent.redactedEnglishText,
                fileName: summary.metadata?.fileName || 'Document',
                classification: getClassificationForSummary(summary),
                structure: summary.structure,
                summaryOutput: summary.summaryOutput,
                riskAnalysis: summary.riskAnalysis,
                summaryId: summary._id
            });
        }

        // 2. If no summary, check if OriginalDocument metadata exists to determine status
        const originalDocs = await OriginalDocument.find({ documentId, userId });
        if (!originalDocs || originalDocs.length === 0) {
            return res.status(404).json({ error: 'Document bundle not found or access denied.' });
        }

        const statuses = originalDocs.map(doc => doc.status);
        let currentStatus = 'pending';
        if (statuses.includes('failed')) {
            currentStatus = 'failed';
        } else if (statuses.every(s => s === 'processed')) {
            currentStatus = 'processed';
        }

        res.json({
            status: currentStatus,
            documentId,
            fileCount: originalDocs.length,
            files: originalDocs.map(doc => ({
                fileName: doc.fileName,
                status: doc.status,
                sequenceIndex: doc.sequenceIndex
            }))
        });
    } catch (error) {
        console.error('Error in getDocumentSummary:', error);
        res.status(500).json({ error: 'Failed to retrieve document summary.', details: error.message });
    }
};

/**
 * Reprocess an existing failed/interrupted document upload using saved metadata and S3 files.
 */
const reprocessDocument = async (req, res) => {
    let documentId = null;
    try {
        documentId = req.params.documentId;
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const docs = await OriginalDocument.find({ documentId, userId }).sort({ sequenceIndex: 1 });
        if (!docs || docs.length === 0) {
            return res.status(404).json({ error: 'Document metadata not found or access denied.' });
        }

        console.log(`[Reprocessing] Restarting pipeline for Document ID: ${documentId} (${docs.length} pages)`);
        await OriginalDocument.updateMany({ documentId }, { status: 'pending' });

        // Download buffers
        const fileBuffers = await Promise.all(
            docs.map(async (doc) => {
                const buffer = await downloadFromS3(doc.s3Key);
                return {
                    buffer,
                    originalname: doc.fileName,
                    mimetype: doc.mimeType
                };
            })
        );

        const firstFile = fileBuffers[0];
        const mimeType = firstFile.mimetype;
        let extractedText = '';
        let aiResult = null;

        if (mimeType === 'application/pdf') {
            const fileBuffer = firstFile.buffer;
            try {
                const blob = new Blob([fileBuffer], { type: 'application/pdf' });
                const formData = new FormData();
                formData.append('file', blob, firstFile.originalname || 'document.pdf');
                formData.append('source_language', 'auto');

                const aiResponse = await fetch('http://localhost:8000/process-pdf', {
                    method: 'POST',
                    body: formData
                });

                if (aiResponse.status === 422) {
                    console.log("[Reprocessing] Scanned PDF. Converting page images to OCR...");
                    const errorData = await aiResponse.json();
                    const pageImagesBase64 = errorData.detail?.page_images || [];

                    if (pageImagesBase64.length > 0) {
                        const ocrTexts = [];
                        for (let i = 0; i < pageImagesBase64.length; i++) {
                            const imgBuffer = Buffer.from(pageImagesBase64[i], 'base64');
                            try {
                                const r = await Tesseract.recognize(imgBuffer, 'eng+kan', {
                                    langPath: serverDir
                                });
                                if (r.data?.text?.trim()) {
                                    ocrTexts.push(`--- PAGE ${i + 1} ---\n${r.data.text.trim()}`);
                                }
                            } catch (ocrErr) {
                                console.warn(`[Reprocessing OCR Warning] Page ${i + 1} eng+kan error, retrying eng:`, ocrErr.message);
                                try {
                                    const r2 = await Tesseract.recognize(imgBuffer, 'eng', { langPath: serverDir });
                                    if (r2.data?.text?.trim()) {
                                        ocrTexts.push(`--- PAGE ${i + 1} ---\n${r2.data.text.trim()}`);
                                    }
                                } catch (e2) {
                                    console.warn(`[Reprocessing OCR Warning] Page ${i + 1} retry failed:`, e2.message);
                                }
                            }
                        }
                        extractedText = ocrTexts.join('\n\n');
                    } else {
                        throw new Error('Scanned PDF detected but no page images were generated for OCR.');
                    }

                    if (!extractedText.trim()) {
                        throw new Error('Unable to extract legible text from scanned document pages.');
                    }

                    aiResult = await sendTextToPython(extractedText);
                } else if (!aiResponse.ok) {
                    console.error('[Reprocessing] Python error:', aiResponse.statusText);
                    await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                    return res.status(500).json({ message: 'Error reprocessing PDF natively' });
                } else {
                    aiResult = await aiResponse.json();
                }
            } catch (err) {
                console.error("[Reprocessing] Native PDF extraction failed:", err);
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(500).json({ message: 'AI reprocessing failed natively' });
            }
        } else if (mimeType.startsWith('image/')) {
            console.log(`[Reprocessing] Running OCR sequentially on ${fileBuffers.length} images...`);
            const ocrTexts = [];
            for (let i = 0; i < fileBuffers.length; i++) {
                try {
                    const r = await Tesseract.recognize(fileBuffers[i].buffer, 'eng+kan', { langPath: serverDir });
                    if (r.data?.text?.trim()) {
                        ocrTexts.push(`--- PAGE ${i + 1} ---\n${r.data.text.trim()}`);
                    }
                } catch (ocrErr) {
                    console.warn(`[Reprocessing OCR Warning] Image ${i + 1} eng+kan error, retrying eng:`, ocrErr.message);
                    try {
                        const r2 = await Tesseract.recognize(fileBuffers[i].buffer, 'eng', { langPath: serverDir });
                        if (r2.data?.text?.trim()) {
                            ocrTexts.push(`--- PAGE ${i + 1} ---\n${r2.data.text.trim()}`);
                        }
                    } catch (e2) {
                        console.warn(`[Reprocessing OCR Warning] Image ${i + 1} retry failed:`, e2.message);
                    }
                }
            }
            
            extractedText = ocrTexts.join('\n\n');
            if (!extractedText.trim()) {
                throw new Error('Unable to extract legible text from images.');
            }
            aiResult = await sendTextToPython(extractedText);
        } else {
            await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
            return res.status(400).json({ message: 'Unsupported file type.' });
        }

        await OriginalDocument.updateMany({ documentId }, { status: 'processed' });

        const rawText = aiResult.raw_text || extractedText || '';
        const documentHash = crypto.createHash('sha256').update(rawText).digest('hex');
        
        const countKannada = (rawText.match(/[\u0C80-\u0CFF]/g) || []).length;
        const detectedLang = countKannada > 0 ? (countKannada / rawText.length > 0.3 ? 'kn' : 'mixed') : 'en';

        const preambleText = aiResult.structure?.preamble || '';
        const partiesList = aiResult.structure?.parties || [];
        const clausesList = aiResult.structure?.clauses || [];

        // Upsert DocumentSummary
        const updatedSummary = await DocumentSummary.findOneAndUpdate(
            { originalDocumentId: documentId, userId },
            {
                originalDocumentId: documentId,
                originalDocuments: docs.map(d => d._id),
                userId,
                documentHash,
                pipelineStatus: 'ANALYZED',
                metadata: {
                    fileName: docs[0]?.fileName || 'document',
                    mimeType: docs[0]?.mimeType || 'application/pdf',
                    detectedLanguage: detectedLang,
                    pageCount: docs.length,
                    wordCount: rawText.split(/\s+/).filter(Boolean).length
                },
                textContent: {
                    rawOcrText: rawText,
                    sanitizedRegionalText: aiResult.sanitized_regional_text || rawText,
                    translatedEnglishText: aiResult.translated_text || rawText,
                    redactedEnglishText: aiResult.anonymized_text || rawText,
                    redactedPiiEntities: aiResult.pii_entities || []
                },
                structure: {
                    preamble: preambleText,
                    parties: partiesList,
                    clauses: clausesList
                },
                summaryOutput: aiResult.summary_output || {},
                riskAnalysis: aiResult.risk_analysis || []
            },
            { new: true, upsert: true }
        );

        res.json({
            message: 'Reprocessed and cataloged successfully.',
            documentId,
            text: updatedSummary.textContent.redactedEnglishText,
            classification: aiResult.classification || {
                domain: docs[0]?.mimeType.includes('pdf') ? 'Legal Agreement' : 'Unknown',
                confidence: 0.9,
                method: 'Tier1_ExactMatch'
            },
            structure: updatedSummary.structure,
            summaryOutput: updatedSummary.summaryOutput,
            riskAnalysis: updatedSummary.riskAnalysis,
            summaryId: updatedSummary._id
        });

    } catch (error) {
        console.error('[Reprocessing] Error:', error);
        await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
        res.status(500).json({ error: 'Failed to reprocess document.', details: error.message });
    }
};

/**
 * Interactive Q&A chat with an analyzed legal document.
 */
const chatWithDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { query, messages } = req.body;
        const userId = req.user?.uid;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Query is required.' });
        }

        const summary = await DocumentSummary.findOne({ originalDocumentId: documentId, userId });
        if (!summary) {
            return res.status(404).json({ error: 'Analyzed document summary not found for this user.' });
        }

        const docContext = {
            textContent: summary.textContent,
            structure: summary.structure,
            summaryOutput: summary.summaryOutput,
            riskAnalysis: summary.riskAnalysis
        };

        const domain = summary.structure?.clauses?.[0]?.detectedType || 'Legal Document';
        const state = summary.structure?.clauses?.[0]?.jurisdiction?.state || null;

        const chatResponse = await fetch('http://localhost:8000/chat-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                doc_context: docContext,
                messages: messages || [{ role: 'user', content: query }],
                domain,
                state,
                country: 'India'
            }),
            signal: AbortSignal.timeout(120000)
        });

        const chatData = await chatResponse.json();
        return res.json(chatData);

    } catch (error) {
        console.error('[Document Chat] Error:', error);
        return res.status(500).json({ error: 'Failed to process document chat query.', details: error.message });
    }
};

/**
 * Retrieve all analyzed documents belonging to the authenticated user.
 */
const getUserDocuments = async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const summaries = await DocumentSummary.find({ userId })
            .sort({ createdAt: -1 })
            .select('originalDocumentId metadata classification structure.clauses summaryOutput.executiveSummary riskAnalysis createdAt updatedAt');

        const documents = summaries.map(s => {
            const highRiskCount = (s.riskAnalysis || []).filter(r => r.riskLevel === 'HIGH_RISK' || r.riskLevel === 'POTENTIALLY_UNENFORCEABLE').length;
            const oneSidedCount = (s.riskAnalysis || []).filter(r => r.riskLevel === 'ONE_SIDED').length;
            const requiresReviewCount = (s.riskAnalysis || []).filter(r => r.riskLevel === 'REQUIRES_REVIEW').length;
            const detectedDomain = getClassificationForSummary(s).domain;

            return {
                documentId: s.originalDocumentId,
                fileName: s.metadata?.fileName || 'Document',
                mimeType: s.metadata?.mimeType || 'application/pdf',
                domain: detectedDomain,
                wordCount: s.metadata?.wordCount || 0,
                pageCount: s.metadata?.pageCount || 1,
                executiveSummarySnippet: s.summaryOutput?.executiveSummary?.substring(0, 150) || '',
                riskStats: {
                    highRisk: highRiskCount,
                    oneSided: oneSidedCount,
                    requiresReview: requiresReviewCount,
                    totalClauses: (s.riskAnalysis || []).length
                },
                createdAt: s.createdAt || s._id.getTimestamp()
            };
        });

        return res.json({ documents });
    } catch (error) {
        console.error('[Get User Documents] Error:', error);
        return res.status(500).json({ error: 'Failed to retrieve user documents.', details: error.message });
    }
};

/**
 * Retrieve the most recent analyzed document for the authenticated user.
 */
const getLatestDocumentSummary = async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const summary = await DocumentSummary.findOne({ userId }).sort({ createdAt: -1 });
        if (!summary) {
            return res.status(404).json({ message: 'No analyzed documents found for this user.' });
        }

        return res.json({
            status: 'processed',
            documentId: summary.originalDocumentId,
            text: summary.textContent.redactedEnglishText || summary.textContent.translatedEnglishText || summary.textContent.rawOcrText,
            rawExtractedText: summary.textContent.rawOcrText,
            translatedText: summary.textContent.translatedEnglishText,
            anonymizedText: summary.textContent.redactedEnglishText,
            is_anonymized: true,
            classification: getClassificationForSummary(summary),
            structure: summary.structure,
            summaryOutput: summary.summaryOutput,
            riskAnalysis: summary.riskAnalysis,
            summaryId: summary._id,
            fileName: summary.metadata?.fileName || 'Document',
            createdAt: summary.createdAt || summary._id.getTimestamp()
        });
    } catch (error) {
        console.error('[Get Latest Summary] Error:', error);
        return res.status(500).json({ error: 'Failed to retrieve latest document summary.', details: error.message });
    }
};

/**
 * Delete an analyzed document and its associated records for the authenticated user.
 */
const deleteUserDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const originalDocs = await OriginalDocument.find({ documentId, userId });
        if (originalDocs && originalDocs.length > 0) {
            await Promise.all(
                originalDocs.map(doc => {
                    if (doc.s3Key) {
                        return deleteFromS3(doc.s3Key).catch(err => {
                            console.warn(`[S3 Delete Warning] Could not delete S3 key ${doc.s3Key}:`, err);
                        });
                    }
                })
            );
        }

        await DocumentSummary.deleteMany({ originalDocumentId: documentId, userId });
        await OriginalDocument.deleteMany({ documentId, userId });

        return res.json({ message: 'Document and analysis deleted successfully.', documentId });
    } catch (error) {
        console.error('[Delete Document] Error:', error);
        return res.status(500).json({ error: 'Failed to delete document.', details: error.message });
    }
};

module.exports = {
    extractText,
    getDocumentSummary,
    getUserDocuments,
    getLatestDocumentSummary,
    deleteUserDocument,
    reprocessDocument,
    chatWithDocument
};
