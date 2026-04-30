const { PDFParse } = require('pdf-parse');
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
            // Process digital PDF using pdf-parse class API
            const parser = new PDFParse({ data: fileBuffer });
            const pdfData = await parser.getText();
            extractedText = pdfData.text;
        } else if (mimeType.startsWith('image/')) {
            // Process scanned image using Tesseract OCR
            const result = await Tesseract.recognize(fileBuffer, 'eng');
            extractedText = result.data.text;
        } else {
            return res.status(400).json({ message: 'Unsupported file type. Please upload a PDF or an Image.' });
        }

        // Send to Python AI Microservice for NLP and Anonymization
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
                // Fallback to sending raw text if Python is down
                return res.json({ text: extractedText });
            }

            const aiData = await aiResponse.json();
            
            // Return the safe, anonymized text to the frontend
            res.json({ 
                text: aiData.translated_text, // or anonymized_text depending on frontend needs
                original_length: aiData.original_length,
                is_anonymized: true
            });
            
        } catch (aiError) {
            console.error('Failed to connect to Python AI Engine. Ensure it is running on port 8000.', aiError);
            // Fallback to raw text
            res.json({ text: extractedText, error: 'AI processing failed' });
        }
    } catch (error) {
        console.error('Error during extraction:', error);
        res.status(500).json({ message: 'Error processing document', error: error.message });
    }
};

module.exports = { extractText };
