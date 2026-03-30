import { X } from "lucide-react";
import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-navy-50 rounded-2xl border border-gold/20 max-w-md w-full p-6 shadow-2xl shadow-gold/20 fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-serif font-bold text-gold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gold transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
