"use client";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const reports = ["Bulletins", "Placeholder"];

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 px-3 text-lg font-bold">Data Mining</h2>
      <ul className="flex-1 space-y-1 px-2">
        {reports.map((r) => (
          <li key={r}>
            <button
              onClick={() => setSelectedReport(r)}
              className={`block w-full rounded px-2 py-1 text-left ${
                selectedReport === r ? "bg-[#d4af37] text-black" : "hover:bg-[#2e3b4a]"
              }`}
            >
              {r}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
