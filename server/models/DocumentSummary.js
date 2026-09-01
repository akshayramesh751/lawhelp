const mongoose = require('mongoose');

const DocumentSummarySchema = new mongoose.Schema({
  originalDocumentId: {
    type: String,
    required: true,
    index: true,
    description: 'Foreign key referencing OriginalDocument.documentId (aggregate UUID).'
  },
  originalDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OriginalDocument',
    description: 'References to individual OriginalDocument page object IDs.'
  }],
  userId: {
    type: String,
    required: true,
    index: true,
    description: 'Firebase UID of the user who owns this document.'
  },
  documentHash: {
    type: String,
    required: true,
    description: 'SHA-256 hash of the raw document OCR text for data integrity.'
  },
  pipelineStatus: {
    type: String,
    enum: ['INGESTED', 'PREPROCESSED', 'SEGMENTED', 'ANALYZED', 'FAILED'],
    default: 'INGESTED'
  },
  metadata: {
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    detectedLanguage: { type: String, enum: ['en', 'kn', 'mixed'], required: true },
    pageCount: { type: Number, required: true },
    wordCount: { type: Number, required: true }
  },
  textContent: {
    rawOcrText: { type: String, required: true },
    sanitizedRegionalText: { type: String },
    translatedEnglishText: { type: String, required: true },
    redactedEnglishText: { type: String, required: true },
    redactedPiiEntities: [{
      entityType: { type: String },
      maskedValue: { type: String },
      startIndex: { type: Number },
      endIndex: { type: Number }
    }]
  },
  structure: {
    preamble: { type: String },
    parties: [{
      name: { type: String },
      role: { type: String },
      address: { type: String }
    }],
    clauses: [{
      clauseIndex: { type: Number },
      clauseHeader: { type: String },
      rawText: { type: String },
      sanitizedText: { type: String },
      detectedType: { type: String },
      jurisdiction: {
        country: { type: String, default: 'India' },
        state: { type: String, default: null },
        governingLawClausePresent: { type: Boolean, default: false }
      }
    }]
  },
  summaryOutput: {
    executiveSummary: { type: String },
    rights: [{ type: String }],
    obligations: [{ type: String }],
    financialTerms: [{
      description: { type: String },
      amount: { type: String },
      deadline: { type: String }
    }],
    terminationConditions: [{ type: String }],
    deadlinesAndMilestones: [{ type: String }],
    governingLaw: { type: String }
  },
  riskAnalysis: [{
    clauseIndex: { type: Number },
    clauseType: { type: String },
    riskLevel: {
      type: String,
      enum: ['HIGH_RISK', 'POTENTIALLY_UNENFORCEABLE', 'REQUIRES_REVIEW', 'ONE_SIDED', 'NO_ISSUE_DETECTED']
    },
    finding: { type: String },
    statutoryConflict: {
      actName: { type: String },
      section: { type: String },
      ruleNumber: { type: String },
      precedentCitation: { type: String },
      authorityLevel: {
        type: String,
        enum: ['STATUTE', 'STATE_RULE', 'NOTIFICATION', 'HIGH_COURT', 'SUPREME_COURT', 'N/A', 'NONE'],
        default: 'N/A'
      }
    },
    deterministicRuleTriggered: { type: Boolean, default: false },
    reasoning: { type: String },
    confidenceScore: { type: Number, default: 1.0 },
    humanReviewRequired: { type: Boolean, default: false }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // Automatically delete database record after 30 days (DPDP compliance)
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

DocumentSummarySchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('DocumentSummary', DocumentSummarySchema);
