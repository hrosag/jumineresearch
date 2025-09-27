"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation"; // 👈 pega rota atual
import {
  LayoutDashboard,
  Database,
  BarChart3,
  AlertTriangle,
  BookOpenText,
  FlaskConical,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence, easeInOut } from "framer-motion";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [sandboxOpen, setSandboxOpen] = useState(true);
  const pathname = usePathname(); // 👈 rota atual

  // 🎨 animação base
  const fadeVariant = {
    initial: { opacity: 0, x: -10, color: "#666" },
    animate: { opacity: 1, x: 0, color: "#facc15" },
    exit: { opacity: 0, x: -10, color: "#666" },
    transition: { duration: 0.25, ease: easeInOut },
  };

  return (
    <aside
      className={`
        h-full bg-black text-[#d4af37] shadow-lg transition-all duration-300
        flex flex-col relative pt-4
        ${isOpen ? "w-64 px-6 pb-6" : "w-16 px-4 pb-4"}
      `}
    >
      {/* Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 right-2 text-yellow-400 hover:text-white"
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Título */}
      <AnimatePresence>
        {isOpen && (
          <motion.h1
            key="title"
            {...fadeVariant}
            onClick={() => setIsOpen(!isOpen)}
            className="text-2xl font-bold mb-8 cursor-pointer select-none hover:text-white transition-colors"
          >
            JUMine Research
          </motion.h1>
        )}
      </AnimatePresence>

      <nav className="flex flex-col gap-2 mt-12">
        {/* Links principais */}
        {[
          { href: "/", icon: LayoutDashboard, label: "Home" },
          { href: "/database", icon: Database, label: "Database" },
          { href: "/reports", icon: BarChart3, label: "Reports" },
          { href: "/warnings", icon: AlertTriangle, label: "Database Warning" },
          { href: "/jrpedia", icon: BookOpenText, label: "JRpedia" },
        ].map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href; // 👈 checa ativo

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-2 px-2 py-1 rounded-md transition-colors
                ${isActive ? "bg-yellow-500/20 text-white" : "hover:text-white"}
              `}
            >
              {/* Ícone */}
              <motion.div {...fadeVariant}>
                <Icon size={20} strokeWidth={2.5} />
              </motion.div>

              {/* Texto */}
              <AnimatePresence>
                {isOpen && (
                  <motion.span key={label} {...fadeVariant}>
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}

        {/* Sandbox */}
        <button
          onClick={() => setSandboxOpen(!sandboxOpen)}
          className={`
            flex items-center gap-2 px-2 py-1 rounded-md transition-colors
            ${pathname.startsWith("/sandbox") ? "bg-yellow-500/20 text-white" : "hover:bg-yellow-400 hover:text-black"}
          `}
        >
          <motion.div {...fadeVariant}>
            <FlaskConical size={20} strokeWidth={2.5} />
          </motion.div>
          <AnimatePresence>
            {isOpen && (
              <motion.span key="sandbox" {...fadeVariant}>
                Sandbox
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {sandboxOpen && isOpen && (
          <div className="ml-6 flex flex-col gap-1 text-sm text-yellow-300">
            <Link
              href="/sandbox/bulletins"
              className={`transition-colors ${pathname === "/sandbox/bulletins" ? "text-white" : "hover:text-white"}`}
            >
              - Bulletins
            </Link>
            <Link
              href="/sandbox/placeholder"
              className={`transition-colors ${pathname === "/sandbox/placeholder" ? "text-white" : "hover:text-white"}`}
            >
              - Em construção
            </Link>
            <Link
              href="/sandbox/whiteboard"
              className={`transition-colors ${pathname === "/sandbox/whiteboard" ? "text-white" : "hover:text-white"}`}
            >
              - Whiteboard
            </Link>
          </div>
        )}

        {/* About */}
        <Link
          href="/about"
          className={`
            flex items-center gap-2 px-2 py-1 rounded-md transition-colors
            ${pathname === "/about" ? "bg-yellow-500/20 text-white" : "hover:text-white"}
          `}
        >
          <motion.div {...fadeVariant}>
            <Info size={20} strokeWidth={2.5} />
          </motion.div>
          <AnimatePresence>
            {isOpen && (
              <motion.span key="about" {...fadeVariant}>
                About
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </nav>
    </aside>
  );
}
