import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

for (const browser of [false, true]) {
  for (const [sourceExtension, declarationExtension] of [
    ['mts', 'd.ts'],
    ['cts', 'd.cts'],
  ]) {
    const entry = browser ? 'browser' : 'index'

    test(`Node16 declarations (${entry}, ${sourceExtension})`, () => {
      const source = fileURLToPath(new URL(`./fixtures/types/consumer.${sourceExtension}`, import.meta.url))
      const program = ts.createProgram([source], {
        module: ts.ModuleKind.Node16,
        moduleResolution: ts.ModuleResolutionKind.Node16,
        target: ts.ScriptTarget.ES2022,
        customConditions: browser ? ['browser'] : [],
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      })
      const diagnostics = ts.getPreEmitDiagnostics(program)

      assert.equal(
        diagnostics.length,
        0,
        ts.formatDiagnostics(diagnostics, {
          getCurrentDirectory: ts.sys.getCurrentDirectory,
          getCanonicalFileName: fileName => fileName,
          getNewLine: () => '\n',
        }),
      )

      const declaration = fileURLToPath(new URL(`../dist/${entry}.${declarationExtension}`, import.meta.url))
      assert.ok(program.getSourceFile(declaration), `Expected TypeScript to resolve ${declaration}`)
    })
  }
}
