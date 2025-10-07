"use client";
import { ReactNode, useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  contentClassName?: string; // compatibilidade com CrudModals
  titleClassName?: string;   // compatibilidade com CrudModals
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  contentClassName,
  titleClassName,
}: ModalProps) {
  // bloqueia scroll do fundo
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // fecha ao clicar fora
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`relative w-[90vw] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-gray-200 animate-slideUp ${
          contentClassName ?? ""
        }`}
      >
        {/* header */}
        <header
          className={`sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 ${
            titleClassName ?? ""
          }`}
        >
          <h2 className="text-lg font-semibold text-gray-800">
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

        {/* conteúdo */}
        <main className="p-6">{children}</main>
      </div>

      {/* animações Tailwind personalizadas */}
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
            transform: translateY(20px);
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
