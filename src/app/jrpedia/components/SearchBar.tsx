// src/app/jrpedia/components/SearchBar.tsx
"use client";
import { useState } from "react";
import { GlossaryRow } from "../types";

type SearchBarProps = {
  entries: GlossaryRow[];
  onSelect: (term: GlossaryRow) => void;
};

export default function SearchBar({ entries, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const results = query
    ? entries.filter((e) =>
        [e.term, e.pt, e.en, e.fr, ...(e.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="mb-4 relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Pesquisar termos..."
        className="border rounded p-2 w-full"
      />

      {query && (
        <div className="absolute bg-white border rounded w-full mt-1 max-h-60 overflow-y-auto shadow-lg z-10">
          {results.length > 0 ? (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r);
                  setQuery("");
                }}
                className="block w-full text-left px-3 py-2 hover:bg-gray-100"
              >
                <span className="font-bold">{r.term}</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({r.pt || r.en || r.fr})
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
}
