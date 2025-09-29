"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import BulletinsPage from "./bulletins/page";
import PlaceholderPage from "./placeholder/page";

export default function DataMiningPage() {
  const [selectedReport, setSelectedReport] = useState<string>("Bulletins");

  return (
    <div className="flex h-screen">
      <Sidebar selectedReport={selectedReport} setSelectedReport={setSelectedReport} />
      <div className="flex-1 overflow-y-auto">
        {selectedReport === "Bulletins" && <BulletinsPage />}
        {selectedReport === "Placeholder" && <PlaceholderPage />}
      </div>
    </div>
  );
}
