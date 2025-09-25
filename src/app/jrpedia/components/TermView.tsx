"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import Modal from "./Modal";
import { GlossaryRow, RealExample, TermViewProps } from "../types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightWithTags(text: string, term: GlossaryRow | null) {
  if (!text) {
    return "";
  }

  const sanitized = escapeHtml(text);

  if (!term) {
    return sanitized;
  }

  const patterns = [term.term, ...(term.tags ?? [])]
    .map((rawPattern) => rawPattern?.trim())
    .filter((pattern): pattern is string => Boolean(pattern));

  if (patterns.length === 0) {
    return sanitized;
  }

  let result = sanitized;
  const seenPatterns = new Set<string>();

  patterns.forEach((pattern) => {
    const dedupeKey = pattern.toLowerCase();
    if (seenPatterns.has(dedupeKey)) {
      return;
    }
    seenPatterns.add(dedupeKey);

    try {
      const escapedPattern = escapeRegExp(pattern);
      const regex = new RegExp(`(?<!&)\\b(${escapedPattern})\\b`, "gi");

      result = result.replace(regex, (match, _group, offset, original) => {
        const preceding = original.slice(0, offset);
        const lastOpen = preceding.lastIndexOf("<mark");
        const lastClose = preceding.lastIndexOf("</mark>");

        if (lastOpen > lastClose) {
          return match;
        }

        return `<mark class="bg-yellow-200">${match}</mark>`;
      });
    } catch (err) {
      console.warn("Regex error for pattern:", pattern, err);
    }
  });

  return result;
}

export default function TermView({
  selectedTerm,
  selectedLang,
  isAdmin,
  onEditTerm,
  onDeleteSuccess,
}: TermViewProps) {
  const [realExamples, setRealExamples] = useState<RealExample[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadExample = async () => {
      if (!selectedTerm?.fonte) {
        if (isMounted) {
          setRealExamples([]);
          setIsLoadingExamples(false);
        }
        return;
      }

      const fonteKeys = selectedTerm.fonte
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (fonteKeys.length === 0) {
        if (isMounted) {
          setRealExamples([]);
          setIsLoadingExamples(false);
        }
        return;
      }

      setIsLoadingExamples(true);
      const { data, error } = await supabase
        .from("all_data")
        .select("composite_key, body_text")
        .in("composite_key", fonteKeys);

      if (!isMounted) return;

      if (error) {
        console.error("Erro ao buscar exemplos reais:", error.message);
        setRealExamples([]);
      } else {
        setRealExamples(data ?? []);
      }

      setIsLoadingExamples(false);
    };

    loadExample();

    return () => {
      isMounted = false;
    };
  }, [selectedTerm?.fonte]);

  useEffect(() => {
    setShowDeleteConfirm(false);
    setIsDeleting(false);
    setDeleteError(null);
  }, [selectedTerm?.id]);

  const handleCloseDeleteModal = () => {
    if (isDeleting) {
      return;
    }

    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTerm) return;

    setIsDeleting(true);
    setDeleteError(null);

    const { error } = await supabase
      .from("glossary")
      .delete()
      .eq("id", selectedTerm.id);

    if (error) {
      console.error("Erro ao excluir termo:", error.message);
      setDeleteError("Erro ao excluir termo. Tente novamente.");
    } else {
      setShowDeleteConfirm(false);
      onDeleteSuccess();
    }

    setIsDeleting(false);
  };

  if (!selectedTerm) {
    return (
      <p className="text-gray-500">Selecione um termo na barra lateral.</p>
    );
  }

  return (
    <>
      <div className="border rounded-lg bg-white shadow-sm p-6">
      {/* Título no idioma ativo */}
      <h2 className="text-xl font-bold mb-1">
        {selectedTerm[selectedLang] || selectedTerm.term}
      </h2>

      {/* Índice remissivo inteligente */}
      <p className="text-sm text-gray-500 mb-4">
        {selectedLang !== "pt" && selectedTerm.pt && `PT: ${selectedTerm.pt} · `}
        {selectedLang !== "en" && selectedTerm.en && `EN: ${selectedTerm.en} · `}
        {selectedLang !== "fr" && selectedTerm.fr && `FR: ${selectedTerm.fr}`}
      </p>

      {/* Definição no idioma ativo */}
      <p className="text-gray-900 mb-4">
        {selectedLang === "pt"
          ? selectedTerm.definition_pt
          : selectedLang === "en"
          ? selectedTerm.definition_en
          : selectedTerm.definition_fr}
      </p>

      <div className="border-t pt-4 mt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Fonte(s)
          </h3>
          <p className="text-gray-900">
            {selectedTerm.fonte ? selectedTerm.fonte : "Sem fonte cadastrada."}
          </p>
        </div>

        {isLoadingExamples && (
          <p className="text-sm text-gray-500">Carregando boletins...</p>
        )}

        {!isLoadingExamples && realExamples.length > 0 && (
          <div className="space-y-2">
            {realExamples.map((example) => {
              const bodyText = example.body_text;

              return (
                <details
                  key={example.composite_key}
                  className="rounded-lg border bg-gray-50 p-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    {example.composite_key}
                  </summary>
                  {bodyText ? (
                    <div
                      className="mt-2 text-gray-900 whitespace-pre-line"
                      dangerouslySetInnerHTML={{
                        __html: highlightWithTags(bodyText, selectedTerm),
                      }}
                    />
                  ) : (
                    <div className="mt-2 text-gray-900 whitespace-pre-line">
                      Sem conteúdo disponível.
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </div>

        {isAdmin && (
          <div className="mt-4 flex space-x-2">
            <button
              type="button"
              onClick={onEditTerm}
              className="px-3 py-1 rounded bg-yellow-500 text-white transition hover:bg-yellow-600"
            >
              ✏️ Editar
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteConfirm(true);
              }}
              className="px-3 py-1 rounded bg-red-600 text-white transition hover:bg-red-700"
            >
              🗑 Excluir
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={handleCloseDeleteModal}
        title="Confirmar exclusão"
      >
        <p className="mb-4 text-gray-700">Confirma exclusão deste termo?</p>
        {deleteError && (
          <p className="mb-3 text-sm text-red-600">{deleteError}</p>
        )}
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleCloseDeleteModal}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 transition hover:bg-gray-300"
            disabled={isDeleting}
          >
            Não
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="px-3 py-1 rounded bg-red-600 text-white transition hover:bg-red-700 disabled:opacity-70"
            disabled={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Sim"}
          </button>
        </div>
      </Modal>
    </>
  );
}
