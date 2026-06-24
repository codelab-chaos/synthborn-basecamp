const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const appRoot = __dirname;
const sharedLibrary = path.join(appRoot, "..", "library");

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: path.join(appRoot, "src/index.tsx"),
    output: {
      path: appRoot,
      filename: isProd ? "assets/[name].[contenthash:8].js" : "assets/[name].js",
      clean: {
        keep(asset) {
          if (asset.includes(".hot-update.")) return false;
          return !asset.startsWith("assets/") && asset !== "index.html";
        },
      },
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
      modules: [path.join(appRoot, "node_modules"), "node_modules"],
      alias: {
        "@basecamp/library": sharedLibrary,
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(appRoot, "src/index.html"),
        filename: "index.html",
      }),
    ],
    watchOptions: {
      ignored: ["**/sdk-explorer/data/**"],
    },
    devServer: {
      static: [{ directory: appRoot, watch: false }],
      port: 8882,
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
