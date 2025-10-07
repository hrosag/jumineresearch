"use client";

import { createClient } from "@supabase/supabase-js";
import GlossaryForm from "./GlossaryForm";
import Modal from "./Modal";
import { CrudModalsProps, GlossaryRowInput } from "../types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function CrudModals({
  showNewModal,
  setShowNewModal,
  newParentPath,
  showEditModal,
  setShowEditModal,
  selectedTerm,
  fetchEntries,
}: CrudModalsProps) {
  const modalBaseClasses =
    "max-w-[600px] border border-[#2e3b4a] bg-[#1e2a38] text-white";

  const handleCreate = async (formData: GlossaryRowInput) => {
    const { error } = await supabase.from("glossary").insert(formData);
    if (error) {
      console.error("Erro ao criar termo:", error.message);
      return;
    }
    setShowNewModal(false);
    fetchEntries();
  };

  const handleUpdate = async (formData: GlossaryRowInput) => {
    if (!selectedTerm) return;
    const { error } = await supabase
      .from("glossary")
      .update(formData)
      .eq("id", selectedTerm.id);

    if (error) {
      console.error("Erro ao atualizar termo:", error.message);
      return;
    }
    setShowEditModal(false);
    fetchEntries();
  };

  return (
    <>
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="➕ Novo Termo"
        contentClassName={modalBaseClasses}
        titleClassName="text-2xl font-semibold text-[#d4af37]"
      >
        <GlossaryForm
          initialParentPath={newParentPath}
          onCancel={() => setShowNewModal(false)}
          onSave={handleCreate}
        />
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="✏️ Editar Termo"
        contentClassName={modalBaseClasses}
        titleClassName="text-2xl font-semibold text-[#d4af37]"
      >
        {selectedTerm && (
          <GlossaryForm
            initialData={selectedTerm}
            initialParentPath={selectedTerm.parent_path ?? null}
            onCancel={() => setShowEditModal(false)}
            onSave={handleUpdate}
          />
        )}
      </Modal>
    </>
  );
}
