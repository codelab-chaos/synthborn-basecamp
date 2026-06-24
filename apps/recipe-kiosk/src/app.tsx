import {
  App as AntApp,
  AutoComplete,
  ConfigProvider,
  Flex,
  Input,
  Layout,
  Spin,
  Tabs,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BenchPanel } from "./components/bench-panel";
import { ItemDossier } from "./components/item-dossier";
import { ItemNavContext } from "./components/item-nav";
import { ItemSearchPanel } from "./components/item-search-panel";
import { IconAtlasProvider } from "./hooks/use-icon-atlas";
import { useHashRoute } from "./hooks/use-hash-route";
import { useRecipeData } from "./hooks/use-recipe-data";
import { ItemIcon } from "./components/ui/item-icon";
import type { ItemLinkVariant } from "./components/ui/item-link";
import { BasecampAppNav } from "@basecamp/library/basecamp-app-nav";
import { BasecampAppBadge } from "@basecamp/library/basecamp-app-badge";
import { APP_TITLE } from "./library/app-meta";
import { humanizeId } from "./library/humanize";
import { appTheme } from "./library/theme";
import "./styles/app.css";

const { Header, Content } = Layout;

const SUGGESTION_GROUPS = [
  { key: "outputIds", label: "Craftable" },
  { key: "inputIds", label: "Ingredients" },
] as const;

const SEE_ALL_PREFIX = "__see_all__:";
const VARIANT_STORAGE_KEY = "recipe-kiosk:item-variant";

function readStoredVariant(): ItemLinkVariant {
  try {
    return localStorage.getItem(VARIANT_STORAGE_KEY) === "chip" ? "chip" : "tile";
  } catch {
    return "tile";
  }
}

