var path = require("path");
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

var PATHS = {
    entryPoint: path.resolve(__dirname, 'src/index.ts'),
    bundles: path.resolve(__dirname, '_bundles'),
}

var config = {
    entry: {
        'ionic-on-fhir': [PATHS.entryPoint],
    },
    // When including the bundle in the browser it will be accessible at `window.ionic-fhir`
    output: {
        path: PATHS.bundles,
        filename: '[name].js',
        libraryTarget: 'umd',
        library: 'ionic-on-fhir',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    devtool: 'source-map',
    optimization: {
        minimizer: [
            // we specify a custom UglifyJsPlugin here to get source maps in production
            new UglifyJsPlugin({
              cache: true,
              parallel: true,
              uglifyOptions: {
                compress: false,
                ecma: 6,
                mangle: true
              },
              sourceMap: true
            })
          ]
    },
    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'awesome-typescript-loader',
            exclude: /node_modules/,
            query: {
                declaration: false,
            }
        }]
    }
}

module.exports = config;