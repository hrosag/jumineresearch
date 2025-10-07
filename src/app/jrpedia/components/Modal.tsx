"use client";

import { ReactNode, useEffect, useRef } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  // trava scroll do fundo
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // reseta scroll ao abrir
  useEffect(() => {
    if (isOpen && contentRef.current) contentRef.current.scrollTop = 0;
  }, [isOpen]);

  // fecha com tecla Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Cabeçalho */}
        <header className="relative flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title ?? "Modal"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-4 rounded-full p-1 text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-500"
            aria-label="Fechar"
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        {/* Conteúdo */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5 text-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}
