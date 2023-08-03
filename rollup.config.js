import path from 'path';
import appRootPath from 'app-root-path';
import typescript from 'rollup-plugin-typescript2';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';

import pakeCliDevPlugin from './plugins/pakeCliDevPlugin.js';

const isProduction = process.env.NODE_ENV === 'production';
const devPlugins = !isProduction ? [pakeCliDevPlugin()] : [];

export default {
  input: isProduction ? 'bin/cli.ts' : 'bin/dev.ts',
  output: {
    file: isProduction ? 'dist/cli.js' : 'dist/dev.js',
    format: 'es',
    sourcemap: !isProduction,
  },
  watch: {
    include: 'bin/**',
    exclude: 'node_modules/**',
  },
  plugins: [
    json(),
    typescript({
      tsconfig: "tsconfig.json",
      clean: true, // 清理缓存
    }),
    commonjs(),
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    alias({
      entries: [{ find: '@', replacement: path.join(appRootPath.path, 'bin') }],
    }),
    ...devPlugins,
  ],
};
