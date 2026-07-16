const mongoose = require('mongoose');

const OriginalDocumentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    index: true,
    description: 'UUID grouping files uploaded together (multi-image aggregation).'
  },
  fileName: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true,
    unique: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  sequenceIndex: {
    type: Number,
    required: true,
    description: 'Order of the file in the overall bundled document.'
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // Automatically delete the database record after 30 days (30 * 24 * 60 * 60 seconds)
  }
});

// Compound index to quickly query sorted pages for a single document
OriginalDocumentSchema.index({ documentId: 1, sequenceIndex: 1 });

module.exports = mongoose.model('OriginalDocument', OriginalDocumentSchema);
