"use client";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const reports = ["Bulletins", "Placeholder"];

  return (
    <div className="w-64 bg-[#1e2a38] text-white h-full p-4">
      <h2 className="text-lg font-bold mb-4">Data Mining</h2>
      <ul>
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
