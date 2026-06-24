import { ConfigProvider, Flex, Layout, Spin, Typography } from "antd";
import { useLayoutEffect, useState } from "react";
import { BasecampAppNav } from "@basecamp/library/basecamp-app-nav";
import { BasecampAppBadge } from "@basecamp/library/basecamp-app-badge";
import { basecampApps } from "@basecamp/library/basecamp-app-links";
import { basecampTheme } from "@basecamp/library/basecamp-theme";
import { resetGalleryVisibilityLayout } from "./hooks/use-element-visibility";
import { PrefabFilters } from "./components/prefab-filters";
import { PrefabGalleryGrid } from "./components/prefab-gallery-grid";
import { PrefabGalleryToolbar } from "./components/prefab-gallery-toolbar";
import { PrefabViewerModal } from "./components/prefab-viewer-modal";
import { useGalleryManifest } from "./hooks/use-gallery-manifest";
import { usePrefabFilter } from "./hooks/use-prefab-filter";
import type { PrefabEntry } from "./library/types";
import "./styles/gallery.css";

const { Header, Content } = Layout;

export function App() {
  const { manifest, error, loading } = useGalleryManifest();
  const [viewerEntry, setViewerEntry] = useState<PrefabEntry | null>(null);

  const filter = usePrefabFilter(manifest?.entries ?? []);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    resetGalleryVisibilityLayout();
  }, [filter.state.page]);

  if (loading) {
    return (
      <ConfigProvider theme={basecampTheme}>
        <Flex align="center" justify="center" className="basecamp-loading">
          <Spin size="large" />
        </Flex>
      </ConfigProvider>
    );
  }

  if (error || !manifest) {
    return (
      <ConfigProvider theme={basecampTheme}>
        <Layout className="basecamp-shell" style={{ padding: 24 }}>
        <Typography.Title level={4}>{basecampApps.prefabGallery.pageTitle}</Typography.Title>
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
      <Layout className="basecamp-shell">
        <Header className="basecamp-header">
          <div className="basecamp-header-inner">
            <div className="gallery-header-layout basecamp-header-layout">
              <BasecampAppBadge app="prefabGallery" variant="header-rail" />
              <div className="gallery-header-main basecamp-header-main">
                <Flex align="center" wrap="wrap" gap={16} className="basecamp-header-row">
                  <Typography.Title level={4} className="basecamp-title">
                    {basecampApps.prefabGallery.pageTitle}
                  </Typography.Title>
                  <div className="basecamp-header-end">
                    <BasecampAppNav current="prefabGallery" />
                    <Typography.Text type="secondary" className="basecamp-stats">
                      Generated {generatedAt} · {manifest.entries.length} prefabs
                    </Typography.Text>
                  </div>
                </Flex>
                <PrefabFilters
                  query={filter.state.query}
                  tags={filter.state.tags}
                  entries={manifest.entries}
                  tagList={manifest.tagList}
                  tagTree={manifest.tagTree}
                  onQueryChange={filter.setQuery}
                  onTagsChange={filter.setTags}
                />
                <PrefabGalleryToolbar
                  page={filter.state.page}
                  pageSize={filter.state.pageSize}
                  total={filter.filtered.length}
                  catalogTotal={manifest.entries.length}
                  totalPages={filter.totalPages}
                  onPageChange={filter.setPage}
                  onPageSizeChange={filter.setPageSize}
                />
              </div>
            </div>
          </div>
        </Header>

        <Content className="basecamp-main">
          <PrefabGalleryGrid
            entries={filter.pageEntries}
            activeTags={filter.state.tags}
            onTagSelect={filter.addTag}
            onExpand={setViewerEntry}
          />
        </Content>

        <PrefabViewerModal
          entry={viewerEntry}
          open={viewerEntry != null}
          onClose={() => setViewerEntry(null)}
        />
      </Layout>
    </ConfigProvider>
  );
}
