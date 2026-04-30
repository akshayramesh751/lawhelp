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

        res.json({ text: extractedText });

    } catch (error) {
        console.error('Error during extraction:', error);
        res.status(500).json({ message: 'Error processing document', error: error.message });
    }
};

module.exports = { extractText };
