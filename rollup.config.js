import { readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'

import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import { dts } from 'rollup-plugin-dts'

const { dependencies = {}, peerDependencies = {} } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)
const externalPackages = Object.keys({ ...dependencies, ...peerDependencies })
const external = id => isBuiltin(id) || externalPackages.some(pkg => id === pkg || id.startsWith(`${pkg}/`))

export default defineConfig(
  ['index', 'browser'].flatMap(name => [
    // Keep each runtime entry self-contained for Node.js and browser consumers.
    {
      input: `src/${name}.ts`,
      output: [
        {
          file: `dist/${name}.js`,
          format: 'esm',
          sourcemap: true,
        },
        {
          file: `dist/${name}.cjs`,
          format: 'cjs',
          sourcemap: true,
          exports: 'named',
          interop: 'auto',
        },
      ],
      external,
      plugins: [
        typescript({
          tsconfig: './tsconfig.json',
          compilerOptions: {
            // Rollup owns JavaScript emission; tsc only checks types.
            noEmit: false,
            sourceMap: true,
            inlineSources: true,
          },
        }),
      ],
    },
    // Type declarations
    {
      input: `src/${name}.ts`,
      output: {
        file: `dist/${name}.d.ts`,
        format: 'esm',
      },
      external,
      plugins: [
        dts({
          tsconfig: './tsconfig.json',
        }),
      ],
    },
  ]),
)
