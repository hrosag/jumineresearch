import "./globals.css";
import Sidebar from "./sidebar";

export const metadata = {
  title: "JUMine Research",
  description: "Portal público de dados sobre Junior Mining Companies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen bg-gray-100">
        <Sidebar /> {/* 👈 carrega o Client Component */}
        <main className="flex-1 p-10">{children}</main>
      </body>
    </html>
  );
}
