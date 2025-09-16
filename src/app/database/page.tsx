"use client";
import { useState } from "react";

export default function DatabasePage() {
  const [status, setStatus] = useState("");

  const handleManageClick = () => {
    setStatus("🗂️ Aqui vai abrir a janela para gerenciar os arquivos .txt e gerar o banco .db");
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Coluna TSX */}
      <div className="p-6 bg-gray-100 rounded-lg border">
        <h2 className="text-2xl font-bold mb-4">TSX</h2>
        <p className="text-gray-600">🚧 Em construção</p>
      </div>

      {/* Coluna TSXV */}
      <div className="p-6 bg-white rounded-lg border shadow">
        <h2 className="text-2xl font-bold mb-4">TSXV</h2>
        <p className="mb-6">
          Nesta seção você poderá gerenciar e gerar bancos de dados a partir dos arquivos de Notices.
        </p>

        <button
          onClick={handleManageClick}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Gerenciar Banco de Dados
        </button>

        {status && <p className="mt-4 text-gray-700">{status}</p>}
      </div>
    </div>
  );
}
