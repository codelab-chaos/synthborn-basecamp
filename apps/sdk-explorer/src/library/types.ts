export type SdkMember = {
  name: string;
  signature: string;
};

export type SdkCard = {
  id: string;
  package: string;
  file: string;
  className: string;
  kind: string;
  purpose: string;
  declaration: string;
  fields: SdkMember[];
  constructors: SdkMember[];
  methods: SdkMember[];
  code: string;
  markdown: string;
  searchText: string;
};

export type SdkReferenceData = {
  schemaVersion: 3;
  generatedAt: string;
  source: {
    path: string;
    hytaleVersion: string | null;
    jar: string | null;
    full: boolean | null;
  };
  counts: {
    packages: number;
    cards: number;
    fields: number;
    constructors: number;
    methods: number;
  };
  cards: SdkCard[];
};
