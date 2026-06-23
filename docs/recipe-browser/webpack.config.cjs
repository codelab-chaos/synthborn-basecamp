const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const appRoot = __dirname;

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: path.join(appRoot, "src/index.tsx"),
    output: {
      path: appRoot,
      filename: isProd ? "assets/[name].[contenthash:8].js" : "assets/[name].js",
      clean: {
        keep(asset) {
          if (asset.includes(".hot-update.")) return false; // sweep stale HMR chunks
          return !asset.startsWith("assets/") && asset !== "index.html";
        },
      },
      // Relative paths so Live Server / GitHub Pages subpaths work
      // (e.g. :5500/apps/recipe-browser/ → assets/*.js under that folder).
      publicPath: "",
    },
    devtool: isProd ? false : "eval-cheap-module-source-map",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: { loader: "ts-loader", options: { transpileOnly: true } },
          exclude: /node_modules/,
        },
        { test: /\.css$/, use: ["style-loader", "css-loader"] },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(appRoot, "src/index.html"),
        filename: "index.html",
      }),
    ],
    watchOptions: {
      ignored: ["**/recipe-browser/data/**"],
    },
    devServer: {
      static: [{ directory: appRoot, watch: false }],
      port: 8880,
      hot: true,
      historyApiFallback: true,
      devMiddleware: { writeToDisk: true },
    },
    optimization: {
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/](react|react-dom|antd|@ant-design|rc-)/,
            name: "vendor",
            chunks: "all",
          },
        },
      },
    },
  };
};
