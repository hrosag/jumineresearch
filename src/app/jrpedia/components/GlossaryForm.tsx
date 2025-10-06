"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { GlossaryRow, GlossaryRowInput } from "../types";

type GlossaryFormProps = {
  initialData?: GlossaryRow;
  onSave: (data: GlossaryRowInput) => Promise<void>;
  onCancel: () => void;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function GlossaryForm({ initialData, onSave, onCancel }: GlossaryFormProps) {
  const [form, setForm] = useState<GlossaryRowInput>({
    term: initialData?.term ?? "",
    pt: initialData?.pt ?? "",
    en: initialData?.en ?? "",
    fr: initialData?.fr ?? "",
    definition_pt: initialData?.definition_pt ?? "",
    definition_en: initialData?.definition_en ?? "",
    definition_fr: initialData?.definition_fr ?? "",
    category: initialData?.category ?? "General",
    fonte: initialData?.fonte ?? "",
    tags: initialData?.tags ?? [],
    parent_path: (initialData as any)?.parent_path ?? "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      term: initialData?.term ?? "",
      pt: initialData?.pt ?? "",
      en: initialData?.en ?? "",
      fr: initialData?.fr ?? "",
      definition_pt: initialData?.definition_pt ?? "",
      definition_en: initialData?.definition_en ?? "",
      definition_fr: initialData?.definition_fr ?? "",
      category: initialData?.category ?? "General",
      fonte: initialData?.fonte ?? "",
      tags: initialData?.tags ?? [],
      parent_path: (initialData as any)?.parent_path ?? "",
    });
  }, [initialData]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave(form);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-[560px]">
      {/* Termo base */}
      <div>
        <label className="block text-sm font-bold">Termo base</label>
        <input
          name="term"
          value={form.term}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
      </div>

      {/* Parent Path */}
      <div>
        <label className="block text-sm font-semibold">Parent Path</label>
        <input
          type="text"
          name="parent_path"
          placeholder="Ex: 1.1 ou 1.1.1"
          value={(form as any).parent_path ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              parent_path: e.target.value.trim(),
            })
          }
          className="border p-2 w-full rounded bg-[#1e2a38] text-white placeholder-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">
          Indique o caminho do termo pai (ex: 1.1.1). Deixe vazio para nó raiz.
        </p>
      </div>

      {/* Traduções */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm">PT</label>
          <input name="pt" value={form.pt || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        </div>
        <div>
          <label className="block text-sm">EN</label>
          <input name="en" value={form.en || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        </div>
        <div>
          <label className="block text-sm">FR</label>
          <input name="fr" value={form.fr || ""} onChange={handleChange} className="border p-2 w-full rounded" />
        </div>
      </div>

      {/* Definições */}
      <div>
        <label className="block text-sm">Definição PT</label>
        <textarea
          name="definition_pt"
          value={form.definition_pt || ""}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>
      <div>
        <label className="block text-sm">Definição EN</label>
        <textarea
          name="definition_en"
          value={form.definition_en || ""}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>
      <div>
        <label className="block text-sm">Definição FR</label>
        <textarea
          name="definition_fr"
          value={form.definition_fr || ""}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      {/* Categoria */}
      <div>
        <label className="block text-sm">Categoria</label>
        <input
          name="category"
          value={form.category || ""}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      {/* Fonte */}
      <div>
        <label className="block text-sm">Fonte</label>
        <input
          type="text"
          name="fonte"
          value={form.fonte}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm">Tags (separadas por vírgula)</label>
        <input
          name="tags"
          value={form.tags?.join(", ") || ""}
          onChange={(e) =>
            setForm({
              ...form,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            })
          }
          className="border p-2 w-full rounded"
        />
      </div>

      {/* Ações */}
      <div className="flex justify-end space-x-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[#d4af37] text-black font-bold rounded"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
