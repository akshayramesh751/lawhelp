const Tesseract = require('tesseract.js');

const extractText = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const fileBuffer = req.file.buffer;
        const mimeType = req.file.mimetype;
        let extractedText = '';

        if (mimeType === 'application/pdf') {
            // ==========================================
            // NATIVE-FIRST ROUTING (PDFs -> Python)
            // ==========================================
            try {
                // Send raw file to Python for Native Text Extraction (PyMuPDF)
                // Create a native Blob from the buffer
                const blob = new Blob([fileBuffer], { type: 'application/pdf' });
                const formData = new FormData();
                formData.append('file', blob, req.file.originalname || 'document.pdf');
                formData.append('source_language', 'auto');

                // Let native fetch automatically set the Content-Type boundary header
                const aiResponse = await fetch('http://localhost:8000/process-pdf', {
                    method: 'POST',
                    body: formData
                });

                if (aiResponse.status === 422) {
                    // Python detected a scanned PDF (low text density).
                    // We must fallback to Tesseract OCR!
                    console.log("Python reported Scanned PDF. Falling back to OCR...");
                    const result = await Tesseract.recognize(fileBuffer, 'eng');
                    extractedText = result.data.text;
                    // Proceed to send extractedText to /process-document below
                } else if (!aiResponse.ok) {
                    console.error('Python AI Engine error:', aiResponse.statusText);
                    return res.status(500).json({ message: 'Error processing PDF natively' });
                } else {
                    // Success! Native extraction and NLP completed entirely in Python.
                    const aiData = await aiResponse.json();
                    return res.json({ 
                        text: aiData.translated_text,
                        original_length: aiData.original_length,
                        is_anonymized: true,
                        classification: aiData.classification
                    });
                }
            } catch (err) {
                console.error("Failed Native PDF processing:", err);
                return res.status(500).json({ message: 'AI processing failed natively' });
            }
        } else if (mimeType.startsWith('image/')) {
            // Process scanned image using Tesseract OCR
            const result = await Tesseract.recognize(fileBuffer, 'eng');
            extractedText = result.data.text;
        } else {
            return res.status(400).json({ message: 'Unsupported file type. Please upload a PDF or an Image.' });
        }

        // ==========================================
        // TEXT-FIRST ROUTING (Images/Scanned PDFs -> Python)
        // ==========================================
        // If we reach here, it means we performed OCR (either because it was an image, or fallback from a scanned PDF).
        try {
            const aiResponse = await fetch('http://localhost:8000/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: extractedText,
                    source_language: "auto" 
                })
            });

            if (!aiResponse.ok) {
                console.error('Python AI Engine error:', aiResponse.statusText);
                return res.json({ text: extractedText });
            }

            const aiData = await aiResponse.json();
            res.json({ 
                text: aiData.translated_text, 
                original_length: aiData.original_length,
                is_anonymized: true,
                classification: aiData.classification
            });
            
        } catch (aiError) {
            console.error('Failed to connect to Python AI Engine. Ensure it is running on port 8000.', aiError);
            res.json({ text: extractedText, error: 'AI processing failed' });
        }
    } catch (error) {
        console.error('Error during extraction:', error);
        res.status(500).json({ message: 'Error processing document', error: error.message });
    }
};

module.exports = { extractText };
