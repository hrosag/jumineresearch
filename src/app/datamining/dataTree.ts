export type ReportNode = {
  id: string;
  name: string;
  children?: ReportNode[];
};

export const reportTree: ReportNode[] = [
  {
    id: "bulletins",
    name: "Bulletins",
    children: [
      { id: "storytelling", name: "Storytelling" },
      { id: "sandbox", name: "Sandbox" },
    ],
  },
  { id: "placeholder", name: "Placeholder" },
];
