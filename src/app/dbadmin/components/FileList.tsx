"use client";
import React from "react";

type UploadedFile = {
  name: string;
  url: string;
  status?: "pendente" | "processado" | "removido";
};

type FileListProps = {
  files: UploadedFile[];
  checked: string[];
  toggleCheck: (name: string) => void;
  handleDepurar: (names: string[]) => Promise<void>;
  handleDelete: (names: string[]) => Promise<void>;
  handleDepurarTodos: () => Promise<void>;
};

export default function FileList({
  files,
  checked,
  toggleCheck,
  handleDepurar,
  handleDelete,
  handleDepurarTodos,
}: FileListProps) {
  const allChecked = files.length > 0 && checked.length === files.length;

  const toggleAll = () => {
    if (allChecked) {
      // desseleciona todos
      files.forEach((f) => toggleCheck(f.name));
    } else {
      // seleciona todos
      files.forEach((f) => {
        if (!checked.includes(f.name)) toggleCheck(f.name);
      });
    }
  };

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-2">Arquivos enviados</h2>

      <table className="table-auto border-collapse w-full text-sm bg-white shadow">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-4 py-2 text-left">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
              />{" "}
              Selecionar
            </th>
            <th className="border px-4 py-2 text-left">Nome do Arquivo</th>
            <th className="border px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.name} className="border-t">
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={checked.includes(file.name)}
                  onChange={() => toggleCheck(file.name)}
                />
              </td>
              <td className="px-4 py-2">{file.name}</td>
              <td className="px-4 py-2">{file.status || "pendente"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex gap-4">
        <button
          onClick={handleDepurarTodos}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded shadow"
        >
          🪄 Depurar Todos
        </button>
        <button
          onClick={() => handleDelete(checked)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
        >
          🗑️ Deletar Selecionados
        </button>
      </div>
    </div>
  );
}
