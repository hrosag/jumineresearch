"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { GlossaryRow, Lang, RealExample } from "../types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type TermViewProps = {
  selectedTerm: GlossaryRow | null;
  selectedLang: Lang;
  isAdmin: boolean;
};

export default function TermView({
  selectedTerm,
  selectedLang,
  isAdmin,
}: TermViewProps) {
  const [realExample, setRealExample] = useState<RealExample | null>(null);
  const [isLoadingExample, setIsLoadingExample] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadExample = async () => {
      if (!selectedTerm?.fonte) {
        if (isMounted) {
          setRealExample(null);
        }
        return;
      }

      setIsLoadingExample(true);
      const { data, error } = await supabase
        .from("all_data")
        .select("composite_key, body_text")
        .eq("composite_key", selectedTerm.fonte)
        .maybeSingle();

      if (!isMounted) return;

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao buscar exemplo real:", error.message);
        setRealExample(null);
      } else {
        setRealExample(data ?? null);
      }

      setIsLoadingExample(false);
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
            Fonte
          </h3>
          <p className="text-gray-900">
            {selectedTerm.fonte ? selectedTerm.fonte : "Sem fonte cadastrada."}
          </p>
        </div>

        {isLoadingExample && (
          <p className="text-sm text-gray-500">Carregando exemplo real...</p>
        )}

        {!isLoadingExample && realExample && (
          <div className="rounded-lg border bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Exemplo real
            </h4>
            <p className="text-gray-900 whitespace-pre-line">
              {realExample.body_text || "Sem conteúdo disponível."}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Boletim: {realExample.composite_key}
            </p>
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
