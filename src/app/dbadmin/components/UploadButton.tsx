"use client";
import { ChangeEvent, useState } from "react";

interface UploadButtonProps {
  onUploadComplete?: () => void | Promise<void>;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }

    const filesArray = Array.from(event.target.files);
    setSelectedFiles(filesArray);
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || uploading) {
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      setUploading(true);
      setErrorMessage(null);

      const response = await fetch("/api/dbadmin/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const message = result?.error ?? "Falha ao enviar arquivos.";
        console.error("Upload error:", message);
        setErrorMessage(message);
        return;
      }

      setSelectedFiles([]);
      if (onUploadComplete) {
        await onUploadComplete();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Unexpected upload error:", message);
      setErrorMessage("Erro inesperado ao enviar arquivos.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <label className="mt-6 px-6 py-3 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 cursor-pointer inline-block">
        Selecionar arquivos .txt
        <input
          type="file"
          multiple
          accept=".txt"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {errorMessage && (
        <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h2 className="font-bold mb-2">Arquivos selecionados</h2>
          <ul className="list-disc pl-6 text-sm mb-3">
            {selectedFiles.map((file, idx) => (
              <li key={idx}>{file.name}</li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`px-4 py-2 rounded text-white ${
              uploading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {uploading ? "Enviando..." : "Enviar arquivos"}
          </button>
        </div>
      )}
    </div>
  );
}