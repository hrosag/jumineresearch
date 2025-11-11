export type ReportNode = {
  id: string;
  label: string;
  children?: ReportNode[];
  defaultExpanded?: boolean;
};

// "New Issuers" movido para Bulletins. Grupos começam expandidos.
export const reportTree: ReportNode[] = [
  {
    id: "bulletins",
    label: "Bulletins",
    defaultExpanded: true,
    children: [
      { id: "notices", label: "Notices" },
      { id: "canonical-map", label: "Canonical Map" },
      { id: "new-listings", label: "New Issuers" }, // movido
    ],
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    defaultExpanded: true,
    children: [
      { id: "cpc", label: "CPC Notices" },
    ],
  },
];