export function App() {
  const { loading, error, recipes, loot, catalog } = useRecipeData();
  const { route, focusItem, openSearch, openBench, setTab, setDossierSection } = useHashRoute();
  const [query, setQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [lastSearch, setLastSearch] = useState("");
  const [itemVariant, setItemVariant] = useState<ItemLinkVariant>(readStoredVariant);

  const selectedId = route.tab === "item" ? route.itemId : "";
  const tab = route.tab;
  const pattern = route.tab === "search" ? route.pattern : "";
  const dossierSection = route.tab === "item" ? route.section : "recipes";

  useEffect(() => {
    if (route.tab === "search" && route.pattern.trim()) setLastSearch(route.pattern);
  }, [route]);

  const changeItemVariant = useCallback((variant: ItemLinkVariant) => {
    setItemVariant(variant);
    try {
      localStorage.setItem(VARIANT_STORAGE_KEY, variant);
    } catch {
      // preference just won't persist
    }
  }, []);

  const nav = useMemo(() => ({
    focusItem: (id: string) => focusItem(id, "recipes"),
    focusBench: (benchReqId: string) => openBench(benchReqId),
  }), [focusItem, openBench]);

  const suggestions = useMemo(() => {
    if (!catalog || !query.trim()) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    const groups: { label: string; options: { value: string; label: React.ReactNode }[] }[] = SUGGESTION_GROUPS.map((group) => {
      const matches = catalog[group.key]
        .filter((id) => {
          if (seen.has(id) || !id.toLowerCase().includes(q)) return false;
          seen.add(id);
          return true;
        })
        .slice(0, 12);
      return {
        label: group.label,
        options: matches.map((id) => ({
          value: id,
          label: (
            <span className="suggestion-row">
              <span className="suggestion-label">
                <ItemIcon id={id} size={18} />
                {humanizeId(id)}
              </span>
              <span className="id-chip suggestion-id">{id}</span>
            </span>
          ),
        })),
      };
    }).filter((g) => g.options.length);

    // Make Enter-for-full-search discoverable — first row, always visible.
    groups.unshift({
      label: "",
      options: [{
        value: `${SEE_ALL_PREFIX}${query}`,
        label: (
          <span className="suggestion-row suggestion-see-all">
            <span>{`See all matches for "${query}"`}</span>
            <span className="suggestion-id">↵</span>
          </span>
        ),
      }],
    });
    return groups;
  }, [catalog, query]);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (error || !recipes || !loot || !catalog) {
    return (
      <Layout style={{ minHeight: "100vh", padding: 24 }}>
        <Typography.Title level={3}>{APP_TITLE}</Typography.Title>
        <Typography.Paragraph type="secondary">
          Failed to load recipe data. Run
          {" "}
          <code>npm run sync-data</code>
          {" "}
          in apps/recipe-kiosk.
          {error ? ` (${error})` : ""}
        </Typography.Paragraph>
      </Layout>
    );
  }

  const generatedAt = new Date(recipes.generatedAt).toLocaleDateString();
  const hytaleVersion = recipes.hytaleVersion ?? loot.hytaleVersion;

  return (
    <ConfigProvider theme={appTheme}>
      <AntApp>
        <IconAtlasProvider>
          <ItemNavContext.Provider value={nav}>
            <Layout className="basecamp-shell">
              <Header className="basecamp-header">
                <div className="basecamp-header-inner">
                  <div className="basecamp-header-layout">
                    <BasecampAppBadge app="recipeKiosk" variant="header-rail" />
                    <div className="basecamp-header-main">
                      <Flex align="center" wrap="wrap" gap={16} className="basecamp-header-row">
                        <Typography.Title level={4} className="basecamp-title">
                          {APP_TITLE}
                        </Typography.Title>
                        <div className="basecamp-header-end">
                          <BasecampAppNav current="recipeKiosk" />
                          <Typography.Text type="secondary" className="basecamp-stats">
                            {recipes.counts?.recipes ?? recipes.recipes.length}
                            {" "}
                            recipes
                            {hytaleVersion ? (
                              <>
                                {" · Hytale "}
                                {hytaleVersion}
                              </>
                            ) : null}
                            {" · "}
                            {generatedAt}
                          </Typography.Text>
                        </div>
                      </Flex>
                      <AutoComplete
                        className="app-omnibox"
                        options={suggestions}
                        value={query}
                        onChange={(value) => {
                          if (!value.startsWith(SEE_ALL_PREFIX)) setQuery(value);
                        }}
                        defaultActiveFirstOption={false}
                        open={suggestOpen}
                        onOpenChange={setSuggestOpen}
                        onSelect={(value) => {
                          setSuggestOpen(false);
                          if (value.startsWith(SEE_ALL_PREFIX)) {
                            const q = value.slice(SEE_ALL_PREFIX.length);
                            setQuery(q);
                            openSearch(q);
                            return;
                          }
                          setQuery("");
                          focusItem(value, "recipes");
                        }}
                        popupMatchSelectWidth={480}
                      >
                        <Input.Search
                          placeholder="Search items, recipes, blocks…"
                          allowClear
                          onSearch={(value) => {
                            if (!value.trim() || value.startsWith(SEE_ALL_PREFIX)) return;
                            openSearch(value);
                            setSuggestOpen(false);
                          }}
                        />
                      </AutoComplete>
                    </div>
                  </div>
                </div>
              </Header>

              <Content className="basecamp-main">
                <Tabs
                  className="app-tabs"
                  type="card"
                  size="large"
                  activeKey={tab}
                  onChange={(key) => setTab(key as "item" | "search" | "bench")}
                  items={[
                    {
                      key: "item",
                      label: "Item",
                      children: selectedId ? (
                        <ItemDossier
                          key={selectedId}
                          itemId={selectedId}
                          section={dossierSection}
                          onSectionChange={setDossierSection}
                          backToSearch={lastSearch ? {
                            pattern: lastSearch,
                            onClick: () => openSearch(lastSearch),
                          } : undefined}
                          itemVariant={itemVariant}
                          onItemVariantChange={changeItemVariant}
                          recipes={recipes.recipes}
                          loot={loot}
                          catalog={catalog}
                        />
                      ) : null,
                    },
                    {
                      key: "search",
                      label: "Search results",
                      children: (
                        <ItemSearchPanel pattern={pattern} recipes={recipes} loot={loot} />
                      ),
                    },
                    {
                      key: "bench",
                      label: "By bench",
                      children: (
                        <BenchPanel
                          recipes={recipes.recipes}
                          benchId={route.tab === "bench" ? route.benchId : undefined}
                          onBenchChange={openBench}
                        />
                      ),
                    },
                  ]}
                />
              </Content>
            </Layout>
          </ItemNavContext.Provider>
        </IconAtlasProvider>
      </AntApp>
    </ConfigProvider>
  );
}
