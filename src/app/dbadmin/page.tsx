"use client";
import { useEffect, useState } from "react";
import PasswordModal from "./components/PasswordModal";
import FileList from "./components/FileList"; // 👈 importamos aqui

type UploadedFile = {
  name: string;
  url: string;
  status?: "pendente" | "processado" | "removido";
};

export default function DBAdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [checked, setChecked] = useState<string[]>([]);

  // fetch dos arquivos
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch("/api/dbadmin/list");
        const data = await res.json();
        if (data.success) {
          setUploadedFiles(data.files);
        }
      } catch (err) {
        console.error("❌ Erro ao buscar arquivos:", err);
      }
    };
    fetchFiles();
  }, []);

  // toggle de checkboxes
  const toggleCheck = (name: string) => {
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // depurar em lote
  const handleDepurar = async (names: string[]) => {
    // mesma lógica que você já tinha
  };

  // deletar em lote
  const handleDelete = async (names: string[]) => {
    // mesma lógica que você já tinha
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {!authenticated ? (
        <div className="flex items-center justify-center h-screen">
          <PasswordModal onSuccess={() => setAuthenticated(true)} />
        </div>
      ) : (
        <main className="flex-1 p-10">
          <h1 className="text-2xl font-bold mb-6">
            ⚙️ Gestão do Banco de Dados (TSXV)
          </h1>

          {/* Upload aqui em cima */}
          {/* ... mantem seus handlers de upload */}

          {/* Lista usando o novo componente */}
          {uploadedFiles.length > 0 && (
            <FileList
              files={uploadedFiles}
              checked={checked}
              toggleCheck={toggleCheck}
              handleDepurar={handleDepurar}
              handleDelete={handleDelete}
            />
          )}
        </main>
      )}
    </div>
  );
}
