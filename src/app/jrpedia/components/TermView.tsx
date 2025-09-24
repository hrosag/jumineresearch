"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { RealExample, TermViewProps } from "../types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function TermView({
  selectedTerm,
  selectedLang,
  isAdmin,
}: TermViewProps) {
  const [realExamples, setRealExamples] = useState<RealExample[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);

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

  if (!selectedTerm) {
    return (
      <p className="text-gray-500">Selecione um termo na barra lateral.</p>
    );
  }

  return (
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
            {realExamples.map((example) => (
              <details key={example.composite_key} className="rounded-lg border bg-gray-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                  {example.composite_key}
                </summary>
                <div className="mt-2 text-gray-900 whitespace-pre-line">
                  {example.body_text || "Sem conteúdo disponível."}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-4 flex space-x-2">
          <button className="px-3 py-1 bg-green-500 text-white rounded">
            + Novo
          </button>
          <button className="px-3 py-1 bg-yellow-500 text-white rounded">
            ✏️ Editar
          </button>
          <button className="px-3 py-1 bg-red-600 text-white rounded">
            🗑 Excluir
          </button>
        </div>
      )}
    </div>
  );
}
