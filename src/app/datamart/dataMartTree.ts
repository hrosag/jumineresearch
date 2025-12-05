// src/app/datamart/dataMartTree.ts
export type DataMartNode = {
  id: string;
  label: string;
  children?: DataMartNode[];
  defaultExpanded?: boolean;
};

// Sidebar interno do Data Mart
export const dataMartTree: DataMartNode[] = [
  {
    id: "capital-pool",
    label: "Capital Pools",
    defaultExpanded: true,
    children: [
      {
        id: "cpc-universe",
        label: "Capital Pool Company's",
      },
    ],
  },
];
