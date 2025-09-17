"use client";
import { useState } from "react";
import PasswordModal from "./components/PasswordModal";

export default function DBAdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<
    { name: string; url: string }[]
  >([]);

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
      console.log("📡 Resposta upload:", data);

      if (data.success) {
        alert(`✅ ${data.count} arquivo(s) enviados com sucesso!`);
        setUploadedFiles(data.files); // links vindos do Supabase
        setSelectedFiles([]); // limpa seleção
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {!authenticated && (
        <PasswordModal onSuccess={() => setAuthenticated(true)} />
      )}

      <main
        className={`flex-1 p-10 ${
          !authenticated ? "blur-sm pointer-events-none" : ""
        }`}
      >
        <h1 className="text-2xl font-bold mb-6">
          ⚙️ Gestão do Banco de Dados (TSXV)
        </h1>
        <p>Selecione os arquivos .txt para enviar ao Supabase.</p>

        {/* Seleção de arquivos ou pasta */}
        <div className="mt-6 space-y-4">
          <label className="block cursor-pointer text-blue-600 hover:underline">
            Selecionar arquivos
            <input
              type="file"
              accept=".txt"
              multiple
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
              multiple
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
                ✅ Confirmar envio
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
            <ul className="list-disc list-inside space-y-1 text-sm">
              {uploadedFiles.map((file) => (
                <li key={file.url}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
