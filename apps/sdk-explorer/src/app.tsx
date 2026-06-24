import {
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Flex,
  Input,
  Layout,
  Pagination,
  Select,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BasecampAppBadge } from "@basecamp/library/basecamp-app-badge";
import { BasecampAppNav } from "@basecamp/library/basecamp-app-nav";
import { basecampApps } from "@basecamp/library/basecamp-app-links";
import { basecampTheme } from "@basecamp/library/basecamp-theme";
import { useSdkData } from "./hooks/use-sdk-data";
import type { SdkCard } from "./library/types";
import "./styles/sdk.css";

const { Header, Content } = Layout;
const DEFAULT_PAGE_SIZE = 12;
const REPO_BLOB_BASE = "https://github.com/codelab-chaos/synthborn-basecamp/blob/main";
const ROOT_NAMESPACE = "com.hypixel.hytale";
const MIN_NAMESPACE_DEPTH = ROOT_NAMESPACE.split(".").length + 1;
const JAVA_TOKEN_RE = /(\s+|[{}()[\];,<>?]|@[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*(?:[.$][A-Za-z_$][\w$]*)*)/g;
const JAVA_KEYWORDS = new Set([
  "abstract",
  "class",
  "default",
  "enum",
  "extends",
  "final",
  "implements",
  "interface",
  "native",
  "private",
  "protected",
  "public",
  "record",
  "static",
  "strictfp",
  "synchronized",
  "throws",
  "transient",
  "volatile",
]);
const JAVA_PRIMITIVES = new Set([
  "boolean",
  "byte",
  "char",
  "double",
  "float",
  "int",
  "long",
  "short",
  "void",
]);

type NamespaceFilterOption = {
  value: string;
  count: number;
};

function markdownHref(card: SdkCard): string {
  return `${REPO_BLOB_BASE}/docs/sdk/${encodeURIComponent(card.file)}`;
}

function kindColor(kind: string): string {
  if (kind === "interface") return "cyan";
  if (kind === "enum") return "gold";
  if (kind === "record") return "purple";
  if (kind === "annotation") return "magenta";
  return "blue";
}

function namespaceMatches(pkg: string, namespace: string): boolean {
  return !namespace || pkg === namespace || pkg.startsWith(`${namespace}.`);
}

function stripRootNamespace(namespace: string): string {
  const clean = namespace.trim().replace(/^\.+|\.+$/g, "");
  if (clean === ROOT_NAMESPACE) return "";
  if (clean.startsWith(`${ROOT_NAMESPACE}.`)) return clean.slice(ROOT_NAMESPACE.length + 1);
  return clean;
}

function qualifyNamespace(namespace: string): string {
  const clean = namespace.trim().replace(/^\.+|\.+$/g, "");
  if (!clean) return "";
  if (clean === ROOT_NAMESPACE || clean.startsWith(`${ROOT_NAMESPACE}.`)) return clean;
  if (clean.startsWith("com.")) return clean;
  return `${ROOT_NAMESPACE}.${clean}`;
}

function isSameOrChildNamespace(namespace: string, parentNamespace: string): boolean {
  return namespace === parentNamespace || namespace.startsWith(`${parentNamespace}.`);
}

function normalizeNamespaceValues(namespaces: string[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const namespace of namespaces) {
    const value = stripRootNamespace(namespace);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }

  return values.filter((value) => (
    !values.some((other) => other !== value && isSameOrChildNamespace(other, value))
  ));
}

function namespaceMatchesAny(pkg: string, namespaces: string[]): boolean {
  return namespaces.length === 0 || namespaces.some((namespace) => namespaceMatches(pkg, qualifyNamespace(namespace)));
}

function filterCardsByQuery(cards: SdkCard[], query: string): SdkCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter((card) => card.searchText.includes(q));
}

function filterCardsByNamespaces(cards: SdkCard[], namespaces: string[]): SdkCard[] {
  if (namespaces.length === 0) return cards;
  return cards.filter((card) => namespaceMatchesAny(card.package, namespaces));
}

