"use client";
import { ReactNode } from "react";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`relative w-[80vw] max-w-[1000px] rounded-lg bg-white p-6 shadow-lg ${
          contentClassName ?? ""
        }`}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600"
          aria-label="Fechar modal"
        >
          ✖
        </button>

        {title && (
          <h2
            className={`mb-4 text-xl font-bold ${
              titleClassName ?? "text-gray-900"
            }`}
          >
            {title}
          </h2>
        )}

        <div>{children}</div>
      </div>
    </div>
  );
}
