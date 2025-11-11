"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "./components/Sidebar";

function LoadingBox() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-6 w-40 rounded bg-gray-200" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
      <div className="h-64 w-full rounded bg-gray-200" />
    </div>
  );
}

const NoticesPage = dynamic(() => import("./bulletins/notices/page"), {
  loading: () => <LoadingBox />,
});
const CanonicalMapPage = dynamic(() => import("./bulletins/canonical-map/page"), {
  loading: () => <LoadingBox />,
});
const NewListingsPage = dynamic(() => import("./lifecycle/new-listings/page"), {
  loading: () => <LoadingBox />,
});
const CPCPage = dynamic(() => import("./lifecycle/cpc/page"), {
  loading: () => <LoadingBox />,
});

export default function DataMiningPage() {
  const [selectedReport, setSelectedReport] = useState<string>("notices");

  return (
    <div className="flex h-screen">
      <aside className="ml-2 flex min-w-[56px] max-w-[400px] resize-x flex-col overflow-hidden rounded-md border border-gray-200 bg-[#1e2a38] text-white shadow-sm">
        <Sidebar selectedReport={selectedReport} setSelectedReport={setSelectedReport} />
      </aside>
      <div className="ml-2 flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-6 text-black">
        {selectedReport === "notices" && <NoticesPage />}
        {selectedReport === "canonical-map" && <CanonicalMapPage />}
        {selectedReport === "new-listings" && <NewListingsPage />}
        {selectedReport === "cpc" && <CPCPage />}
      </div>
    </div>
  );
}
