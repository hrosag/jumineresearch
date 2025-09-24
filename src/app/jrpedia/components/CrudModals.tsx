"use client";
import Modal from "./Modal";
import GlossaryForm from "./GlossaryForm";
import { createClient } from "@supabase/supabase-js";
import { CrudModalsProps, GlossaryRowInput } from "../types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CrudModals({
  showNewModal,
  setShowNewModal,
  newParentId,
  showEditModal,
  setShowEditModal,
  selectedTerm,
  fetchEntries,
}: CrudModalsProps) {
  return (
    <>
      {/* Novo */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="➕ Novo Termo"
      >
        <GlossaryForm
          initialParentId={newParentId}
          onCancel={() => setShowNewModal(false)}
          onSave={async (formData: GlossaryRowInput) => {
            await supabase.from("glossary").insert(formData);
            setShowNewModal(false);
            fetchEntries();
          }}
        />
      </Modal>

      {/* Editar */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="✏️ Editar Termo"
      >
        {selectedTerm && (
          <GlossaryForm
            initialData={selectedTerm}
            onCancel={() => setShowEditModal(false)}
            onSave={async (formData: GlossaryRowInput) => {
              await supabase.from("glossary").update(formData).eq("id", selectedTerm.id);
              setShowEditModal(false);
              fetchEntries();
            }}
          />
        )}
      </Modal>
    </>
  );
}
