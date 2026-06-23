import { ConfigProvider, Flex, Layout, Spin, Typography } from "antd";
import { useLayoutEffect, useState } from "react";
import { BasecampAppNav } from "@basecamp/library/basecamp-app-nav";
import { basecampApps } from "@basecamp/library/basecamp-app-links";
import { basecampTheme } from "@basecamp/library/basecamp-theme";
import { resetGalleryVisibilityLayout } from "./hooks/use-element-visibility";
import { PrefabFilters } from "./components/prefab-filters";
import { PrefabGalleryGrid } from "./components/prefab-gallery-grid";
import { PrefabGalleryToolbar } from "./components/prefab-gallery-toolbar";
import { PrefabViewerDrawer } from "./components/prefab-viewer-drawer";
import { useGalleryManifest } from "./hooks/use-gallery-manifest";
import { usePrefabFilter } from "./hooks/use-prefab-filter";
import type { PrefabEntry } from "./library/types";
import "./styles/gallery.css";

const { Header, Content } = Layout;

export function App() {
  const { manifest, error, loading } = useGalleryManifest();
  const [drawerEntry, setDrawerEntry] = useState<PrefabEntry | null>(null);

  const filter = usePrefabFilter(manifest?.entries ?? []);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    resetGalleryVisibilityLayout();
  }, [filter.state.page]);

  if (loading) {
    return (
      <ConfigProvider theme={basecampTheme}>
        <Flex align="center" justify="center" style={{ minHeight: "100vh", background: "#27272a" }}>
          <Spin size="large" />
        </Flex>
      </ConfigProvider>
    );
  }

  if (error || !manifest) {
    return (
      <ConfigProvider theme={basecampTheme}>
        <Layout style={{ minHeight: "100vh", padding: 24, background: "#27272a" }}>
        <Typography.Title level={3}>{basecampApps.prefabGallery.pageTitle}</Typography.Title>
        <Typography.Paragraph type="secondary">
          Failed to load manifest.json. Run <code>npm run build-source</code> in apps/prefab-gallery first.
          {error ? ` (${error})` : ""}
        </Typography.Paragraph>
      </Layout>
      </ConfigProvider>
    );
  }

  const generatedAt = new Date(manifest.generatedAt).toLocaleString();

  return (
    <ConfigProvider theme={basecampTheme}>
      <Layout className="gallery-shell">
        <Header className="gallery-header">
          <Flex align="flex-start" wrap="wrap" gap={16} className="gallery-header-top">
            <div className="gallery-header-copy">
              <Typography.Title level={3} style={{ margin: 0 }}>
                {basecampApps.prefabGallery.pageTitle}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
                Generated {generatedAt} · {manifest.entries.length} prefabs
              </Typography.Paragraph>
            </div>
            <div className="basecamp-header-end">
              <BasecampAppNav current="prefabGallery" />
            </div>
          </Flex>
          <div style={{ marginTop: 16 }}>
            <PrefabFilters
              query={filter.state.query}
              tags={filter.state.tags}
              entries={manifest.entries}
              tagList={manifest.tagList}
              tagTree={manifest.tagTree}
              onQueryChange={filter.setQuery}
              onTagsChange={filter.setTags}
            />
          </div>
          <PrefabGalleryToolbar
            page={filter.state.page}
            pageSize={filter.state.pageSize}
            total={filter.filtered.length}
            catalogTotal={manifest.entries.length}
            totalPages={filter.totalPages}
            onPageChange={filter.setPage}
            onPageSizeChange={filter.setPageSize}
          />
        </Header>

        <Content className="gallery-main">
          <PrefabGalleryGrid
            entries={filter.pageEntries}
            activeTags={filter.state.tags}
            onTagSelect={filter.addTag}
            onExpand={setDrawerEntry}
          />
        </Content>

        <PrefabViewerDrawer
          entry={drawerEntry}
          open={drawerEntry != null}
          onClose={() => setDrawerEntry(null)}
        />
      </Layout>
    </ConfigProvider>
  );
}
