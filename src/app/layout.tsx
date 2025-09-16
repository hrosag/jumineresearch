import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "JUMine Research",
  description: "Portal público de dados sobre Junior Mining Companies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen bg-gray-100">
        {/* Sidebar fixa */}
        <aside className="w-64 bg-black text-yellow-400 p-6 flex flex-col shadow-lg">
          <h1 className="text-2xl font-bold mb-8">JUMine Research</h1>
          <nav className="flex flex-col gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 hover:bg-yellow-400 hover:text-black px-2 py-1 rounded-md transition-colors"
            >
              🏠 Home
            </Link>
            <Link
              href="/database"
              className="flex items-center gap-2 hover:bg-yellow-400 hover:text-black px-2 py-1 rounded-md transition-colors"
            >
              🗄️ Database
            </Link>
            <Link
              href="/reports"
              className="flex items-center gap-2 hover:bg-yellow-400 hover:text-black px-2 py-1 rounded-md transition-colors"
            >
              📊 Reports
            </Link>
            <Link
              href="/about"
              className="flex items-center gap-2 hover:bg-yellow-400 hover:text-black px-2 py-1 rounded-md transition-colors"
            >
              ℹ️ About
            </Link>
          </nav>
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 p-10">{children}</main>
      </body>
    </html>
  );
}
