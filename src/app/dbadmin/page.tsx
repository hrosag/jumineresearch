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

  // ----- busca lista de arquivos enviados -----
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

  // ----- seleção de arquivos -----
  const toggleCheck = (name: string) => {
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // ======= ✅ NOVA FUNÇÃO: depurar todos de uma vez =======
  const handleDepurarTodos = async () => {
    try {
      const resp = await fetch(`/api/dbadmin/depurar`, { method: "POST" });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        console.error("Erro ao depurar todos", data.error);
      } else {
        console.log("✅ Depuração concluída para todos os arquivos do bucket");
        setUploadedFiles((prev) =>
          prev.map((f) => ({ ...f, status: "processado" }))
        );
      }
    } catch (err) {
      console.error("Falha ao chamar depurar todos", err);
    }
  };

  // ----- deletar arquivos -----
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

  // ----- depurar arquivos selecionados -----
  const handleDepurar = async (names: string[]) => {
    if (!names.length) return;
    try {
      for (const name of names) {
        const res = await fetch(
          `/api/dbadmin/depurar?file=${encodeURIComponent(name)}`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!data.success) {
          console.error("Erro ao depurar", name, data.error);
        } else {
          console.log("Arquivo depurado:", name);
        }
      }
    } catch (err) {
      console.error("Erro no handleDepurar:", err);
    }
  };

  // ----- renderização -----
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {!authenticated ? (
        <div className="flex items-center justify-center h-screen">
          <PasswordModal onSuccess={() => setAuthenticated(true)} />
        </div>
      ) : (
        <main className="flex-1 p-10">
          <h1 className="text-2xl font-bold mb-6">
            Gestão do Banco de Dados (TSXV)
          </h1>

          <UploadButton onUploadComplete={fetchFiles} />

          {/* <<< AJUSTE >>> Passa handleDepurarTodos */}
          <FileList
            files={uploadedFiles}
            checked={checked}
            toggleCheck={toggleCheck}
            handleDepurar={handleDepurar}
            handleDepurarTodos={handleDepurarTodos}
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
