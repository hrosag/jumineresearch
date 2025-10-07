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
  // CREATE
  const handleCreate = async (formData: GlossaryRowInput) => {
    // remove campos não persistentes
    const { id, parent_name, ...cleanData } = formData;

    const { error } = await supabase.from("glossary").insert(cleanData);
    if (error) {
      console.error("Erro ao criar termo:", error.message);
      return;
    }
    setShowNewModal(false);
    fetchEntries();
  };

  // UPDATE
  const handleUpdate = async (formData: GlossaryRowInput) => {
    if (!selectedTerm) return;

    // remove campos não persistentes
    const { id, parent_name, ...cleanData } = formData;

    const { error } = await supabase
      .from("glossary")
      .update(cleanData)
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
        title="Novo Termo"
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
        title="Editar Termo"
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
