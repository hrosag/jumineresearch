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
  showDeleteModal,
  setShowDeleteModal,
  selectedTerm,
  setSelectedTerm,
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

      {/* Excluir */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="🗑 Excluir Termo"
      >
        {selectedTerm && (
          <div>
            <p>
              Tem certeza que deseja excluir <b>{selectedTerm.term}</b>?
            </p>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await supabase.from("glossary").delete().eq("id", selectedTerm.id);
                  setSelectedTerm(null);
                  setShowDeleteModal(false);
                  fetchEntries();
                }}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
