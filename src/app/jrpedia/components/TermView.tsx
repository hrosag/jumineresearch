"use client";
import { GlossaryRow, Lang } from "../types";

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
