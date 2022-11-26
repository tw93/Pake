import path from 'path';
import appRootPath from 'app-root-path';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

const isDev = process.env.NODE_ENV !== "production";

export default {
  input: 'bin/cli.ts',
  output: {
    file: 'dist/cli.js',
    format: 'es'
  },
  plugins: [
    json(),
    typescript({
      sourceMap: false,
    }),
    commonjs(),
    alias({
      entries: [{ find: '@', replacement: path.join(appRootPath.path, 'bin') }],
    }),
    !isDev && terser(),
  ],
};
