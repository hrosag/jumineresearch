"use client";
import { useEffect, useState } from "react";
import PasswordModal from "./components/PasswordModal";

type UploadedFile = {
  name: string;
  url: string;
  status?: "pendente" | "processado" | "removido";
};

export default function DBAdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // carregar arquivos já existentes no bucket
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

  // seleção de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // seleção de pasta
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // confirmar upload
  const handleConfirm = async () => {
    if (selectedFiles.length === 0) {
      alert("Nenhum arquivo selecionado!");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/dbadmin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ ${data.count} arquivo(s) enviados com sucesso!`);
        setUploadedFiles((prev) => [
          ...prev,
          ...data.files.map((f: UploadedFile) => ({ ...f, status: "pendente" })),
        ]);
        setSelectedFiles([]);
      } else {
        alert(`⚠️ Falha ao enviar: ${data.error}`);
      }
    } catch (err) {
      alert("❌ Erro inesperado no upload.");
      console.error(err);
    }
  };

  // cancelar seleção
  const handleCancel = () => {
    setSelectedFiles([]);
  };

  // depurar arquivo (placeholder → Python)
  const handleDepurar = async (file: UploadedFile) => {
    try {
      const res = await fetch(`/api/dbadmin/depurar?file=${encodeURIComponent(file.name)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        alert(`🔍 Arquivo ${file.name} depurado com sucesso!`);
        setUploadedFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: "processado" } : f))
        );
      } else {
        alert(`⚠️ Erro ao depurar: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Erro inesperado na depuração.");
    }
  };

  // deletar arquivo do bucket
  const handleDelete = async (file: UploadedFile) => {
    if (!confirm(`Tem certeza que deseja deletar ${file.name}?`)) return;

    try {
      const res = await fetch(`/api/dbadmin/delete?file=${encodeURIComponent(file.name)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        alert(`🗑️ Arquivo ${file.name} removido com sucesso!`);
        setUploadedFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: "removido" } : f))
        );
      } else {
        alert(`⚠️ Erro ao remover: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Erro inesperado ao deletar.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {!authenticated && <PasswordModal onSuccess={() => setAuthenticated(true)} />}

      <main
        className={`flex-1 p-10 ${!authenticated ? "blur-sm pointer-events-none" : ""}`}
      >
        <h1 className="text-2xl font-bold mb-6">
          ⚙️ Gestão do Banco de Dados (TSXV)
        </h1>
        <p>Aqui vai ficar a interface de upload e gerenciamento dos .txt → .db</p>

        {/* Seleção de arquivos ou pasta */}
        <div className="mt-6 space-y-4">
          <label className="block cursor-pointer text-blue-600 hover:underline">
            Selecionar arquivos
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <label className="block cursor-pointer text-blue-600 hover:underline">
            Selecionar pasta
            <input
              type="file"
              ref={(input) => {
                if (input) {
                  input.setAttribute("webkitdirectory", "");
                  input.setAttribute("directory", "");
                }
              }}
              onChange={handleFolderChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Lista de arquivos selecionados */}
        {selectedFiles.length > 0 && (
          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">📂 Arquivos selecionados:</h2>
            <ul className="list-disc list-inside space-y-1 text-sm max-h-60 overflow-y-auto">
              {selectedFiles.map((file) => (
                <li key={file.name + file.lastModified}>{file.name}</li>
              ))}
            </ul>
            <div className="flex space-x-4 mt-4">
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                ✅ Confirmar
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de arquivos enviados */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">🌐 Arquivos enviados:</h2>
            <ul className="space-y-2 text-sm">
              {uploadedFiles.map((file) => (
                <li
                  key={file.url}
                  className="flex justify-between items-center bg-gray-50 p-3 rounded"
                >
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {file.name}
                  </a>
                  <div className="flex space-x-2 items-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        file.status === "processado"
                          ? "bg-green-200 text-green-800"
                          : file.status === "removido"
                          ? "bg-red-200 text-red-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {file.status}
                    </span>
                    <button
                      onClick={() => handleDepurar(file)}
                      className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                    >
                      Depurar
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                    >
                      Deletar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
