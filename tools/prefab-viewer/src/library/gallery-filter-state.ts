export type FilterState = {
  query: string;
  tags: string[];
  page: number;
  pageSize: number;
};

const STORAGE_KEY = "prefab-gallery-filter-state";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const defaultState: FilterState = {
  query: "",
  tags: [],
  page: 1,
  pageSize: 10,
};

function normalizePageSize(value: unknown) {
  const size = typeof value === "number" ? value : Number(value);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : defaultState.pageSize;
}

function normalizePage(value: unknown) {
  const page = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(page) || page < 1) return defaultState.page;
  return Math.floor(page);
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return defaultState.tags;
  return value.filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
}

export function readGalleryFilterState(): FilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<FilterState>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : defaultState.query,
      tags: normalizeTags(parsed.tags),
      page: normalizePage(parsed.page),
      pageSize: normalizePageSize(parsed.pageSize),
    };
  } catch {
    return defaultState;
  }
}

export function writeGalleryFilterState(state: FilterState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        query: state.query,
        tags: state.tags,
        page: normalizePage(state.page),
        pageSize: normalizePageSize(state.pageSize),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}
