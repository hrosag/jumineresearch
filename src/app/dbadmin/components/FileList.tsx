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
      files.forEach((f) => toggleCheck(f.name));
    } else {
      files.forEach((f) => {
        if (!checked.includes(f.name)) toggleCheck(f.name);
      });
    }
  };

  return (
    <section className="mt-8 space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-gray-800">
          Arquivos enviados
        </h2>
        <p className="text-gray-500 text-sm">
          Gerencie os arquivos de entrada para processamento da base TSXV.
        </p>
      </header>

      <div className="rounded-xl bg-white shadow-xl p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-800 border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                  />{" "}
                  Selecionar todos
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Nome do Arquivo
                </th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {files.map((file, i) => (
                <tr
                  key={file.name}
                  className={i % 2 ? "bg-gray-50" : "bg-white"}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={checked.includes(file.name)}
                      onChange={() => toggleCheck(file.name)}
                    />
                  </td>
                  <td className="px-4 py-2 break-all">{file.name}</td>
                  <td className="px-4 py-2">{file.status || "pendente"}</td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-left text-gray-500 italic"
                  >
                    Nenhum arquivo enviado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de ações */}
        <div className="mt-6 flex justify-start gap-4">
          <button
            onClick={handleDepurarTodos}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-md shadow transition"
          >
            🛠️ Depurar
          </button>
          <button
            onClick={() => handleDelete(checked)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow transition"
          >
            🗑️ Deletar
          </button>
        </div>
      </div>
    </section>
  );
}
