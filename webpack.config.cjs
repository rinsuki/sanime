/* eslint-disable @typescript-eslint/no-var-requires */
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const ResolveTypeScriptPlugin = require("resolve-typescript-plugin")

module.exports = {
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    entry: {
        top: "./src/frontend/top/index.tsx",
        show: "./src/frontend/show/index.tsx",
    },
    output: {
        path: __dirname + "/public/wp-content/themes/sanime/",
        filename: "[name].js",
        publicPath: "/wp-content/themes/sanime/",
    },
    module: {
        rules: [
            { test: /\.tsx?$/, loader: "ts-loader" },
            { test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"] },
        ],
    },
    devServer: {
        proxy: {
            "/": "http://localhost:3000",
        },
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        plugins: [new ResolveTypeScriptPlugin()],
    },
    plugins: [new MiniCssExtractPlugin()],
}
