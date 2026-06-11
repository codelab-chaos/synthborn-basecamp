const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const galleryRoot = __dirname;

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: path.join(galleryRoot, "src/index.tsx"),
    externals: {
      three: "THREE",
    },
    output: {
      path: galleryRoot,
      filename: isProd ? "assets/[name].[contenthash:8].js" : "assets/[name].js",
      clean: {
        keep(asset) {
          // Source, scripts, and generated gallery blobs live alongside the build output.
          return !asset.startsWith("assets/") && asset !== "index.html";
        },
      },
      // Relative in prod so index.html works under a GitHub Pages subpath; absolute in dev.
      publicPath: isProd ? "" : "/",
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
        template: path.join(galleryRoot, "src/index.html"),
        filename: "index.html",
      }),
    ],
    watchOptions: {
      ignored: [
        "**/prefab-gallery/data/**",
        "**/prefab-gallery/previews/**",
        "**/prefab-gallery/manifest.json",
      ],
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
        },
      },
    },
  };
};
