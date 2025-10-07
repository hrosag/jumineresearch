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

  useEffect(() => {
    if (!isOpen || !contentRef.current) {
      return;
    }

    contentRef.current.scrollTop = 0;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <header className="flex items-center justify-center border-b border-gray-200 px-6 py-4">
          {title ? (
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          ) : (
            <span className="sr-only">Modal</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-500"
            aria-label="Fechar"
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5 text-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}
