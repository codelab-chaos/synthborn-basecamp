export type RecipeInput = {
  kind: string;
  id: string;
  quantity: number;
};

export type RecipeOutput = {
  kind: string;
  id: string;
  quantity: number;
};

export type BenchRequirement = {
  type?: string;
  id?: string;
  categories?: string[];
};

export type Recipe = {
  id: string;
  source?: string;
  sourceFile?: string;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  bench?: BenchRequirement[];
  timeSeconds?: number | null;
  knowledgeRequired?: boolean;
};

export type RecipesFile = {
  generatedAt: string;
  counts?: Record<string, number>;
  recipes: Recipe[];
};

export type LootDrop = {
  item: string;
  expected?: number;
  chancePct?: number | null;
  qtyMin?: number;
  qtyMax?: number;
};

export type LootBlock = {
  id: string;
  gatheringDefinedBy?: string;
  modes: Record<string, {
    gatherType?: string;
    droplistRef?: string;
    drops: LootDrop[];
  }>;
};

export type LootSource = {
  kind: string;
  id: string;
  mode?: string;
  expected?: number;
  chancePct?: number | null;
};

export type LootFile = {
  generatedAt: string;
  blocks: LootBlock[];
  droplists: { id: string }[];
  byItem: Record<string, LootSource[]>;
};

export type FindResult = {
  recipes: string[];
  outputs: string[];
  inputs: string[];
  blocks: string[];
  droplists: string[];
  droppedItems: string[];
};

export type MakeTreeLine = {
  depth: number;
  text: string;
  kind: "node" | "need" | "raw" | "cycle" | "limit";
};

export type MakeResult = {
  id: string;
  lines: MakeTreeLine[];
  raw: Record<string, number>;
};

export type TechTreeNode = {
  id: string;
  recipeId?: string;
  sourceFile?: string;
  bench?: BenchRequirement[];
  timeSeconds?: number | null;
  knowledgeRequired?: boolean;
  leaf?: boolean;
  resource?: boolean;
  cycle?: boolean;
  depthLimit?: boolean;
  children?: TechTreeChild[];
};

export type TechTreeChild = {
  kind: string;
  id: string;
  quantity: number;
  key: string;
  dependency: TechTreeNode;
};

export type TechTreeEntry = {
  id: string;
  leaves: { id: string; quantity: number }[];
  tree: TechTreeNode;
};

export type TechTreeFile = {
  title: string;
  generatedAt: string;
  targets: string[];
  trees: TechTreeEntry[];
};
