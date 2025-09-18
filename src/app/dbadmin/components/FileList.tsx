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
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export default function FileList({
  files,
  checked,
  toggleCheck,
  handleDepurar,
  handleDelete,
  currentPage,
  setCurrentPage,
}: FileListProps) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(files.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFiles = files.slice(startIndex, startIndex + itemsPerPage);

  const toggleAll = () => {
    const allOnPage = paginatedFiles.map((f) => f.name);
    const allChecked = allOnPage.every((name) => checked.includes(name));

    if (allChecked) {
      // desmarca só os da página atual
      allOnPage.forEach((name) => toggleCheck(name));
    } else {
      // marca os da página atual
      allOnPage.forEach((name) => {
        if (!checked.includes(name)) toggleCheck(name);
      });
    }
  };

  return (
    <div className="mt-6 bg-white p-4 rounded-lg shadow">
      <h2 className="font-semibold mb-2">🌐 Arquivos enviados:</h2>

      {files.length > 0 && (
        <>
          <label className="flex items-center space-x-2 mb-3">
            <input
              type="checkbox"
              checked={paginatedFiles.every((f) => checked.includes(f.name))}
              onChange={toggleAll}
            />
            <span>Selecionar todos desta página</span>
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

      {/* Lista de arquivos paginada */}
      <ul className="space-y-2">
        {paginatedFiles.map((file) => (
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
          >
            ◀ Anterior
          </button>
          <span className="px-2 py-1">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
          >
            Próxima ▶
          </button>
        </div>
      )}
    </div>
  );
}
