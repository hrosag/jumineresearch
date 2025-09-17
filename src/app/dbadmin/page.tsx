"use client";
import { useState } from "react";
import PasswordModal from "./components/PasswordModal";

export default function DBAdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState(false);

  // seleção de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setUploaded(false);
    }
  };

  // seleção de pasta
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setUploaded(false);
    }
  };

  // confirma e envia
  const handleConfirm = async () => {
    if (selectedFiles.length === 0) return;

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
        setUploaded(true);
      } else {
        alert("⚠️ Falha ao enviar: " + data.error);
      }
    } catch (err) {
      console.error("Erro no upload:", err);
      alert("❌ Erro ao enviar arquivos!");
    }
  };

  // cancelar seleção
  const handleCancel = () => {
    setSelectedFiles([]);
    setUploaded(false);
  };

  // iniciar depuração (chamará o Python futuramente)
  const handleDebug = () => {
    alert("🚀 Iniciando depuração com Python...");
    // TODO: fetch("/api/dbadmin/debug") ou algo similar
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
        <p>Aqui vai ficar a interface de upload e gerenciamento dos .txt → .db</p>

        <div className="mt-6 space-y-4">
          <label className="block cursor-pointer text-blue-600 hover:underline">
            Selecionar arquivos
            <input
              type="file"
              multiple
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
              multiple
              onChange={handleFolderChange}
              className="hidden"
            />
          </label>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">📂 Arquivos selecionados:</h2>
            <ul className="list-disc list-inside space-y-1 text-sm max-h-60 overflow-y-auto">
              {selectedFiles.map((file) => (
                <li key={file.name + file.lastModified}>
                  {file.webkitRelativePath || file.name}
                </li>
              ))}
            </ul>

            <div className="flex space-x-4 mt-4">
              {!uploaded ? (
                <>
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
                </>
              ) : (
                <button
                  onClick={handleDebug}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  ▶️ Iniciar Depuração
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
