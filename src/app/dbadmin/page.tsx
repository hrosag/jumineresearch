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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [checked, setChecked] = useState<string[]>([]);

  // fetch inicial dos arquivos
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

  // toggle de checkboxes individuais
  const toggleCheck = (name: string) => {
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // depurar em lote
  const handleDepurar = async (names: string[]) => {
    if (!names.length) return;
    console.log("🚧 Depuração chamada para:", names);
    // 👉 aqui entra a lógica real depois
  };

  // deletar em lote
  const handleDelete = async (names: string[]) => {
    if (!names.length) return;
    if (!confirm(`Tem certeza que deseja deletar ${names.length} arquivo(s)?`))
      return;

    try {
      for (const name of names) {
        const res = await fetch(`/api/dbadmin/delete?file=${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.success) {
          console.error("❌ Erro ao deletar", name, data.error);
        } else {
          console.log("✅ Arquivo deletado:", name);
        }
      }

      // Atualiza a lista removendo os deletados
      setUploadedFiles((prev) =>
        prev.filter((f) => !names.includes(f.name))
      );
      setChecked([]); // limpa seleção
    } catch (err) {
      console.error("🔥 Erro no handleDelete:", err);
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
            ⚙️ Gestão do Banco de Dados (TSXV)
          </h1>

          {/* Lista de arquivos */}
          <FileList
            files={uploadedFiles}
            checked={checked}
            toggleCheck={toggleCheck}
            handleDepurar={handleDepurar}
            handleDelete={handleDelete}
          />

          {/* Mensagem quando não tiver nada */}
          {uploadedFiles.length === 0 && (
            <p className="mt-4 text-gray-500">
              Nenhum arquivo enviado ainda. 🚀
            </p>
          )}
        </main>
      )}
    </div>
  );
}
