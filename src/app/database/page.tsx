"use client";

import Link from "next/link";

export default function DatabasePage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {/* TSX */}
      <div className="border p-6 rounded-lg shadow-md bg-gray-50">
        <h2 className="text-xl font-bold mb-4">TSX</h2>
        <p className="text-gray-500">🚧 Em construção</p>
      </div>

      {/* TSXV */}
      <div className="border p-6 rounded-lg shadow-md bg-gray-50">
        <h2 className="text-xl font-bold mb-4">TSXV</h2>

        <div className="flex flex-col gap-3">
          {/* Botão Público */}
          <Link href="/reports">
            <button className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-md">
              🔍 Visualizar Banco de Dados
            </button>
          </Link>

          {/* Botão Admin */}
          <Link href="/dbadmin">
            <button className="w-full py-2 bg-black hover:bg-gray-800 text-yellow-400 font-semibold rounded-md">
              ⚙️ Gerenciar Banco de Dados
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
