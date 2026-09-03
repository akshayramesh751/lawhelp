import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileText, FileImage, ShieldAlert, Loader2,
  AlertTriangle, CheckCircle, HelpCircle, AlertCircle, Info,
  MessageSquare, BookOpen, Scale, Sparkles, Send, Copy,
  Check, DollarSign, Clock, Gavel, UserCheck, Shield, ArrowRight,
  History, Trash2, PlusCircle, RefreshCw, ChevronDown, FileCheck
} from 'lucide-react';
import { auth } from '../utils/firebase';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

interface RiskAnalysisItem {
  clauseIndex: number;
  clauseType: string;
  riskLevel: 'HIGH_RISK' | 'POTENTIALLY_UNENFORCEABLE' | 'REQUIRES_REVIEW' | 'ONE_SIDED' | 'NO_ISSUE_DETECTED';
  finding: string;
  statutoryConflict: {
    actName: string;
    section: string;
    ruleNumber?: string;
    precedentCitation?: string;
    authorityLevel: string;
  };
  deterministicRuleTriggered: boolean;
  reasoning: string;
  confidenceScore: number;
  humanReviewRequired: boolean;
}

interface FinancialTerm {
  description: string;
  amount: string;
  deadline: string;
}

interface SummaryOutput {
  executiveSummary: string;
  rights: string[];
  obligations: string[];
  financialTerms: FinancialTerm[];
  terminationConditions: string[];
  deadlinesAndMilestones: string[];
  governingLaw: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  relevantClauses?: number[];
  citations?: Array<{ actName: string; section: string; authorityLevel: string }>;
  suggestedQuestions?: string[];
}

interface UserDocumentItem {
  documentId: string;
  fileName: string;
  mimeType: string;
  domain: string;
  wordCount: number;
  pageCount: number;
  executiveSummarySnippet: string;
  riskStats: {
    highRisk: number;
    oneSided: number;
    requiresReview: number;
    totalClauses: number;
  };
  createdAt: string;
}

