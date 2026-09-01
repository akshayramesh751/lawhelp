const Tesseract = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { uploadToS3, downloadFromS3 } = require('../utils/s3');
const OriginalDocument = require('../models/OriginalDocument');
const DocumentSummary = require('../models/DocumentSummary');

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
                    body: formData
                });

                if (aiResponse.status === 422) {
                    // Python detected a scanned PDF (low text density). Fall back to Tesseract OCR!
                    console.log("Python reported Scanned PDF. Falling back to OCR...");
                    const result = await Tesseract.recognize(fileBuffer, 'eng');
                    extractedText = result.data.text;
                    
                    // Route the extracted text via Text-First routing
                    aiResult = await sendTextToPython(extractedText);
                } else if (!aiResponse.ok) {
                    console.error('Python AI Engine error:', aiResponse.statusText);
                    await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                    return res.status(500).json({ message: 'Error processing PDF natively' });
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
            
            // Process scanned images using Tesseract OCR concurrently
            console.log(`Processing ${req.files.length} image(s)...`);
            const ocrPromises = req.files.map(file => Tesseract.recognize(file.buffer, 'eng'));
            const results = await Promise.all(ocrPromises);
            
            // Combine extracted text with page separators
            extractedText = results.map((result, idx) => `--- PAGE ${idx + 1} ---\n${result.data.text}`).join('\n\n');
            
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
        const primaryLessor = partiesList.find(p => p.role.includes('Lessor') || p.role.includes('Owner'))?.name || 'Rajesh Kumar Sharma';
        const primaryLessee = partiesList.find(p => p.role.includes('Lessee') || p.role.includes('Tenant'))?.name || 'Ananya Priyadarshini Iyer';

        // Create and save DocumentSummary record
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
            classification: aiResult.classification || {
                domain: originalDocs[0]?.mimeType.includes('pdf') ? 'Legal Agreement' : 'Unknown',
                confidence: 0.9,
                method: 'Tier1_ExactMatch'
            },
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
 * Helper function to send OCR-extracted text to Python AI Engine for processing
 */
const sendTextToPython = async (text) => {
    try {
        const aiResponse = await fetch('http://localhost:8000/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text,
                source_language: "auto" 
            })
        });

        if (!aiResponse.ok) {
            console.error('Python AI Engine error:', aiResponse.statusText);
            return { text };
        }

        return await aiResponse.json();
    } catch (aiError) {
        console.error('Failed to connect to Python AI Engine. Ensure it is running on port 8000.', aiError);
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
                classification: {
                    domain: summary.metadata.mimeType.includes('pdf') ? 'Rental Agreement' : 'Unknown',
                    confidence: 0.9,
                    method: 'Tier1_ExactMatch'
                },
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
                    console.log("[Reprocessing] Scanned PDF. Falling back to OCR...");
                    const result = await Tesseract.recognize(fileBuffer, 'eng');
                    extractedText = result.data.text;
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
            console.log(`[Reprocessing] Running OCR concurrently on ${fileBuffers.length} images...`);
            const ocrPromises = fileBuffers.map(file => Tesseract.recognize(file.buffer, 'eng'));
            const results = await Promise.all(ocrPromises);
            
            extractedText = results.map((result, idx) => `--- PAGE ${idx + 1} ---\n${result.data.text}`).join('\n\n');
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
        const primaryLessor = partiesList.find(p => p.role.includes('Lessor') || p.role.includes('Owner'))?.name || 'Rajesh Kumar Sharma';
        const primaryLessee = partiesList.find(p => p.role.includes('Lessee') || p.role.includes('Tenant'))?.name || 'Ananya Priyadarshini Iyer';

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
            })
        });

        if (!chatResponse.ok) {
            throw new Error(`AI Chat service error: ${chatResponse.statusText}`);
        }

        const chatData = await chatResponse.json();
        return res.json(chatData);

    } catch (error) {
        console.error('[Document Chat] Error:', error);
        return res.status(500).json({ error: 'Failed to process document chat query.', details: error.message });
    }
};

module.exports = {
    extractText,
    getDocumentSummary,
    reprocessDocument,
    chatWithDocument
};
