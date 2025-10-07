"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { GlossaryRow, GlossaryRowInput } from "../types";

type GlossaryTermSummary = {
  id: number;
  term: string;
  path: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type GlossaryFormProps = {
  initialData?: GlossaryRow;
  initialParentPath?: string | null;
  onSave: (data: GlossaryRowInput) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_FORM: GlossaryRowInput = {
  term: "",
  pt: "",
  en: "",
  fr: "",
  definition_pt: "",
  definition_en: "",
  definition_fr: "",
  category: "General",
  fonte: "",
  tags: [],
  parent_path: null,
  parent_name: "",
};

export default function GlossaryForm({
  initialData,
  initialParentPath,
  onSave,
  onCancel,
}: GlossaryFormProps) {
  const resolvedInitial = useMemo<GlossaryRowInput>(() => {
    if (!initialData) {
      return {
        ...EMPTY_FORM,
        parent_path: initialParentPath ?? null,
      };
    }

    return {
      term: initialData.term ?? "",
      pt: initialData.pt ?? "",
      en: initialData.en ?? "",
      fr: initialData.fr ?? "",
      definition_pt: initialData.definition_pt ?? "",
      definition_en: initialData.definition_en ?? "",
      definition_fr: initialData.definition_fr ?? "",
      category: initialData.category ?? "General",
      fonte: initialData.fonte ?? "",
      tags: initialData.tags ?? [],
      parent_path: initialData.parent_path ?? null,
      path: initialData.path ?? null,
      parent_name: "",
    };
  }, [initialData, initialParentPath]);

  const [form, setForm] = useState<GlossaryRowInput>(resolvedInitial);
  const [loading, setLoading] = useState(false);
  const [allTerms, setAllTerms] = useState<GlossaryTermSummary[]>([]);

  useEffect(() => {
    setForm(resolvedInitial);
  }, [resolvedInitial]);

  useEffect(() => {
    let isMounted = true;

    async function fetchTerms() {
      const { data, error } = await supabase
        .from("glossary")
        .select("id, term, path")
        .order("path");

      if (error) {
        console.error("Failed to load glossary terms", error.message);
        return;
      }

      if (!isMounted || !data) {
        return;
      }

      setAllTerms(data);
    }

    void fetchTerms();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (allTerms.length === 0) {
      return;
    }

    setForm((previous) => {
      const currentParentPath =
        typeof previous.parent_path === "string" && previous.parent_path.length > 0
          ? previous.parent_path
          : null;
      const currentParentName = previous.parent_name ?? "";
      let nextParentName = currentParentName;
      let nextParentPath = currentParentPath;

      if (currentParentPath) {
        const match = allTerms.find((term) => term.path === currentParentPath.trim());
        if (match && match.term !== currentParentName) {
          nextParentName = match.term;
        }
      } else if (currentParentName.length > 0) {
        const match = allTerms.find(
          (term) => term.term.toLowerCase() === currentParentName.toLowerCase(),
        );
        if (match && match.path !== currentParentPath) {
          nextParentPath = match.path ?? null;
        }
      }

      if (nextParentName === currentParentName && nextParentPath === currentParentPath) {
        return previous;
      }

      return {
        ...previous,
        parent_name: nextParentName,
        parent_path: nextParentPath,
      };
    });
  }, [allTerms]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  const handleParentPathChange = (value: string) => {
    const trimmedValue = value.trim();
    const match =
      trimmedValue.length > 0
        ? allTerms.find((term) => term.path === trimmedValue)
        : undefined;

    setForm((previous) => {
      const nextParentName = match ? match.term : "";
      const nextParentPath = match
        ? match.path ?? null
        : value.length > 0
        ? value
        : null;

      if (
        previous.parent_path === nextParentPath &&
        (previous.parent_name ?? "") === nextParentName
      ) {
        return previous;
      }

      return {
        ...previous,
        parent_path: nextParentPath,
        parent_name: nextParentName,
      };
    });
  };

  const handleParentTermChange = (value: string) => {
    const trimmedValue = value.trim();
    const match =
      trimmedValue.length > 0
        ? allTerms.find(
            (term) => term.term.toLowerCase() === trimmedValue.toLowerCase(),
          )
        : undefined;

    setForm((previous) => {
      const nextParentPath = match
        ? match.path ?? null
        : trimmedValue.length === 0
        ? null
        : previous.parent_path ?? null;

      const nextParentName = match ? match.term : value;

      if (
        (previous.parent_name ?? "") === nextParentName &&
        previous.parent_path === nextParentPath
      ) {
        return previous;
      }

      return {
        ...previous,
        parent_name: nextParentName,
        parent_path: nextParentPath,
      };
    });
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const sanitizedParentPath =
      typeof form.parent_path === "string" && form.parent_path.trim().length > 0
        ? form.parent_path.trim()
        : null;

    const sanitizedParentName =
      form.parent_name && form.parent_name.trim().length > 0
        ? form.parent_name.trim()
        : undefined;

    const payload: GlossaryRowInput = {
      ...form,
      parent_path: sanitizedParentPath,
      parent_name: sanitizedParentName,
    };

    await onSave(payload);
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 w-full max-w-[700px] max-h-[90vh] overflow-y-auto text-white"
    >
      <div>
        <label className="block text-sm font-bold text-gray-200">Termo base</label>
        <input
          name="term"
          value={form.term}
          onChange={handleChange}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
          required
        />
      </div>

      {form.path && (
        <div>
          <span className="block text-xs uppercase tracking-wide text-gray-400">Caminho atual</span>
          <div className="mt-1 rounded border border-[#2e3b4a] bg-[#13202c] px-3 py-2 text-sm">
            {form.path}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-200">parent_path</label>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div>
            <span className="block text-xs uppercase tracking-wide text-gray-400">Path</span>
            <input
              type="text"
              name="parent_path"
              placeholder="e.g. 1.1 or 1.1.1"
              value={typeof form.parent_path === "string" ? form.parent_path : form.parent_path ?? ""}
              onChange={(event) => handleParentPathChange(event.target.value)}
              className="mt-1 border-transparent bg-white p-2 w-full rounded text-black placeholder-gray-400 focus:border-[#d4af37] focus:outline-none"
            />
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-gray-400">Term</span>
            <input
              type="text"
              list="parent-term-options"
              name="parent_name"
              placeholder="Search parent term"
              value={form.parent_name ?? ""}
              onChange={(event) => handleParentTermChange(event.target.value)}
              className="mt-1 border-transparent bg-white p-2 w-full rounded text-black placeholder-gray-400 focus:border-[#d4af37] focus:outline-none"
            />
            <datalist id="parent-term-options">
              {allTerms.map((term) => (
                <option key={term.id} value={term.term}>
                  {term.path ?? ""}
                </option>
              ))}
            </datalist>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Leave both fields empty to create a root-level term.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm text-gray-200">PT</label>
          <input
            name="pt"
            value={form.pt ?? ""}
            onChange={handleChange}
            className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-200">EN</label>
          <input
            name="en"
            value={form.en ?? ""}
            onChange={handleChange}
            className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-200">FR</label>
          <input
            name="fr"
            value={form.fr ?? ""}
            onChange={handleChange}
            className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-200">Definição PT</label>
        <textarea
          name="definition_pt"
          value={form.definition_pt ?? ""}
          onChange={handleChange}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-200">Definição EN</label>
        <textarea
          name="definition_en"
          value={form.definition_en ?? ""}
          onChange={handleChange}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-200">Definição FR</label>
        <textarea
          name="definition_fr"
          value={form.definition_fr ?? ""}
          onChange={handleChange}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-200">Categoria</label>
        <input
          name="category"
          value={form.category ?? ""}
          onChange={handleChange}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-200">Fonte</label>
        <input
          type="text"
          name="fonte"
          value={form.fonte}
          onChange={handleChange}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-200">
          Tags (separadas por vírgula)
        </label>
        <input
          name="tags"
          value={(form.tags ?? []).join(", ")}
          onChange={(event) => {
            const nextTags = event.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
            setForm((prev) => ({
              ...prev,
              tags: nextTags.length > 0 ? nextTags : [],
            }));
          }}
          className="border-transparent bg-white p-2 w-full rounded text-black focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded border border-[#d4af37] text-[#d4af37] hover:bg-[#2e3b4a]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-[#d4af37] text-black font-bold hover:bg-[#f0c75e] disabled:opacity-70"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
