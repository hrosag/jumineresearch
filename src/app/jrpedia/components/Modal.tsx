"use client";
import { ReactNode, useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  contentClassName?: string;
  titleClassName?: string;
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  contentClassName,
  titleClassName,
}: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`relative w-[95vw] max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl border border-gray-300 animate-slideUp ${contentClassName ?? ""}`}
      >
        {/* header */}
        <header
          className={`flex items-center justify-between border-b px-6 py-3 bg-gradient-to-r from-[#f9f9f9] to-[#fff] ${titleClassName ?? ""}`}
        >
          <h2 className="text-lg font-semibold text-gray-800 tracking-tight">
            {title ?? "Modal"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
            aria-label="Fechar modal"
          >
            ×
          </button>
        </header>

        {/* conteúdo rolável */}
        <main className="p-6 overflow-y-auto max-h-[80vh] bg-white">
          {children}
        </main>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
