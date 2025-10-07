import { Dispatch, SetStateAction } from "react";

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
  parent_id?: number | null;
  path?: string | null;
  parent_path?: string | null;
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
  setSelectedTerm: Dispatch<SetStateAction<GlossaryRow | null>>;
  selectedLang: Lang;
  onAddTerm: () => void;
};

export type TermViewProps = {
  selectedTerm: GlossaryRow | null;
  selectedLang: Lang;
  isAdmin: boolean;
  onEditTerm: () => void;
  onDeleteSuccess: () => void;
};

export type CrudModalsProps = {
  selectedTerm: GlossaryRow | null;
  fetchEntries: () => void;
  showNewModal: boolean;
  setShowNewModal: (v: boolean) => void;
  newParentPath: string | null;
  showEditModal: boolean;
  setShowEditModal: (v: boolean) => void;
};
