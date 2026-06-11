import { ConfigProvider, Flex, Layout, Spin, theme, Typography } from "antd";
import { useLayoutEffect, useState } from "react";
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
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (error || !manifest) {
    return (
      <Layout style={{ minHeight: "100vh", padding: 24 }}>
        <Typography.Title level={3}>Prefab Preview Gallery</Typography.Title>
        <Typography.Paragraph type="secondary">
          Failed to load manifest.json. Run <code>npm run build-source</code> in apps/prefab-gallery first.
          {error ? ` (${error})` : ""}
        </Typography.Paragraph>
      </Layout>
    );
  }

  const generatedAt = new Date(manifest.generatedAt).toLocaleString();

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: "#101419",
          colorBgContainer: "#171d23",
          colorBorder: "#34404b",
          colorPrimary: "#c06f42",
          colorText: "#eef2f0",
          colorTextSecondary: "#9da8a8",
          borderRadius: 6,
        },
      }}
    >
      <Layout className="gallery-shell">
        <Header className="gallery-header">
          <Typography.Title level={3} style={{ margin: 0 }}>
            Prefab Preview Gallery
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
            Generated {generatedAt} · {manifest.entries.length} prefabs
          </Typography.Paragraph>
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