function buildNamespaceOptions(cards: SdkCard[]): NamespaceFilterOption[] {
  const counts = new Map<string, number>();

  for (const card of cards) {
    const parts = card.package.split(".");
    for (let depth = MIN_NAMESPACE_DEPTH; depth <= parts.length; depth++) {
      const namespace = parts.slice(0, depth).join(".");
      counts.set(namespace, (counts.get(namespace) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([fullNamespace, count]) => ({
    value: stripRootNamespace(fullNamespace),
    count,
  }))
    .filter((option) => option.value)
    .sort((a, b) => a.value.localeCompare(b.value));
}

function tokenClass(token: string, line: string, endIndex: number): string {
  if (/^\s+$/.test(token)) return "";
  if (/^[{}()[\];,<>?]$/.test(token)) return "sdk-token-punctuation";
  if (token.startsWith("@")) return "sdk-token-annotation";
  if (JAVA_KEYWORDS.has(token) || JAVA_PRIMITIVES.has(token)) return "sdk-token-keyword";
  if (token.includes(".") || token.includes("$")) return "sdk-token-qualified";
  if (/^[A-Z_][A-Z0-9_]*$/.test(token)) return "sdk-token-generic";
  if (/^[A-Z]/.test(token)) return "sdk-token-type";
  if (line.slice(endIndex).trimStart().startsWith("(")) return "sdk-token-method";
  return "sdk-token-identifier";
}

function renderQualifiedToken(token: string, key: string): ReactNode {
  const parts = token.split(/([.$])/);
  let lastWordIndex = -1;
  for (let index = parts.length - 1; index >= 0; index--) {
    if (/^[A-Za-z_$][\w$]*$/.test(parts[index])) {
      lastWordIndex = index;
      break;
    }
  }

  return (
    <span key={key} className="sdk-token-qualified">
      {parts.map((part, index) => (
        index === lastWordIndex
          ? <span key={`${key}:${index}`} className="sdk-token-type">{part}</span>
          : part
      ))}
    </span>
  );
}

function renderJavaToken(token: string, line: string, startIndex: number, key: string): ReactNode {
  const className = tokenClass(token, line, startIndex + token.length);
  if (className === "sdk-token-qualified") return renderQualifiedToken(token, key);
  return (
    <span key={key} className={className || undefined}>
      {token}
    </span>
  );
}

function highlightJavaLine(line: string, lineIndex: number): ReactNode[] {
  const tokens: ReactNode[] = [];
  JAVA_TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  let tokenIndex = 0;
  let match = JAVA_TOKEN_RE.exec(line);

  while (match) {
    const token = match[0];
    if (match.index > cursor) {
      const raw = line.slice(cursor, match.index);
      tokens.push(renderJavaToken(raw, line, cursor, `${lineIndex}:raw:${tokenIndex}`));
      tokenIndex++;
    }
    tokens.push(renderJavaToken(token, line, match.index, `${lineIndex}:${tokenIndex}`));
    tokenIndex++;
    cursor = match.index + token.length;
    match = JAVA_TOKEN_RE.exec(line);
  }

  if (cursor < line.length) {
    tokens.push(renderJavaToken(line.slice(cursor), line, cursor, `${lineIndex}:tail`));
  }

  return tokens;
}

function JavaCodeBlock({ code }: { code: string }) {
  return (
    <pre className="sdk-code">
      <code>
        {code.split("\n").map((line, lineIndex) => (
          <span key={lineIndex} className="sdk-code-line">
            {highlightJavaLine(line, lineIndex)}
          </span>
        ))}
      </code>
    </pre>
  );
}

function SdkMarkdownCard({ card }: { card: SdkCard }) {
  return (
    <Card
      className="sdk-card"
      title={(
        <Flex align="center" gap={8} wrap="wrap">
          <Typography.Text strong className="sdk-card-title">{card.className}</Typography.Text>
          <Tag color={kindColor(card.kind)}>{card.kind}</Tag>
        </Flex>
      )}
      extra={(
        <Button size="small" href={markdownHref(card)} target="_blank" rel="noreferrer">
          GitHub
        </Button>
      )}
    >
      <Typography.Text type="secondary" className="sdk-card-package">
        {card.package}
      </Typography.Text>
      {card.purpose ? (
        <Typography.Paragraph type="secondary" className="sdk-card-purpose">
          {card.purpose}
        </Typography.Paragraph>
      ) : null}
      <JavaCodeBlock code={card.code} />
    </Card>
  );
}

export function App() {
  const { loading, error, data } = useSdkData();
  const [query, setQuery] = useState("");
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespaceOpen, setNamespaceOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const searchMatchedCards = useMemo(() => (
    data ? filterCardsByQuery(data.cards, query) : []
  ), [data, query]);

  const namespaceOptions = useMemo(() => (
    buildNamespaceOptions(searchMatchedCards)
  ), [searchMatchedCards]);

  const filteredCards = useMemo(() => (
    filterCardsByNamespaces(searchMatchedCards, namespaces)
  ), [namespaces, searchMatchedCards]);

  const pageCards = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, page, pageSize]);

  if (loading) {
    return (
      <ConfigProvider theme={basecampTheme}>
        <Flex align="center" justify="center" className="basecamp-loading">
          <Spin size="large" />
        </Flex>
      </ConfigProvider>
    );
  }

  if (error || !data) {
    return (
      <ConfigProvider theme={basecampTheme}>
        <Layout className="basecamp-shell sdk-error">
          <Typography.Title level={4}>{basecampApps.sdkExplorer.pageTitle}</Typography.Title>
          <Typography.Paragraph type="secondary">
            Failed to load SDK data. Run <code>npm run sync-data</code> in apps/sdk-explorer.
            {error ? ` (${error})` : ""}
          </Typography.Paragraph>
        </Layout>
      </ConfigProvider>
    );
  }

  const generatedAt = new Date(data.generatedAt).toLocaleDateString();

  return (
    <ConfigProvider theme={basecampTheme}>
      <AntApp>
        <Layout className="basecamp-shell sdk-shell">
          <Header className="basecamp-header">
            <div className="basecamp-header-inner">
              <div className="basecamp-header-layout">
                <BasecampAppBadge app="sdkExplorer" variant="header-rail" />
                <div className="basecamp-header-main">
                  <Flex align="center" wrap="wrap" gap={16} className="basecamp-header-row">
                    <Typography.Title level={4} className="basecamp-title">
                      {basecampApps.sdkExplorer.pageTitle}
                    </Typography.Title>
                    <div className="basecamp-header-end">
                      <BasecampAppNav current="sdkExplorer" />
                      <Typography.Text type="secondary" className="basecamp-stats">
                        {data.counts.cards.toLocaleString()} cards
                        {data.source.hytaleVersion ? ` · Hytale ${data.source.hytaleVersion}` : ""}
                        {" · "}
                        {generatedAt}
                      </Typography.Text>
                    </div>
                  </Flex>
                  <Input.Search
                    allowClear
                    className="sdk-search"
                    value={query}
                    placeholder="Search packages, classes, declarations, fields, constructors, methods"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    onSearch={(value) => {
                      setQuery(value);
                      setPage(1);
                    }}
                  />
                  <div className="sdk-filter-row">
                    <Select
                      allowClear
                      showSearch
                      mode="tags"
                      className="sdk-namespace-select"
                      value={namespaces}
                      open={namespaceOpen}
                      placeholder="Filter by namespaces"
                      optionFilterProp="value"
                      optionLabelProp="value"
                      tokenSeparators={[","]}
                      onDropdownVisibleChange={setNamespaceOpen}
                      onSelect={() => window.setTimeout(() => setNamespaceOpen(false), 0)}
                      onChange={(value) => {
                        setNamespaces(normalizeNamespaceValues(value));
                        window.setTimeout(() => setNamespaceOpen(false), 0);
                        setPage(1);
                      }}
                      options={namespaceOptions.map((option) => ({
                        value: option.value,
                        label: (
                          <span className="sdk-namespace-option">
                            <span className="sdk-namespace-option__name">{option.value}</span>
                            <span className="sdk-namespace-option__count">{option.count.toLocaleString()}</span>
                          </span>
                        ),
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Header>

          <Content className="basecamp-main sdk-main">
            <Flex align="center" justify="space-between" gap={12} wrap="wrap" className="sdk-results-bar">
              <Typography.Text type="secondary">
                {filteredCards.length.toLocaleString()} result{filteredCards.length === 1 ? "" : "s"}
                {query.trim() ? ` for "${query.trim()}"` : ""}
                {namespaces.length === 1 ? ` in ${namespaces[0]}` : ""}
                {namespaces.length > 1 ? ` in ${namespaces.length} namespaces` : ""}
              </Typography.Text>
            </Flex>

            <Flex justify="end" className="sdk-top-pagination">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filteredCards.length}
                showSizeChanger
                pageSizeOptions={[6, 12, 24, 48]}
                onChange={(nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize);
                }}
              />
            </Flex>

            {pageCards.length ? (
              <div className="sdk-card-grid">
                {pageCards.map((card) => (
                  <SdkMarkdownCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="sdk-empty" />
            )}

            {filteredCards.length > pageSize ? (
              <Flex justify="end" className="sdk-bottom-pagination">
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={filteredCards.length}
                  showSizeChanger
                  pageSizeOptions={[6, 12, 24, 48]}
                  onChange={(nextPage, nextPageSize) => {
                    setPage(nextPage);
                    setPageSize(nextPageSize);
                  }}
                />
              </Flex>
            ) : null}
          </Content>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}
