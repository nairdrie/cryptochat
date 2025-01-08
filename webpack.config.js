const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: {
        background: './src/background.ts',
        content: './src/content/content.ts',
        popup: './src/popup/popup.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(), // Clean the dist folder before building
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/manifest.json', to: '.' },
                { from: 'src/assets', to: 'assets' },
                { from: 'src/**/*.html', to: '[name][ext]' },
                { from: 'src/**/*.css', to: '[name][ext]' }
            ],
        }),
    ],
};
