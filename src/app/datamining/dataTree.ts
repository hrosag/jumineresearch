export type ReportNode = {
  id: string;
  label: string;
  children?: ReportNode[];
  defaultExpanded?: boolean;
};

export const reportTree: ReportNode[] = [
  {
    id: "bulletins",
    label: "Boletins",
    defaultExpanded: true,
    children: [
      { id: "storytelling", label: "Storytelling" },
      { id: "sandbox", label: "Sandbox" },
    ],
  },
  {
    id: "placeholder",
    label: "Placeholder",
  },
];
