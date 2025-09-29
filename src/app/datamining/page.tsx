"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import BulletinsPage from "./bulletins/page";
import PlaceholderPage from "./placeholder/page";

export default function DataMiningPage() {
  const [selectedReport, setSelectedReport] = useState<string>("Bulletins");

  return (
    <div className="flex h-screen">
      {/* Sidebar interno */}
      <div className="w-72 bg-[#1e2a38] text-white border-r border-gray-700">
        <Sidebar selectedReport={selectedReport} setSelectedReport={setSelectedReport} />
      </div>

      {/* Painel principal */}
      <div className="flex-1 bg-[#0f172a] text-white p-6">
        {selectedReport === "Bulletins" && <BulletinsPage />}
        {selectedReport === "Placeholder" && <PlaceholderPage />}
      </div>
    </div>
  );
}
