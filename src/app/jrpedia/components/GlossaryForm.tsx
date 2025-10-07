"use client";

import { useEffect, useMemo, useState } from "react";
import { GlossaryRow, GlossaryRowInput } from "../types";

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
    };
  }, [initialData, initialParentPath]);

  const [form, setForm] = useState<GlossaryRowInput>(resolvedInitial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(resolvedInitial);
  }, [resolvedInitial]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const sanitizedParentPath =
      typeof form.parent_path === "string" && form.parent_path.trim().length > 0
        ? form.parent_path.trim()
        : null;

    const payload: GlossaryRowInput = {
      ...form,
      parent_path: sanitizedParentPath,
    };

    await onSave(payload);
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 w-full max-w-[560px] text-white"
    >
      <div>
        <label className="block text-sm font-bold text-[#d4af37]">Termo base</label>
        <input
          name="term"
          value={form.term}
          onChange={handleChange}
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
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
        <label className="block text-sm font-semibold text-[#d4af37]">Caminho do pai</label>
        <input
          type="text"
          name="parent_path"
          placeholder="Ex: 1.1 ou 1.1.1"
          value={
            typeof form.parent_path === "string" ? form.parent_path : form.parent_path ?? ""
          }
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              parent_path: event.target.value,
            }))
          }
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white placeholder-gray-400 focus:border-[#d4af37] focus:outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Indique o caminho do termo pai (ex: 1.1.1). Deixe vazio para nó raiz.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm text-[#d4af37]">PT</label>
          <input
            name="pt"
            value={form.pt ?? ""}
            onChange={handleChange}
            className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-[#d4af37]">EN</label>
          <input
            name="en"
            value={form.en ?? ""}
            onChange={handleChange}
            className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-[#d4af37]">FR</label>
          <input
            name="fr"
            value={form.fr ?? ""}
            onChange={handleChange}
            className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-[#d4af37]">Definição PT</label>
        <textarea
          name="definition_pt"
          value={form.definition_pt ?? ""}
          onChange={handleChange}
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-[#d4af37]">Definição EN</label>
        <textarea
          name="definition_en"
          value={form.definition_en ?? ""}
          onChange={handleChange}
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-[#d4af37]">Definição FR</label>
        <textarea
          name="definition_fr"
          value={form.definition_fr ?? ""}
          onChange={handleChange}
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-[#d4af37]">Categoria</label>
        <input
          name="category"
          value={form.category ?? ""}
          onChange={handleChange}
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-[#d4af37]">Fonte</label>
        <input
          type="text"
          name="fonte"
          value={form.fonte}
          onChange={handleChange}
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-[#d4af37]">
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
          className="border border-[#2e3b4a] bg-[#1c2833] p-2 w-full rounded text-white focus:border-[#d4af37] focus:outline-none"
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
