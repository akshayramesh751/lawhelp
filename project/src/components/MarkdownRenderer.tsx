import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser = false, className = '' }) => {
  return (
    <div className={`prose prose-invert max-w-none text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className={`text-lg font-bold mt-2 mb-2 pb-1 border-b ${isUser ? 'border-navy/20 text-navy' : 'border-white/10 text-gold'}`} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className={`text-base font-bold mt-2.5 mb-1.5 ${isUser ? 'text-navy' : 'text-gold'}`} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className={`text-sm font-bold mt-2 mb-1 uppercase tracking-wider ${isUser ? 'text-navy' : 'text-amber-400'}`} {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className={`text-xs font-bold mt-1.5 mb-1 ${isUser ? 'text-navy' : 'text-gray-200'}`} {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className={`mb-2.5 last:mb-0 leading-relaxed ${isUser ? 'text-navy font-medium' : 'text-gray-200'}`} {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className={`font-semibold ${isUser ? 'text-navy font-bold' : 'text-white'}`} {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className={`italic ${isUser ? 'text-navy/80' : 'text-gray-300'}`} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="space-y-1.5 my-2 pl-4 list-disc marker:text-gold" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="space-y-1.5 my-2 pl-4 list-decimal marker:text-gold" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className={`pl-1 leading-relaxed ${isUser ? 'text-navy' : 'text-gray-200'}`} {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className={`my-3 border-t ${isUser ? 'border-navy/20' : 'border-white/10'}`} {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className={`pl-3.5 my-2 border-l-2 ${isUser ? 'border-navy/40 text-navy' : 'border-gold text-gray-300'} italic`} {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            return (
              <code className={`px-1.5 py-0.5 rounded font-mono text-xs ${isUser ? 'bg-black/10 text-navy' : 'bg-white/10 text-amber-300'}`} {...props}>
                {children}
              </code>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-xs divide-y divide-white/10 border border-white/10 rounded-lg overflow-hidden" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-white/[0.05] text-gold font-semibold uppercase tracking-wider" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-white/[0.05] text-gray-300" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-white/[0.02] transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left font-bold text-gold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-gray-200" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
