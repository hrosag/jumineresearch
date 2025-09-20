"use client";

type FileListProps = {
  files: { name: string; url: string; status?: string }[];
  checked: string[];
  toggleCheck: (name: string) => void;
  handleDepurarTodos: () => void;   // <<< AJUSTE >>> garantir tipagem
  handleDelete: (names: string[]) => void;
};

export default function FileList({
  files,
  checked,
  toggleCheck,
  handleDepurarTodos, // <<< AJUSTE >>> agora reconhecido
  handleDelete,
}: FileListProps) {
  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-2">Arquivos enviados</h2>

      {files.length === 0 ? (
        <p className="text-gray-500">Nenhum arquivo no bucket.</p>
      ) : (
        <div>
          <table className="table-auto w-full border text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-2 py-1 border">Selecionar</th>
                <th className="px-2 py-1 border">Nome do Arquivo</th>
                <th className="px-2 py-1 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name}>
                  <td className="px-2 py-1 border text-center">
                    <input
                      type="checkbox"
                      checked={checked.includes(f.name)}
                      onChange={() => toggleCheck(f.name)}
                    />
                  </td>
                  <td className="px-2 py-1 border">{f.name}</td>
                  <td className="px-2 py-1 border">{f.status ?? "pendente"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDepurarTodos}
              className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600"
            >
              🚀 Depurar Todos
            </button>

            <button
              onClick={() => handleDelete(checked)}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              disabled={checked.length === 0}
            >
              🗑️ Deletar Selecionados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
