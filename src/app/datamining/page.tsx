"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import BulletinsPage from "./bulletins/page";
import PlaceholderPage from "./placeholder/page";

export default function DataMiningPage() {
  const [selectedReport, setSelectedReport] = useState<string>("Bulletins");

  return (
    <div className="flex h-screen">
      <aside
        className="ml-2 flex w-64 min-w-[220px] max-w-[400px] resize-x flex-col overflow-hidden rounded-md border border-gray-700 bg-[#1e2a38] text-white shadow-sm"
      >
        <Sidebar selectedReport={selectedReport} setSelectedReport={setSelectedReport} />
      </aside>
      <div className="ml-2 flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-6 text-black">
        {selectedReport === "Bulletins" && <BulletinsPage />}
        {selectedReport === "Placeholder" && <PlaceholderPage />}
      </div>
    </div>
  );
}
