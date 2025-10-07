// src/app/jrpedia/components/SearchBar.tsx
"use client";

import { useMemo, useState } from "react";
import { GlossaryRow } from "../types";

type SearchBarProps = {
  entries: GlossaryRow[];
  onSelect: (term: GlossaryRow) => void;
};

export default function SearchBar({ entries, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [] as GlossaryRow[];

    return entries.filter((entry) => {
      const searchableTokens: string[] = [
        entry.term,
        entry.pt ?? "",
        entry.en ?? "",
        entry.fr ?? "",
        entry.path ?? "",
        ...(entry.tags ?? []),
      ].filter((token) => token.length > 0);

      return searchableTokens.some((token) =>
        token.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [entries, query]);

  return (
    <div className="mb-4 relative">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Pesquisar termos ou caminhos..."
        className="w-full rounded border border-[#2e3b4a] bg-[#1c2833] p-2 text-white placeholder-gray-400 focus:border-[#d4af37] focus:outline-none"
      />

      {query && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border border-[#2e3b4a] bg-[#1e2a38] shadow-lg">
          {results.length > 0 ? (
            results.map((result) => (
              <button
                key={result.path ?? `result-${result.id}`}
                onClick={() => {
                  onSelect(result);
                  setQuery("");
                }}
                type="button"
                className="block w-full px-3 py-2 text-left text-white transition hover:bg-[#2e3b4a]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{result.term}</span>
                  {result.path && (
                    <span className="ml-3 text-xs font-mono text-[#d4af37]">
                      {result.path}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-300">
                  {[result.pt, result.en, result.fr].filter(Boolean).join(" • ")}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-300">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
}