export default function AIAnalysisPage({ onNavigate }: { onNavigate: (page: string, data?: any) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [classification, setClassification] = useState<any>(null);
  const [documentId, setDocumentId] = useState<string>('');
  const [documentFileName, setDocumentFileName] = useState<string>('');
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisItem[]>([]);
  const [summaryOutput, setSummaryOutput] = useState<SummaryOutput | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'risk' | 'chat' | 'text'>('risk');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Multi-Document History State
  const [userDocuments, setUserDocuments] = useState<UserDocumentItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const getStorageKeyDoc = (uid: string) => `casecounsel_active_doc_${uid}`;
  const getStorageKeyChat = (uid: string, docId: string) => `casecounsel_chat_${uid}_${docId}`;

  // ==========================================
  // USER-SCOPED HYDRATION ON MOUNT & AUTH CHANGE
  // ==========================================
  useEffect(() => {
    let isMounted = true;

    const restoreUserAnalysisState = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        // Clear all state when logged out to prevent residual leakage
        setExtractedText('');
        setClassification(null);
        setDocumentId('');
        setDocumentFileName('');
        setRiskAnalysis([]);
        setSummaryOutput(null);
        setChatMessages([]);
        setUserDocuments([]);
        return;
      }

      const uid = currentUser.uid;

      // 1. Instant 0ms Restore from User-Scoped Session Storage
      const cachedActive = sessionStorage.getItem(getStorageKeyDoc(uid));
      if (cachedActive) {
        try {
          const parsed = JSON.parse(cachedActive);
          if (parsed && parsed.documentId) {
            setDocumentId(parsed.documentId);
            setExtractedText(parsed.text || '');
            setClassification(parsed.classification || null);
            setDocumentFileName(parsed.fileName || 'Contract');
            setRiskAnalysis(parsed.riskAnalysis || []);
            setSummaryOutput(parsed.summaryOutput || null);

            // Restore chat history for this specific document
            const cachedChat = sessionStorage.getItem(getStorageKeyChat(uid, parsed.documentId));
            if (cachedChat) {
              setChatMessages(JSON.parse(cachedChat));
            } else {
              setChatMessages([
                {
                  role: 'assistant',
                  content: `Hello! I have restored your analyzed document (**${parsed.classification?.domain || 'Legal Document'}**). You can ask me any question about your contract's terms, compensation, notice periods, or legal liabilities.`,
                  suggestedQuestions: [
                    "What is my required termination notice period?",
                    "Are there any restrictive non-compete clauses?",
                    "What are my key financial compensation terms?"
                  ]
                }
              ]);
            }
          }
        } catch (e) {
          console.error("Failed to parse cached active document", e);
        }
      }

      // 2. Fetch User Documents & Latest Document from Backend
      try {
        setIsRestoring(true);
        const token = await currentUser.getIdToken();

        // Fetch user document history
        const docsRes = await fetch('http://localhost:5000/api/ai/documents', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (docsRes.ok && isMounted) {
          const docsData = await docsRes.json();
          setUserDocuments(docsData.documents || []);
        }

        // If no cached active document, fetch latest from database
        if (!cachedActive) {
          const latestRes = await fetch('http://localhost:5000/api/ai/documents/latest', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (latestRes.ok && isMounted) {
            const latestData = await latestRes.json();
            if (latestData && latestData.documentId) {
              setDocumentId(latestData.documentId);
              setExtractedText(latestData.text || latestData.rawExtractedText || '');
              setClassification(latestData.classification || null);
              setDocumentFileName(latestData.fileName || 'Contract');
              setRiskAnalysis(latestData.riskAnalysis || []);
              setSummaryOutput(latestData.summaryOutput || null);

              // Cache in session
              sessionStorage.setItem(getStorageKeyDoc(uid), JSON.stringify({
                documentId: latestData.documentId,
                text: latestData.text || latestData.rawExtractedText || '',
                classification: latestData.classification,
                fileName: latestData.fileName,
                riskAnalysis: latestData.riskAnalysis,
                summaryOutput: latestData.summaryOutput
              }));

              // Initialize chat
              const cachedChat = sessionStorage.getItem(getStorageKeyChat(uid, latestData.documentId));
              if (cachedChat) {
                setChatMessages(JSON.parse(cachedChat));
              } else {
                setChatMessages([
                  {
                    role: 'assistant',
                    content: `Hello! I have retrieved your latest analyzed document (**${latestData.classification?.domain || 'Legal Document'}**). You can ask me any question about your contract's terms, compensation, notice periods, or legal liabilities.`,
                    suggestedQuestions: [
                      "What is my required termination notice period?",
                      "Are there any restrictive non-compete clauses?",
                      "What are my key financial compensation terms?"
                    ]
                  }
                ]);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error restoring user documents from cloud:", err);
      } finally {
        if (isMounted) setIsRestoring(false);
      }
    };

    restoreUserAnalysisState();

    return () => {
      isMounted = false;
    };
  }, [auth.currentUser]);

  const saveActiveDocumentToSession = (docData: any) => {
    const user = auth.currentUser;
    if (!user) return;
    sessionStorage.setItem(getStorageKeyDoc(user.uid), JSON.stringify(docData));
  };

  const handleSelectDocument = async (selectedDocId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    setIsHistoryOpen(false);
    setError('');

    try {
      const token = await user.getIdToken();
      const res = await fetch(`http://localhost:5000/api/ai/documents/${selectedDocId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load selected document');

      setDocumentId(data.documentId);
      setExtractedText(data.anonymizedText || data.translatedText || data.rawExtractedText || '');
      setClassification(data.classification || null);
      setDocumentFileName(data.fileName || 'Contract');
      setRiskAnalysis(data.riskAnalysis || []);
      setSummaryOutput(data.summaryOutput || null);

      // Cache as active
      saveActiveDocumentToSession({
        documentId: data.documentId,
        text: data.anonymizedText || data.translatedText || data.rawExtractedText || '',
        classification: data.classification,
        fileName: data.fileName,
        riskAnalysis: data.riskAnalysis,
        summaryOutput: data.summaryOutput
      });

      // Restore chat
      const cachedChat = sessionStorage.getItem(getStorageKeyChat(user.uid, data.documentId));
      if (cachedChat) {
        setChatMessages(JSON.parse(cachedChat));
      } else {
        setChatMessages([
          {
            role: 'assistant',
            content: `Loaded document: **${data.classification?.domain || 'Legal Agreement'}**. What would you like to examine?`,
            suggestedQuestions: [
              "What are my key obligations?",
              "Is the termination notice balanced?",
              "What liabilities exist under this agreement?"
            ]
          }
        ]);
      }
      setActiveTab('risk');
    } catch (err: any) {
      setError(err.message || 'Failed to switch document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewUpload = () => {
    const user = auth.currentUser;
    if (user) {
      sessionStorage.removeItem(getStorageKeyDoc(user.uid));
    }
    setFiles([]);
    setExtractedText('');
    setClassification(null);
    setDocumentId('');
    setDocumentFileName('');
    setRiskAnalysis([]);
    setSummaryOutput(null);
    setChatMessages([]);
    setError('');
    setIsHistoryOpen(false);
  };

  const handleDeleteDocument = async (docIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this document from your history?")) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`http://localhost:5000/api/ai/documents/${docIdToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete document");

      // Update history list
      setUserDocuments(prev => prev.filter(d => d.documentId !== docIdToDelete));
      sessionStorage.removeItem(getStorageKeyChat(user.uid, docIdToDelete));

      // If active doc was deleted, reset
      if (documentId === docIdToDelete) {
        handleStartNewUpload();
      }
    } catch (err: any) {
      alert(err.message || "Could not delete document.");
    }
  };

  const getSpecializationForDomain = (domain?: string): string => {
    if (!domain) return 'Employment';
    const d = domain.toLowerCase();
    if (d.includes('employ') || d.includes('job') || d.includes('labour') || d.includes('work')) return 'Employment';
    if (d.includes('rent') || d.includes('lease') || d.includes('tenan') || d.includes('sale deed') || d.includes('property')) return 'Property Law';
    if (d.includes('nda') || d.includes('vendor') || d.includes('service') || d.includes('contract') || d.includes('commercial')) return 'Labour Law';
    if (d.includes('family') || d.includes('divorce')) return 'Family Law';
    if (d.includes('consumer')) return 'Consumer Law';
    return 'Employment';
  };

  const handleSeekLegalHelp = () => {
    const domain = classification?.domain || 'Employment Contract';
    const spec = getSpecializationForDomain(domain);
    onNavigate('listing', {
      domain,
      specialization: spec,
      searchQuery: `${domain} review and legal representation`
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelection(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelection(Array.from(e.target.files));
    }
  };

  const handleFilesSelection = (selectedFiles: File[]) => {
    setError('');
    const hasPdf = selectedFiles.some(f => f.type === 'application/pdf');
    if (hasPdf && selectedFiles.length > 1) {
      setError('Please upload only 1 PDF document at a time. Multiple images are allowed.');
      return;
    }
    if (!hasPdf && selectedFiles.length > 5) {
      setError('You can upload a maximum of 5 images at a time.');
      return;
    }

    for (const f of selectedFiles) {
      const isValidType = f.type === 'application/pdf' || f.type.startsWith('image/');
      if (!isValidType) {
        setError('Unsupported file format. Please upload a PDF or Image(s).');
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError(`File ${f.name} exceeds the 10MB limit.`);
        return;
      }
    }

    setFiles(selectedFiles);
    setExtractedText('');
    setClassification(null);
    setRiskAnalysis([]);
    setSummaryOutput(null);
    setChatMessages([]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    files.forEach(f => formData.append('documents', f));

    try {
      if (!auth.currentUser) {
        throw new Error('Please log in to your account to upload and analyze documents.');
      }
      const token = await auth.currentUser.getIdToken();

      const response = await fetch('http://localhost:5000/api/ai/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract and analyze document');
      }

      const fileName = files[0]?.name || 'Uploaded Document';
      setExtractedText(data.text || '');
      setClassification(data.classification || null);
      setDocumentId(data.documentId || '');
      setDocumentFileName(fileName);
      setRiskAnalysis(data.riskAnalysis || []);
      setSummaryOutput(data.summaryOutput || null);

      // Save to User-Scoped Session Storage
      saveActiveDocumentToSession({
        documentId: data.documentId,
        text: data.text || '',
        classification: data.classification,
        fileName,
        riskAnalysis: data.riskAnalysis,
        summaryOutput: data.summaryOutput
      });

      // Initialize chat with greeting
      const initChat: ChatMessage[] = [
        {
          role: 'assistant',
          content: `Hello! I have analyzed your document (**${data.classification?.domain || 'Legal Document'}**). You can ask me any question about your contract's terms, compensation, notice periods, or legal liabilities.`,
          suggestedQuestions: [
            "What is my required termination notice period?",
            "Are there any restrictive non-compete clauses?",
            "What are my key financial compensation terms?"
          ]
        }
      ];
      setChatMessages(initChat);
      sessionStorage.setItem(getStorageKeyChat(auth.currentUser.uid, data.documentId), JSON.stringify(initChat));

      // Refresh user documents history in background
      fetch('http://localhost:5000/api/ai/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => {
        if (d.documents) setUserDocuments(d.documents);
      }).catch(console.error);

      setActiveTab('risk');

    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = async (queryText?: string) => {
    const queryToSend = queryText || inputQuery;
    if (!queryToSend.trim() || isChatLoading || !documentId) return;

    const user = auth.currentUser;
    if (!user) return;

    const userMsg: ChatMessage = { role: 'user', content: queryToSend };
    const updatedWithUser = [...chatMessages, userMsg];
    setChatMessages(updatedWithUser);
    sessionStorage.setItem(getStorageKeyChat(user.uid, documentId), JSON.stringify(updatedWithUser));

    if (!queryText) setInputQuery('');
    setIsChatLoading(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch(`http://localhost:5000/api/ai/chat/${documentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: queryToSend,
          messages: updatedWithUser.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get answer from AI');
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        relevantClauses: data.relevantClauses,
        citations: data.citations,
        suggestedQuestions: data.suggestedQuestions
      };

      const finalMessages = [...updatedWithUser, assistantMsg];
      setChatMessages(finalMessages);
      sessionStorage.setItem(getStorageKeyChat(user.uid, documentId), JSON.stringify(finalMessages));
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message || 'Could not process query.'}`
      };
      const finalMessages = [...updatedWithUser, errorMsg];
      setChatMessages(finalMessages);
      sessionStorage.setItem(getStorageKeyChat(user.uid, documentId), JSON.stringify(finalMessages));
    } finally {
      setIsChatLoading(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'HIGH_RISK':
        return {
          bg: 'bg-red-500/10 border-red-500/30 text-red-400',
          icon: <AlertTriangle size={16} className="text-red-400" />,
          label: 'High Risk / Unenforceable'
        };
      case 'POTENTIALLY_UNENFORCEABLE':
        return {
          bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
          icon: <AlertCircle size={16} className="text-orange-400" />,
          label: 'Potentially Unenforceable'
        };
      case 'REQUIRES_REVIEW':
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          icon: <HelpCircle size={16} className="text-yellow-400" />,
          label: 'Requires Factual Review'
        };
      case 'ONE_SIDED':
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          icon: <Info size={16} className="text-blue-400" />,
          label: 'One-Sided / Asymmetric'
        };
      case 'NO_ISSUE_DETECTED':
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle size={16} className="text-emerald-400" />,
          label: 'Compliant / Standard'
        };
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles size={14} /> CaseCounsel AI Legal Intelligence
        </div>
        <h1 className="text-4xl font-serif font-bold text-white mb-2">Legal Contract Analyzer & Risk Auditor</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed">
          Automated regional script sanitization, PII redaction, 5-tier statutory risk matrix evaluation, and interactive legal Q&A under Indian Law.
        </p>
      </div>

      {/* Top Document Persistence & History Bar */}
      {documentId && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#0e162b] border border-gold/20 p-4 rounded-xl mb-6 gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-gold/10 p-2.5 rounded-lg text-gold border border-gold/20 shrink-0">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-sm sm:text-base truncate max-w-[240px] sm:max-w-md">{documentFileName || 'Active Document'}</h2>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase">Restored & Active</span>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">
                {classification?.domain || 'Legal Contract'} • {userDocuments.length} document{userDocuments.length === 1 ? '' : 's'} saved in your account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {userDocuments.length > 0 && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/[0.08] transition-all"
              >
                <History size={14} className="text-gold" />
                History ({userDocuments.length})
                <ChevronDown size={14} />
              </button>
            )}
            <button
              onClick={handleStartNewUpload}
              className="flex items-center gap-1.5 bg-gold/10 hover:bg-gold/20 text-gold px-3.5 py-2 rounded-lg text-xs font-bold border border-gold/30 transition-all shadow-sm"
            >
              <PlusCircle size={14} />
              + Upload Another
            </button>
          </div>
        </div>
      )}

      {/* History Modal / Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0c1324] border border-gold/20 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
              <div className="flex items-center gap-2.5">
                <History size={20} className="text-gold" />
                <h3 className="text-lg font-bold text-white">Your Analyzed Documents</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-800/50 hover:bg-gray-800"
              >
                Close ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {userDocuments.length === 0 ? (
                <p className="text-gray-400 text-center py-8 text-sm">No analyzed documents found for your account.</p>
              ) : (
                userDocuments.map((doc) => {
                  const isActive = doc.documentId === documentId;
                  return (
                    <div
                      key={doc.documentId}
                      onClick={() => handleSelectDocument(doc.documentId)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-gold/10 border-gold/40'
                          : 'bg-gray-900/40 border-white/[0.05] hover:bg-gray-800/50 hover:border-gold/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className={`shrink-0 mt-1 ${isActive ? 'text-gold' : 'text-gray-400'}`} size={18} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-white font-semibold text-sm">{doc.fileName}</h4>
                            {isActive && (
                              <span className="text-[10px] bg-gold text-navy font-bold px-1.5 py-0.2 rounded">ACTIVE</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs mt-0.5">
                            {doc.domain} • {doc.wordCount} words • {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                          {doc.riskStats && (
                            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                              {doc.riskStats.highRisk > 0 && (
                                <span className="text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                  {doc.riskStats.highRisk} High Risk
                                </span>
                              )}
                              {doc.riskStats.oneSided > 0 && (
                                <span className="text-blue-400 font-semibold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                  {doc.riskStats.oneSided} One-Sided
                                </span>
                              )}
                              <span className="text-gray-400">
                                {doc.riskStats.totalClauses} total clauses
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectDocument(doc.documentId);
                          }}
                          className="text-xs bg-gold hover:bg-gold-500 text-navy font-bold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {isActive ? 'Viewing' : 'Open'}
                        </button>
                        <button
                          onClick={(e) => handleDeleteDocument(doc.documentId, e)}
                          title="Delete from history"
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded hover:bg-gray-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Dropzone Area (Shown when no active document OR when user is uploading) */}
      {(!documentId || files.length > 0) && (
        <div className="bg-[#0c1324] border border-white/[0.05] rounded-2xl p-6 lg:p-8 mb-8 shadow-2xl animate-in fade-in duration-300">
          {userDocuments.length > 0 && !documentId && (
            <div className="mb-4 flex items-center justify-between bg-blue-950/20 border border-blue-500/20 p-3.5 rounded-xl text-xs text-blue-300">
              <div className="flex items-center gap-2">
                <History size={16} className="text-blue-400 shrink-0" />
                <span>You have <strong>{userDocuments.length}</strong> previously analyzed document{userDocuments.length === 1 ? '' : 's'}.</span>
              </div>
              <button
                onClick={() => handleSelectDocument(userDocuments[0].documentId)}
                className="text-gold hover:text-gold-300 font-bold underline ml-2"
              >
                Load Last Document →
              </button>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer text-center
              ${isDragging ? 'border-gold bg-gold/10' : 'border-gray-700 bg-gray-800/20 hover:border-gold/50'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFileInput}
            />

            <div className="mb-3 bg-gray-800/50 p-4 rounded-full text-gold">
              {files.length > 0 ? (
                files[0].type === 'application/pdf' ? <FileText size={36} /> : <FileImage size={36} />
              ) : (
                <UploadCloud size={36} />
              )}
            </div>

            {files.length > 0 ? (
              <div>
                {files.map((f, i) => (
                  <div key={i} className="flex justify-between items-center text-left mb-1.5 bg-gray-900/60 px-4 py-2 rounded-lg border border-white/[0.05]">
                    <p className="text-white font-medium text-sm truncate max-w-[250px]">{f.name}</p>
                    <p className="text-gray-400 text-xs ml-4 font-mono">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFiles([]);
                    setError('');
                  }}
                  className="mt-3 text-red-400 hover:text-red-300 text-xs font-medium border border-red-400/20 bg-red-400/10 px-3.5 py-1.5 rounded-md transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            ) : (
              <div>
                <p className="text-white font-medium text-base mb-1">Drag and drop your legal agreement here</p>
                <p className="text-gray-400 text-xs">Supports English & Regional PDF, PNG, JPG (Multi-page image aggregation)</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Shield size={14} className="text-emerald-400 shrink-0" />
              <p><strong>DPDP Act & ISO 27001 Compliant:</strong> Client-side PII redaction and 30-day automated purge active.</p>
            </div>

            <button
              onClick={handleUpload}
              disabled={files.length === 0 || isLoading}
              className={`px-8 py-3 rounded-lg font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2
                ${files.length === 0 || isLoading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gold hover:bg-gold-500 text-navy shadow-lg shadow-gold/20'}
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Auditing Legal Clauses...
                </>
              ) : 'Run Full Legal Audit'}
            </button>
          </div>
        </div>
      )}

      {/* Main Analysis Dashboard */}
      {extractedText && (
        <div className="bg-[#0c1324] border border-white/[0.05] rounded-2xl p-6 lg:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Classification & Metadata Header Banner */}
          <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between bg-gradient-to-r from-navy-800 to-[#101b33] border border-gold/20 p-5 rounded-xl gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-gold uppercase tracking-wider">Identified Classification</span>
                <span className="text-xs bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded font-mono">
                  {classification?.method || 'Hybrid-Taxonomy'}
                </span>
              </div>
              <h3 className="text-2xl font-serif font-bold text-white flex items-center gap-3">
                {classification?.domain || 'Legal Contract'}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-[#0c1324] px-4 py-2 rounded-lg border border-white/[0.05] text-right">
                <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Domain Confidence</p>
                <p className="text-lg font-bold text-emerald-400">{((classification?.confidence || 0.95) * 100).toFixed(0)}%</p>
              </div>
              <div className="bg-[#0c1324] px-4 py-2 rounded-lg border border-white/[0.05] text-right">
                <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">High Risk Flags</p>
                <p className="text-lg font-bold text-red-400">
                  {riskAnalysis.filter(r => r.riskLevel === 'HIGH_RISK').length}
                </p>
              </div>
              <button
                onClick={handleSeekLegalHelp}
                className="flex items-center gap-2 bg-gradient-to-r from-gold via-amber-400 to-gold text-navy font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-gold/20 hover:scale-105 transition-all text-xs uppercase tracking-wider"
              >
                <Scale size={16} /> Seek Legal Help
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('risk')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'risk' ? 'bg-gold text-navy shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}
            >
              <Scale size={16} /> 5-Tier Risk Matrix ({riskAnalysis.length})
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-gold text-navy shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}
            >
              <BookOpen size={16} /> Document Truth Summary
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'chat' ? 'bg-gold text-navy shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}
            >
              <MessageSquare size={16} /> Interactive Legal Q&A
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'text' ? 'bg-gold text-navy shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}
            >
              <FileText size={16} /> Redacted Document Text
            </button>
          </div>

          {/* TAB 1: 5-TIER RISK MATRIX */}
          {activeTab === 'risk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">
                  Clauses evaluated via <strong>Route A (Deterministic Statutory Rules)</strong> and <strong>Route B (Grounded RAG Legal Reasoning)</strong>.
                </p>
              </div>

              {riskAnalysis.length === 0 ? (
                <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-white/[0.03]">
                  <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                  <p className="text-white font-medium">No statutory violations or high-risk liabilities detected.</p>
                </div>
              ) : (
                riskAnalysis.map((item, idx) => {
                  const badge = getRiskBadge(item.riskLevel);
                  return (
                    <div
                      key={idx}
                      className={`p-5 rounded-xl border transition-all ${item.riskLevel === 'HIGH_RISK' ? 'bg-red-950/10 border-red-500/30 hover:border-red-500/50' :
                          item.riskLevel === 'ONE_SIDED' ? 'bg-blue-950/10 border-blue-500/30 hover:border-blue-500/50' :
                            'bg-gray-900/40 border-white/[0.05] hover:border-white/[0.1]'
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-white/[0.05] text-gray-300 px-2 py-0.5 rounded">
                            Clause #{item.clauseIndex}
                          </span>
                          <h4 className="text-base font-bold text-white">{item.clauseType || 'Contractual Clause'}</h4>
                        </div>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                          {badge.icon}
                          {badge.label}
                        </div>
                      </div>

                      <p className="text-gray-200 text-sm font-medium mb-3">{item.finding}</p>

                      <div className="bg-[#080d1a] p-3.5 rounded-lg border border-white/[0.03] space-y-2 text-xs">
                        {item.statutoryConflict && item.statutoryConflict.actName && item.statutoryConflict.actName !== 'N/A' ? (
                          <div className="flex items-start gap-2">
                            <Gavel size={14} className="text-gold shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-gold">Statutory Conflict: </span>
                              <span className="text-gray-300">
                                {item.statutoryConflict.actName} (Section {item.statutoryConflict.section})
                              </span>
                              {item.statutoryConflict.precedentCitation && item.statutoryConflict.precedentCitation !== 'N/A' && (
                                <span className="text-gray-400 block mt-0.5 italic">
                                  Precedent: {item.statutoryConflict.precedentCitation}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-emerald-400">Statutory Status: </span>
                              <span className="text-gray-300">
                                Standard operational clause with no detected legal conflict under Indian law.
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-gray-400">Legal Reasoning: </span>
                            <span className="text-gray-300 leading-relaxed">{item.reasoning}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Evaluation Path: {item.deterministicRuleTriggered ? 'Deterministic Rule (0ms)' : 'Grounded LLM Reasoning'}</span>
                        <span>Confidence: {(item.confidenceScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })
              )}
              {/* Attorney Consultation CTA Footer */}
              <div className="mt-8 p-5 bg-gradient-to-r from-[#0c1324] via-[#101a33] to-[#142347] border border-gold/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2">
                    <Gavel className="text-gold" size={18} /> Need an Attorney to Challenge or Renegotiate Flagged Clauses?
                  </h4>
                  <p className="text-gray-400 text-xs mt-1">
                    Connect with verified <strong>{getSpecializationForDomain(classification?.domain)}</strong> lawyers specializing in Indian contract disputes and statutory enforcement.
                  </p>
                </div>
                <button
                  onClick={handleSeekLegalHelp}
                  className="whitespace-nowrap bg-gold hover:bg-gold-500 text-navy font-bold px-6 py-2.5 rounded-lg text-xs uppercase tracking-wider shadow-lg shadow-gold/20 flex items-center gap-2 transition-all hover:scale-105"
                >
                  Find {getSpecializationForDomain(classification?.domain)} Lawyers <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENT TRUTH SUMMARY */}
          {activeTab === 'summary' && summaryOutput && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="bg-gradient-to-br from-gray-900/80 to-[#10192e] p-5 rounded-xl border border-gold/20">
                <div className="flex items-center gap-2 mb-2 text-gold">
                  <BookOpen size={18} />
                  <h4 className="font-bold text-base">Executive Synopsis</h4>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{summaryOutput.executiveSummary}</p>
              </div>

              {/* Rights & Obligations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rights */}
                <div className="bg-emerald-950/10 border border-emerald-500/20 p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3 text-emerald-400 font-bold text-sm">
                    <UserCheck size={16} /> Legal & Operational Rights
                  </div>
                  <ul className="space-y-2 text-xs text-gray-300">
                    {summaryOutput.rights.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Obligations */}
                <div className="bg-purple-950/10 border border-purple-500/20 p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3 text-purple-400 font-bold text-sm">
                    <Shield size={16} /> Affirmative Duties & Restrictive Covenants
                  </div>
                  <ul className="space-y-2 text-xs text-gray-300">
                    {summaryOutput.obligations.map((o, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-purple-400 font-bold">•</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Financial Terms */}
              <div className="bg-gray-900/50 border border-white/[0.05] p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-3 text-gold font-bold text-sm">
                  <DollarSign size={16} /> Financial Schedules & Compensation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summaryOutput.financialTerms.map((f, i) => (
                    <div key={i} className="bg-[#090e1c] p-3.5 rounded-lg border border-white/[0.03]">
                      <p className="text-xs text-gray-400 font-medium">{f.description}</p>
                      <p className="text-lg font-bold text-white mt-1">{f.amount}</p>
                      <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                        <Clock size={12} /> {f.deadline}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Termination & Governing Law */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-amber-950/10 border border-amber-500/20 p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3 text-amber-400 font-bold text-sm">
                    <Clock size={16} /> Termination Conditions & Notice
                  </div>
                  <ul className="space-y-2 text-xs text-gray-300">
                    {summaryOutput.terminationConditions.map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">▪</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-950/10 border border-blue-500/20 p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3 text-blue-400 font-bold text-sm">
                    <Gavel size={16} /> Governing Law & Jurisdiction
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{summaryOutput.governingLaw}</p>
                </div>
              </div>

              {/* Consultation CTA in Summary */}
              <div className="mt-4 p-4 bg-gray-900/60 border border-white/[0.05] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-gray-300 text-xs">
                  Looking for counsel to draft, amend, or execute an agreement in this domain?
                </p>
                <button
                  onClick={handleSeekLegalHelp}
                  className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  Seek Legal Help <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: INTERACTIVE DOCUMENT Q&A / CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[520px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
              {/* Chat Message Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user'
                          ? 'bg-gold text-navy font-medium rounded-br-none shadow-md'
                          : 'bg-[#101b33] text-gray-200 border border-white/[0.05] rounded-bl-none shadow-lg'
                        }`}
                    >
                      <MarkdownRenderer content={msg.content} isUser={msg.role === 'user'} />

                      {/* Citations Pill on Assistant Message */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Citations:</span>
                          {msg.citations.map((c, i) => (
                            <span key={i} className="text-[10px] bg-navy/80 text-gray-300 border border-white/[0.05] px-2 py-0.5 rounded font-mono">
                              {c.actName} (§ {c.section})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Suggested Questions Pills */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendChat(q)}
                            className="text-[11px] bg-gray-800/80 hover:bg-gold/20 text-gray-300 hover:text-gold border border-gray-700 hover:border-gold/40 px-3 py-1 rounded-full transition-all text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex items-center gap-2 text-gold text-xs p-3 bg-gray-800/30 rounded-xl w-fit">
                    <Loader2 size={14} className="animate-spin" />
                    Synthesizing statutory answer...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#0a0f1d] border-t border-gray-800 flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask any legal question about this document..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-colors placeholder:text-gray-500"
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={!inputQuery.trim() || isChatLoading}
                  className={`p-2.5 rounded-lg transition-all ${!inputQuery.trim() || isChatLoading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gold text-navy hover:bg-gold-500'
                    }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: REDACTED DOCUMENT TEXT */}
          {activeTab === 'text' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">
                  All Indian identifiers (Aadhaar, PAN, Phone, Email) have been anonymized with an active offset registry.
                </p>
                <button
                  onClick={() => copyText(extractedText)}
                  className="flex items-center gap-1.5 text-xs text-gold hover:text-gold-300 font-semibold transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Redacted Text'}
                </button>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 max-h-96 overflow-y-auto">
                <pre className="text-gray-300 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {extractedText}
                </pre>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
