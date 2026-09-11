import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import { dts } from 'rollup-plugin-dts'

const external = [
  'chalk',
  'tslib',
  'fs',
  'path',
  'util',
  'node:fs',
  'node:path',
  'node:util',
  'node:process',
  'process',
]

export default defineConfig([
  // Main build for ESM and CJS
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'esm',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
        interop: 'auto',
      },
    ],
    external: id => {
      return external.some(dep => id === dep || id.startsWith(dep + '/'))
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        declaration: false,
        exclude: ['test/**/*', 'benchmark/**/*'],
        compilerOptions: {
          module: 'esnext',
        },
      }),
    ],
    treeshake: {
      moduleSideEffects: false,
    },
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts({
        tsconfig: './tsconfig.json',
      }),
    ],
  },
])
