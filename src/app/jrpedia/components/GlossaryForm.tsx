"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Select, { SingleValue } from "react-select";
import { GlossaryRow, GlossaryRowInput } from "../types";

type GlossaryFormProps = {
  initialData?: GlossaryRow;
  initialParentId?: number | null;
  onSave: (data: GlossaryRowInput) => Promise<void>;
  onCancel: () => void;
};

type ParentNode = Pick<GlossaryRow, "id" | "term" | "parent_id">;
type ParentOption = { value: number | ""; label: string };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function collectDescendantIds(nodes: ParentNode[], parentId: number): number[] {
  return nodes
    .filter((node) => node.parent_id === parentId)
    .flatMap((child) => [child.id, ...collectDescendantIds(nodes, child.id)]);
}

function buildTree(
  nodes: ParentNode[],
  parentId: number | null = null,
  level: number = 0,
): ParentOption[] {
  return nodes
    .filter((node) => node.parent_id === parentId)
    .flatMap((node) => [
      { value: node.id, label: `${"— ".repeat(level)}${node.term}` },
      ...buildTree(nodes, node.id, level + 1),
    ]);
}

export default function GlossaryForm({ initialData, initialParentId, onSave, onCancel }: GlossaryFormProps) {
  const [options, setOptions] = useState<ParentNode[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
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
    parent_id: initialData?.parent_id ?? initialParentId ?? null,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchOptions() {
      setOptionsLoading(true);
      const { data, error } = await supabase
        .from("glossary")
        .select("id, term, parent_id")
        .order("term");

      if (!active) {
        return;
      }

      if (error) {
        console.error("Erro ao carregar termos para seleção de pai", error);
        setOptions([]);
      } else {
        setOptions((data as ParentNode[]) ?? []);
      }

      setOptionsLoading(false);
    }

    fetchOptions();

    return () => {
      active = false;
    };
  }, []);

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
      parent_id: initialData?.parent_id ?? initialParentId ?? null,
    });
  }, [initialData, initialParentId]);

  const currentId = initialData?.id ?? null;

  const availableNodes = useMemo(() => {
    if (currentId === null) {
      return options;
    }

    const excludedIds = new Set<number>([currentId, ...collectDescendantIds(options, currentId)]);
    return options.filter((node) => !excludedIds.has(node.id));
  }, [options, currentId]);

  const treeOptions = useMemo(() => buildTree(availableNodes), [availableNodes]);

  const rootOption: ParentOption = useMemo(
    () => ({ value: "", label: "— Raiz (sem pai) —" }),
    [],
  );

  const selectedOption =
    form.parent_id === null
      ? rootOption
      : treeOptions.find((opt) => opt.value === form.parent_id) ?? rootOption;

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
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* Parent ID (dropdown com busca) */}
      <div>
        <label className="block text-sm">Parent</label>
        <Select<ParentOption, false>
          options={[rootOption, ...treeOptions]}
          value={selectedOption}
          onChange={(opt: SingleValue<ParentOption>) =>
            setForm({
              ...form,
              parent_id: !opt || opt.value === "" ? null : Number(opt.value),
            })
          }
          isClearable
          isSearchable
          isLoading={optionsLoading}
          className="react-select-container"
          classNamePrefix="react-select"
        />
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
        <input name="category" value={form.category || ""} onChange={handleChange} className="border p-2 w-full rounded" />
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
      <div className="flex justify-end space-x-2">
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
