"use client";
import { useEffect, useState } from "react";
import PasswordModal from "./components/PasswordModal";
import FileList from "./components/FileList";

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

  // buscar arquivos já existentes
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch("/api/dbadmin/list");
        const data = await res.json();
        if (data.success) {
          setUploadedFiles(data.files);
        } else {
          console.error("⚠️ Erro ao listar arquivos:", data.error);
        }
      } catch (err) {
        console.error("❌ Erro inesperado ao buscar arquivos:", err);
      }
    };
    fetchFiles();
  }, []);

  // toggle dos checkboxes
  const toggleCheck = (name: string) => {
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // depurar arquivos
  const handleDepurar = async (names: string[]) => {
    for (const name of names) {
      try {
        const res = await fetch(`/api/dbadmin/depurar?file=${encodeURIComponent(name)}`, {
          method: "POST",
        });
        const data = await res.json();
        if (data.success) {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.name === name ? { ...f, status: "processado" } : f))
          );
        }
      } catch (err) {
        console.error("❌ Erro ao depurar:", err);
      }
    }
    setChecked([]);
  };

  // deletar arquivos
  const handleDelete = async (names: string[]) => {
    if (!confirm(`Tem certeza que deseja deletar ${names.length} arquivo(s)?`)) return;

    for (const name of names) {
      try {
        const res = await fetch(`/api/dbadmin/delete?file=${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (data.success) {
          // remove do estado local
          setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
        } else {
          alert(`⚠️ Erro ao deletar ${name}: ${data.error}`);
        }
      } catch (err) {
        console.error("❌ Erro ao deletar:", err);
        alert(`❌ Erro inesperado ao deletar ${name}`);
      }
    }

    setChecked([]);
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

          {/* lista de arquivos enviados */}
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
