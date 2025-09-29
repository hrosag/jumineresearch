"use client";

type SidebarProps = {
  selectedReport: string | null;
  setSelectedReport: (report: string) => void;
};

export default function Sidebar({ selectedReport, setSelectedReport }: SidebarProps) {
  const sections = [
    {
      name: "Bulletins",
      children: ["Storytelling", "Sandbox"],
    },
    { name: "Placeholder", children: [] },
  ];

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 px-3 text-lg font-bold">Data Mining</h2>
      <ul className="flex-1 space-y-2 px-2">
        {sections.map((section) => (
          <li key={section.name}>
            <div className="font-semibold mb-1">{section.name}</div>
            {section.children.length > 0 ? (
              <ul className="ml-4 space-y-1">
                {section.children.map((child) => (
                  <li key={child}>
                    <button
                      onClick={() => setSelectedReport(child)}
                      className={`block w-full rounded px-2 py-1 text-left ${
                        selectedReport === child
                          ? "bg-[#d4af37] text-black"
                          : "hover:bg-[#2e3b4a] text-white"
                      }`}
                    >
                      {child}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                onClick={() => setSelectedReport(section.name)}
                className={`block w-full rounded px-2 py-1 text-left ${
                  selectedReport === section.name
                    ? "bg-[#d4af37] text-black"
                    : "hover:bg-[#2e3b4a] text-white"
                }`}
              >
                {section.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
