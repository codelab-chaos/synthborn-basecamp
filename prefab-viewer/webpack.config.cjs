const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const projectRoot = __dirname;
const galleryRoot = path.resolve(projectRoot, "../../docs/prefab-gallery");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: path.join(projectRoot, "src/index.tsx"),
    output: {
      path: galleryRoot,
      filename: isProd ? "assets/[name].[contenthash:8].js" : "assets/[name].js",
      clean: {
        keep(asset) {
          return asset.startsWith("data/") || asset === "manifest.json";
        },
      },
      publicPath: "/",
    },
    devtool: isProd ? false : "eval-cheap-module-source-map",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: { loader: "ts-loader", options: { transpileOnly: true } },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      extensionAlias: {
        ".js": [".ts", ".tsx", ".js"],
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(projectRoot, "src/index.html"),
        filename: "index.html",
      }),
    ],
    watchOptions: {
      // Output lands in galleryRoot alongside thousands of voxel JSON files — do not watch them.
      ignored: ["**/prefab-gallery/data/**", "**/prefab-gallery/manifest.json"],
    },
    devServer: {
      static: [
        {
          directory: galleryRoot,
          watch: false,
        },
      ],
      port: 8878,
      hot: true,
      historyApiFallback: true,
      devMiddleware: {
        writeToDisk: true,
      },
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
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: "three",
            chunks: "all",
          },
        },
      },
    },
  };
};
