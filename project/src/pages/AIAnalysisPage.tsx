import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, FileImage, ShieldAlert, Loader2 } from 'lucide-react';

export default function AIAnalysisPage({ }: { onNavigate: (page: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [classification, setClassification] = useState<any>(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    // Check if there's any PDF
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
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    files.forEach(f => formData.append('documents', f));

    try {
      // In production, BASE_URL should be derived from env
      const response = await fetch('http://localhost:5000/api/ai/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract text from document');
      }

      setExtractedText(data.text);
      if (data.classification) {
        setClassification(data.classification);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-serif font-bold text-white mb-4">AI Legal Analysis</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Upload your legal document to instantly extract text using our advanced hybrid OCR pipeline.
          We use robust extraction engines designed for digital PDFs and scanned images.
        </p>
      </div>

      <div className="bg-[#0c1324] border border-white/[0.05] rounded-2xl p-6 lg:p-10 mb-8 shadow-2xl">
        {/* Dropzone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer text-center
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

          <div className="mb-4 bg-gray-800/50 p-4 rounded-full text-gold">
            {files.length > 0 ? (
              files[0].type === 'application/pdf' ? <FileText size={40} /> : <FileImage size={40} />
            ) : (
              <UploadCloud size={40} />
            )}
          </div>

          {files.length > 0 ? (
            <div>
              {files.map((f, i) => (
                <div key={i} className="flex justify-between items-center text-left mb-1 bg-gray-900/50 px-3 py-1 rounded">
                  <p className="text-white font-medium text-sm truncate max-w-[200px]">{f.name}</p>
                  <p className="text-gray-400 text-xs ml-4">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); setFiles([]); setExtractedText(''); setError(''); }}
                className="mt-4 text-red-400 hover:text-red-300 text-sm font-medium border border-red-400/20 bg-red-400/10 px-4 py-1.5 rounded-md"
              >
                Clear Files
              </button>
            </div>
          ) : (
            <div>
              <p className="text-white font-medium text-lg mb-2">Drag and drop your document here</p>
              <p className="text-gray-400 text-sm">or click to browse from your computer</p>
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
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldAlert size={14} />
            <p><strong>Disclaimer:</strong> Supported formats include PDF, PNG, JPG. Maximum file size is 10MB. Avoid uploading files with more than 10 pages for optimal performance.</p>
          </div>

          <button
            onClick={handleUpload}
            disabled={files.length === 0 || isLoading}
            className={`px-8 py-3 rounded-lg font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2
              ${files.length === 0 || isLoading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gold hover:bg-gold-500 text-navy'}
            `}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyzing...
              </>
            ) : 'Run AI Extraction'}
          </button>
        </div>
      </div>

      {/* Extracted Text Results Area */}
      {extractedText && (
        <div className="bg-[#0c1324] border border-white/[0.05] rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {classification && (
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gold/10 border border-gold/20 p-5 rounded-xl">
              <div className="mb-4 sm:mb-0">
                <p className="text-gold/70 text-xs font-bold uppercase tracking-widest mb-1">Detected Document Domain</p>
                <h3 className="text-2xl font-serif font-bold text-gold">{classification.domain}</h3>
              </div>
              <div className="sm:text-right flex items-center sm:block gap-4">
                <div className="px-3 py-1 bg-[#0c1324] rounded-md border border-gold/20">
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Confidence</p>
                  <p className="text-lg font-bold text-white">{(classification.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-4">
            <h2 className="text-xl font-bold text-white">Extracted Information</h2>
            <button
              className="text-sm text-gold hover:text-gold-300 transition-colors"
              onClick={() => navigator.clipboard.writeText(extractedText)}
            >
              Copy to Clipboard
            </button>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 h-96 overflow-y-auto">
            <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {extractedText}
            </pre>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20">
              Send for Deep Legal Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
