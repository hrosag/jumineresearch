"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// importa os componentes
import Sidebar from "./components/Sidebar";
import TermView from "./components/TermView";
import CrudModals from "./components/CrudModals";
import PasswordModal from "../dbadmin/components/PasswordModal";

// importa os tipos
import { GlossaryRow, GlossaryNode, Lang } from "./types";

// ---------------------- Supabase Client ----------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------- Tree builder ----------------------
function buildTree(rows: GlossaryRow[]): GlossaryNode[] {
  const map = new Map<number, GlossaryNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));

  const roots: GlossaryNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// ---------------------- JRpedia Page ----------------------
export default function JRpediaPage() {
  const [entries, setEntries] = useState<GlossaryRow[]>([]);
  const [selectedLang, setSelectedLang] = useState<Lang>("pt");
  const [selectedTerm, setSelectedTerm] = useState<GlossaryRow | null>(null);

  // pesquisa global
  const [searchTerm, setSearchTerm] = useState("");

  // 🔑 Controle Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [shouldOpenCreateAfterLogin, setShouldOpenCreateAfterLogin] = useState(false);

  // estados dos modais
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newTermParentId, setNewTermParentId] = useState<number | null>(null);

  // Fetch de dados
  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from("glossary")
      .select("*")
      .order("term");

    if (error) {
      console.error("Erro ao carregar termos:", error.message);
    } else if (data) {
      const normalized = data.map((row) => ({
        ...row,
        fonte:
          typeof row.fonte === "string"
            ? row.fonte
            : row.fonte != null
            ? String(row.fonte)
            : "",
      })) as GlossaryRow[];

      setEntries(normalized);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSetShowNewModal = (value: boolean) => {
    setShowNewModal(value);
    if (!value) {
      setNewTermParentId(null);
      setShouldOpenCreateAfterLogin(false);
    }
  };

  const handleAddTerm = () => {
    const parentId = selectedTerm?.id ?? null;
    setNewTermParentId(parentId);

    if (!isAdmin) {
      setShouldOpenCreateAfterLogin(true);
      setShowPasswordModal(true);
      return;
    }

    setShouldOpenCreateAfterLogin(false);
    handleSetShowNewModal(true);
  };

  const handleExitAdmin = () => {
    setIsAdmin(false);
    handleSetShowNewModal(false);
  };

  // aplica pesquisa (em qualquer campo de tradução ou termo base)
  const filteredEntries = entries.filter((row) =>
    [row.term, row.pt, row.en, row.fr]
      .filter(Boolean)
      .some((val) => val!.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const tree = buildTree(filteredEntries);

  return (
    <div className="flex h-screen bg-[#fdf8f0]">
      {/* Sidebar */}
      <Sidebar
        tree={tree}
        selectedTerm={selectedTerm}
        setSelectedTerm={setSelectedTerm}
        selectedLang={selectedLang}
        onAddTerm={handleAddTerm}
      />

      {/* Main panel */}
      <main className="flex-1 border-l border-gray-300 shadow-inner px-6 py-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          {/* título */}
          <h1 className="text-2xl font-bold">JRpedia</h1>

          {/* barra do meio com pesquisa + idiomas */}
          <div className="flex items-center space-x-3">
            {/* campo pesquisa */}
            <input
              type="text"
              placeholder="Pesquisar termos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-1 text-sm"
            />

            {/* Idiomas */}
            <div className="flex space-x-2">
              {(["pt", "en", "fr"] as Lang[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-2 py-1 rounded ${
                    selectedLang === lang
                      ? "bg-[#d4af37] text-black font-bold"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  handleExitAdmin();
                  return;
                }

                setNewTermParentId(null);
                setShouldOpenCreateAfterLogin(false);
                setShowPasswordModal(true);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded text-lg font-medium transition ${
                isAdmin
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-green-100 text-green-600 hover:bg-green-200"
              }`}
              aria-label={isAdmin ? "Sair do modo admin" : "Entrar como admin"}
            >
              🔑
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {!selectedTerm ? (
          <p className="text-gray-500">
            Selecione um termo na barra lateral para visualizar.
          </p>
        ) : (
          <TermView
            selectedTerm={selectedTerm}
            selectedLang={selectedLang}
            isAdmin={isAdmin}
            onEditTerm={() => setShowEditModal(true)}
            onDeleteSuccess={() => {
              setSelectedTerm(null);
              fetchEntries();
            }}
          />
        )}
      </main>

      {/* Modais CRUD (visíveis só para admin) */}
      {isAdmin && (
        <CrudModals
          showNewModal={showNewModal}
          setShowNewModal={handleSetShowNewModal}
          newParentId={newTermParentId}
          showEditModal={showEditModal}
          setShowEditModal={setShowEditModal}
          selectedTerm={selectedTerm}
          fetchEntries={fetchEntries}
        />
      )}

      {showPasswordModal && (
        <PasswordModal
          onSuccess={() => {
            setIsAdmin(true);
            setShowPasswordModal(false);
            if (shouldOpenCreateAfterLogin) {
              handleSetShowNewModal(true);
            }
            setShouldOpenCreateAfterLogin(false);
          }}
          onClose={() => {
            setShowPasswordModal(false);
            setShouldOpenCreateAfterLogin(false);
            setNewTermParentId(null);
          }}
        />
      )}
    </div>
  );
}
