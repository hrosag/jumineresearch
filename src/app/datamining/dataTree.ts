export type ReportNode = {
  id: string;
  label: string;
  children?: ReportNode[];
  defaultExpanded?: boolean;
};

export const reportTree: ReportNode[] = [
  {
    id: "bulletins",
    label: "Bulletins",
    children: [
      { id: "notices", label: "Notices" },
      { id: "canonical-map", label: "Canonical Map" },
    ],
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    children: [
      { id: "new-listings", label: "New Issuers" },
    ],
  },
];
