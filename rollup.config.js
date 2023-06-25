import path from 'path';
import appRootPath from 'app-root-path';
import typescript from 'rollup-plugin-typescript2';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'bin/cli.ts',
  output: {
    file: 'dist/cli.js',
    format: 'es'
  },
  plugins: [
    json(),
    typescript({
      tsconfig: "tsconfig.json",
      clean: true, // 清理缓存
    }),
    commonjs(),
    alias({
      entries: [{ find: '@', replacement: path.join(appRootPath.path, 'bin') }],
    }),
  ],
};
