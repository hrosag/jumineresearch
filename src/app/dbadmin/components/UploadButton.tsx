"use client";
import { useState } from "react";

export default function UploadButton() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setSelectedFiles(filesArray);
      console.log("Arquivos selecionados:", filesArray.map(f => f.name));
    }
  };

  return (
    <div>
      {/* Botão estilizado */}
      <label className="mt-6 px-6 py-3 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 cursor-pointer inline-block">
        📂 Inserir Arquivos .txt
        <input
          type="file"
          multiple
          accept=".txt"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* Lista de arquivos selecionados */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h2 className="font-bold mb-2">Arquivos selecionados:</h2>
          <ul className="list-disc pl-6 text-sm">
            {selectedFiles.map((file, idx) => (
              <li key={idx}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
