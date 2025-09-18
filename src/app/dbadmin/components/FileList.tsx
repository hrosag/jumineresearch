"use client";
import React from "react";

type UploadedFile = {
  name: string;
  url: string;
  status?: "pendente" | "processado" | "removido";
};

interface FileListProps {
  files: UploadedFile[];
  checked: string[];
  toggleCheck: (name: string) => void;
  handleDepurar: (names: string[]) => void;
  handleDelete: (names: string[]) => void;
}

export default function FileList({
  files,
  checked,
  toggleCheck,
  handleDepurar,
  handleDelete,
}: FileListProps) {
  // marcar/desmarcar todos
  const toggleAll = () => {
    if (checked.length === files.length) {
      handleUncheckAll();
    } else {
      handleCheckAll();
    }
  };

  const handleCheckAll = () => {
    files.forEach((f) => {
      if (!checked.includes(f.name)) {
        toggleCheck(f.name);
      }
    });
  };

  const handleUncheckAll = () => {
    files.forEach((f) => {
      if (checked.includes(f.name)) {
        toggleCheck(f.name);
      }
    });
  };

  return (
    <div className="mt-6 bg-white p-4 rounded-lg shadow">
      <h2 className="font-semibold mb-2">🌐 Arquivos enviados:</h2>

      {files.length > 0 && (
        <>
          <label className="flex items-center space-x-2 mb-3">
            <input
              type="checkbox"
              checked={checked.length === files.length}
              onChange={toggleAll}
            />
            <span>Selecionar todos</span>
          </label>

          <div className="mb-4 flex space-x-2">
            <button
              onClick={() => handleDepurar(checked)}
              disabled={checked.length === 0}
              className={`px-3 py-1 rounded ${
                checked.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 text-white"
              }`}
            >
              Depurar Selecionados
            </button>

            <button
              onClick={() => handleDelete(checked)}
              disabled={checked.length === 0}
              className={`px-3 py-1 rounded ${
                checked.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-red-600 text-white"
              }`}
            >
              Deletar Selecionados
            </button>
          </div>
        </>
      )}

      {/* Lista de arquivos */}
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
          >
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={checked.includes(file.name)}
                onChange={() => toggleCheck(file.name)}
              />
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {file.name}
              </a>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  file.status === "processado"
                    ? "bg-green-200 text-green-800"
                    : file.status === "removido"
                    ? "bg-red-200 text-red-800"
                    : "bg-yellow-200 text-yellow-800"
                }`}
              >
                {file.status || "pendente"}
              </span>

              <button
                onClick={() => handleDepurar([file.name])}
                className="px-3 py-1 bg-green-500 text-white rounded"
              >
                Depurar
              </button>

              <button
                onClick={() => handleDelete([file.name])}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Deletar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
