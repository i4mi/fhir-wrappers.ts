const path = require("path");
const helpers = require('./helpers');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

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
    plugins     : [

        // Workaround for Critical dependency 
        // The request of a dependency is an expression in ./node_modules/@angular/core/fesm5/core.js
        new webpack.ContextReplacementPlugin(
            /\@angular(\\|\/)core(\\|\/)fesm5/,
            helpers.root('./src'),
            {}
        )
    ],
    optimization: {
        minimizer: [
            // we specify a custom UglifyJsPlugin here to get source maps in production
            new TerserPlugin({
                parallel: true,
                terserOptions: {
                  ecma: 6,
                },
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