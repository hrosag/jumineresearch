"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// importa os componentes
import Sidebar from "./components/Sidebar";
import TermView from "./components/TermView";
import CrudModals from "./components/CrudModals";

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

  // estados dos modais
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch de dados
  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from("glossary")
      .select("*")
      .order("term");

    if (error) {
      console.error("Erro ao carregar termos:", error.message);
    } else if (data) {
      setEntries(data);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
      return;
    }

    const password = prompt("Digite a senha de administrador:");
    if (password === process.env.NEXT_PUBLIC_JRPEDIA_PASSWORD) {
      setIsAdmin(true);
    } else if (password) {
      alert("Senha incorreta");
    }
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
      />

      {/* Main panel */}
      <main className="flex-1 p-6 overflow-y-auto">
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
              onClick={handleAdminToggle}
              className={`px-3 py-1 rounded font-medium transition ${
                isAdmin
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {isAdmin ? "Sair do modo admin" : "Entrar como admin"}
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
          />
        )}
      </main>

      {/* Modais CRUD (visíveis só para admin) */}
      {isAdmin && (
        <CrudModals
          showNewModal={showNewModal}
          setShowNewModal={setShowNewModal}
          showEditModal={showEditModal}
          setShowEditModal={setShowEditModal}
          showDeleteModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          selectedTerm={selectedTerm}
          setSelectedTerm={setSelectedTerm}
          fetchEntries={fetchEntries}
        />
      )}
    </div>
  );
}
