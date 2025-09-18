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
  // ✅ Mestre: marcar/desmarcar todos
  const allChecked = checked.length === files.length && files.length > 0;
  const isIndeterminate = checked.length > 0 && checked.length < files.length;

  const toggleAll = () => {
    if (allChecked) {
      // se já estavam todos, limpa
      files.forEach((f) => {
        if (checked.includes(f.name)) toggleCheck(f.name);
      });
    } else {
      // marca todos que ainda não estavam
      files.forEach((f) => {
        if (!checked.includes(f.name)) toggleCheck(f.name);
      });
    }
  };

  return (
    <div className="mt-6 bg-white p-4 rounded-lg shadow">
      <h2 className="font-semibold mb-2">🌐 Arquivos enviados:</h2>

      {/* Checkbox mestre */}
      <div className="flex items-center mb-3">
        <input
          type="checkbox"
          checked={allChecked}
          ref={(input) => {
            if (input) input.indeterminate = isIndeterminate;
          }}
          onChange={toggleAll}
        />
        <span className="ml-2 text-sm text-gray-700">Selecionar todos</span>
      </div>

      {/* Ações em massa */}
      {checked.length > 0 && (
        <div className="mb-3 flex space-x-2">
          <button
            onClick={() => handleDepurar(checked)}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded"
          >
            Depurar Selecionados
          </button>
          <button
            onClick={() => handleDelete(checked)}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded"
          >
            Deletar Selecionados
          </button>
        </div>
      )}

      <ul className="space-y-2 text-sm">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex justify-between items-center bg-gray-50 p-3 rounded"
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
                className="text-blue-600 hover:underline"
              >
                {file.name}
              </a>
            </div>
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
                onClick={() => handleDepurar([file.name])}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                Depurar
              </button>
              <button
                onClick={() => handleDelete([file.name])}
                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
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
