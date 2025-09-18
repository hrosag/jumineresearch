"use client";
import { useEffect, useState } from "react";
import PasswordModal from "./components/PasswordModal";
import FileList from "./components/FileList";
import UploadButton from "./components/UploadButton";

type UploadedFile = {
  name: string;
  url: string;
  status?: "pendente" | "processado" | "removido";
};

export default function DBAdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [checked, setChecked] = useState<string[]>([]);

  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/dbadmin/list");
      const data = await res.json();
      if (data.success) {
        setUploadedFiles(data.files);
      }
    } catch (err) {
      console.error("Erro ao buscar arquivos:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const toggleCheck = (name: string) => {
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleDepurar = async (names: string[]) => {
    if (!names.length) return;
    console.log("Depuracao chamada para:", names);
    // TODO: implementar chamada real
  };

  const handleDelete = async (names: string[]) => {
    if (!names.length) return;
    if (!confirm(`Tem certeza que deseja deletar ${names.length} arquivo(s)?`))
      return;

    try {
      for (const name of names) {
        const res = await fetch(
          `/api/dbadmin/delete?file=${encodeURIComponent(name)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (!data.success) {
          console.error("Erro ao deletar", name, data.error);
        } else {
          console.log("Arquivo deletado:", name);
        }
      }

      setUploadedFiles((prev) => prev.filter((f) => !names.includes(f.name)));
      setChecked([]);
    } catch (err) {
      console.error("Erro no handleDelete:", err);
    }
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
            Gestao do Banco de Dados (TSXV)
          </h1>

          <UploadButton onUploadComplete={fetchFiles} />

          <FileList
            files={uploadedFiles}
            checked={checked}
            toggleCheck={toggleCheck}
            handleDepurar={handleDepurar}
            handleDelete={handleDelete}
          />

          {uploadedFiles.length === 0 && (
            <p className="mt-4 text-gray-500">Nenhum arquivo enviado ainda.</p>
          )}
        </main>
      )}
    </div>
  );
}