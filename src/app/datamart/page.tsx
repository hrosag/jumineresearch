"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "./components/Sidebar";

function LoadingBox() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-6 w-40 rounded bg-gray-200" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
      <div className="h-64 w-full rounded bg-gray-200" />
    </div>
  );
}

const CPCUniversePage = dynamic(
  () => import("./cpc-universe/page"),
  {
    loading: () => <LoadingBox />,
  },
);

export default function DataMartPage() {
  const [selectedReport, setSelectedReport] =
    useState<string>("cpc-universe");

  return (
    <div className="flex h-screen">
      <aside className="ml-2 flex min-w-[56px] max-w-[400px] rounded-md border border-gray-200 bg-[#1e2a38] text-white shadow-sm">
        <Sidebar
          selectedReport={selectedReport}
          setSelectedReport={setSelectedReport}
        />
      </aside>

      <div className="ml-2 flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-6 text-black">
        {selectedReport === "cpc-universe" && <CPCUniversePage />}
      </div>
    </div>
  );
}
