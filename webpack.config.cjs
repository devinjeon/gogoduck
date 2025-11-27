/**
 * Author: @devinjeon (Hyojun Jeon)
 * Copyright (c) 2025 devinjeon (Hyojun Jeon)
 */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
    entry: './src/main.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|ico|m4a)$/i,
                type: 'asset/resource',
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
            filename: 'index.html',
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'assets', to: 'assets' },
                { from: 'favicon.ico', to: 'favicon.ico' },
                { from: 'qr-code.png', to: 'qr-code.png' },
                { from: 'thumb.png', to: 'thumb.png' },
            ],
        }),
        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),
    ],
    optimization: {
        minimizer: [
            // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
            `...`,
            new CssMinimizerPlugin(),
        ],
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
        hot: true,
    },
    performance: {
        maxAssetSize: 2000000, // 2MB
        maxEntrypointSize: 2000000, // 2MB
    },
};
