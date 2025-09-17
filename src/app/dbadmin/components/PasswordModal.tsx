"use client";
import { useState } from "react";

type PasswordModalProps = {
  onSuccess: () => void;
};

export default function PasswordModal({ onSuccess }: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/dbadmin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setError("");
      onSuccess(); // ✅ libera dashboard
    } else {
      setError("Senha incorreta");
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={handleLogin}
        className="p-8 rounded-xl shadow-lg space-y-4 bg-white w-96"
      >
        <h1 className="text-xl font-bold text-center">
          🔑 Login DBAdmin – Banco de Dados
        </h1>
        <input
          type="password"
          placeholder="Digite a senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 w-full outline-none border rounded"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-black text-yellow-400 px-4 py-2 rounded w-full"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
