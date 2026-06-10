import { theme } from "antd";

/**
 * Ant Design tokens — 8px grid, dark algorithm, component-level consistency.
 * Backgrounds are neutral gray so the blue item cards carry the color.
 * @see https://ant.design/docs/spec/layout
 */
export const appTheme = {
  algorithm: theme.darkAlgorithm,
  // Expose tokens as CSS variables (--ant-*) so app.css never hardcodes palette values.
  cssVar: { key: "recipe-browser" },
  token: {
    // Page stays neutral gray; containers are the original blue-dark so they
    // read as blue cards floating on gray.
    colorBgBase: "#27272a",
    colorBgContainer: "#161c24",
    colorBgElevated: "#1c242e",
    colorBorder: "#2c3845",
    colorBorderSecondary: "#222c37",
    colorPrimary: "#53a8e2",
    colorInfo: "#53a8e2",
    colorText: "#e8edf2",
    colorTextSecondary: "#9da8a8",
    borderRadius: 8,
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    lineHeight: 1.5715,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: "#11161d",
      headerHeight: 64,
      headerPadding: "0 24px",
      bodyBg: "#27272a",
      footerPadding: "16px 24px",
    },
    Card: {
      headerBg: "transparent",
      padding: 20,
      paddingLG: 24,
      headerHeight: 56,
      headerHeightSM: 48,
    },
    Tabs: {
      cardBg: "#161c24",
      itemSelectedColor: "#53a8e2",
      inkBarColor: "#53a8e2",
      titleFontSize: 14,
      titleFontSizeLG: 16,
      horizontalMargin: "0 0 24px 0",
      cardHeight: 48,
      cardPadding: "12px 20px",
      horizontalItemPadding: "12px 16px",
    },
    Segmented: {
      trackBg: "#1c242e",
      itemSelectedBg: "#2c3845",
      itemSelectedColor: "#e8edf2",
    },
    Tree: {
      indentSize: 20,
      titleHeight: 28,
    },
    Table: {
      cellPaddingBlockSM: 8,
      cellPaddingInlineSM: 12,
    },
    List: {
      itemPadding: "12px 0",
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 20,
    },
  },
};
