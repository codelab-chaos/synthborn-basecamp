export type PatternMatcher = {
  test: (value: string) => boolean;
};

export function makeMatcher(pattern: string): PatternMatcher {
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    return new RegExp(pattern.slice(1, -1), "i");
  }
  if (pattern.includes("*") || pattern.includes("?")) {
    const re = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${re}$`, "i");
  }
  const lower = pattern.toLowerCase();
  return { test: (s) => s.toLowerCase().includes(lower) };
}

export function resolveId(token: string, candidates: string[]) {
  const exact = candidates.find((c) => c.toLowerCase() === token.toLowerCase());
  if (exact) return { id: exact, matches: [exact] };
  const m = makeMatcher(token);
  const matches = candidates.filter((c) => m.test(c));
  if (matches.length === 1) return { id: matches[0], matches };
  return { id: null as string | null, matches };
}
