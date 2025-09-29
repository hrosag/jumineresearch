"use client";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const reports = ["Bulletins", "Placeholder"];

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-bold mb-4">Data Mining</h2>
      <ul className="flex-1 space-y-1">
        {reports.map((r) => (
          <li key={r}>
            <button
              onClick={() => setSelectedReport(r)}
              className={`block w-full text-left px-2 py-1 rounded ${
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
