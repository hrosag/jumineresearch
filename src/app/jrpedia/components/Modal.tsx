"use client";
import { ReactNode, useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "lg",
}: ModalProps) {
  if (!isOpen) return null;

  // evita scroll do fundo
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={`relative w-[90vw] ${sizeClasses} max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-gray-200`}
      >
        {/* header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {title ?? "Modal"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {/* conteúdo */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
