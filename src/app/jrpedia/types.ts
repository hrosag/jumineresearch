// src/app/jrpedia/types.ts

export type Lang = "pt" | "en" | "fr";

export type GlossaryRow = {
  id: number; // 🔑 supabase retorna number
  term: string;
  pt: string | null;
  en: string | null;
  fr: string | null;
  definition_pt: string | null;
  definition_en: string | null;
  definition_fr: string | null;
  category: string | null;
  fonte: string;
  tags: string[] | null;
  parent_id: number | null;
};

export type GlossaryRowInput = Omit<GlossaryRow, "id">;

export type GlossaryNode = GlossaryRow & { children: GlossaryNode[] };

export type RealExample = {
  composite_key: string;
  body_text: string | null;
};

export type SidebarProps = {
  tree: GlossaryNode[];
  selectedTerm: GlossaryRow | null;
  setSelectedTerm: (t: GlossaryRow | null) => void;
  selectedLang: Lang;
};

export type TermViewProps = {
  selectedTerm: GlossaryRow | null;
  selectedLang: Lang;
  isAdmin: boolean;
};

export type CrudModalsProps = {
  selectedTerm: GlossaryRow | null;
  setSelectedTerm: (t: GlossaryRow | null) => void;
  fetchEntries: () => void;
  showNewModal: boolean;
  setShowNewModal: (v: boolean) => void;
  showEditModal: boolean;
  setShowEditModal: (v: boolean) => void;
  showDeleteModal: boolean;
  setShowDeleteModal: (v: boolean) => void;
};
