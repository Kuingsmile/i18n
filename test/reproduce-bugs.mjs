/**
 * Run from any directory: node /path/to/i18n/test/reproduce-bugs.mjs
 * From the repository root: node test/reproduce-bugs.mjs
 *
 * Uses the installed dev dependencies and rebuilds dist before checking the ten
 * audit findings. It does not modify package.json, source files, or existing tests.
 * Fixtures live in a temporary directory and are removed when the script finishes.
 * Only synthetic inputs and summarized diagnostics are printed, never file contents.
 *
 * Exit codes: 0 = no bugs reproduced; 1 = bugs reproduced; 2 = a probe/build failed.
 * NOT REPRODUCED means this probe met its expectation, not proof of every edge case.
 * The browser probe inspects an actual browser-targeted bundle; it does not launch
 * a browser. Runtime probes exercise both the ESM and CommonJS package builds.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspect, isDeepStrictEqual } from 'node:util'
import { runInNewContext } from 'node:vm'

import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requireFromProject = createRequire(new URL('../package.json', import.meta.url))
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const tempParent = fs.realpathSync(os.tmpdir())
const tempRoot = fs.mkdtempSync(path.join(tempParent, 'piclist-i18n-reproduce-'))
const results = []
const restoreLoggers = []

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  })
  if (result.error || result.signal || result.status === null) {
    throw new Error('A child process could not complete within 60 seconds')
  }
  // Child output may contain file contents; callers may inspect it but never print it.
  return result
}

function check(label, expected, actual) {
  return { label, expected, actual, matches: isDeepStrictEqual(expected, actual) }
}

function observe(callback) {
  try {
    return { returns: callback() }
  } catch (error) {
    return { throws: error.name, ...(error.code ? { code: error.code } : {}) }
  }
}

function valueCheck(label, expected, callback) {
  return check(label, { returns: expected }, observe(callback))
}

function fixture(name, files) {
  const directory = path.join(tempRoot, name)
  fs.mkdirSync(directory)
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), content)
  }
  return directory
}

async function probe(id, severity, title, callback) {
  try {
    const checks = await callback()
    if (!checks.length) throw new Error('No checks ran')
    const reproduced = checks.some(item => !item.matches)
    results.push({ id, status: reproduced ? 'REPRODUCED' : 'NOT REPRODUCED' })
    console.log(`\n[${reproduced ? 'REPRODUCED' : 'NOT REPRODUCED'}] ${id}. ${severity} ${title}`)
    for (const item of checks) {
      console.log(`  ${item.matches ? 'OK' : 'BUG'} ${item.label}`)
      console.log(`    expected: ${inspect(item.expected, { colors: false, depth: 4, breakLength: Infinity })}`)
      console.log(`    observed: ${inspect(item.actual, { colors: false, depth: 4, breakLength: Infinity })}`)
    }
  } catch (error) {
    results.push({ id, status: 'ERROR' })
    console.log(`\n[ERROR] ${id}. ${severity} ${title}: ${error.name}; probe could not complete`)
  }
}

function compile(source) {
  // A virtual consumer inside this package tests its real package exports and
  // generated declarations, without adding a file to the working tree.
  const filename = path.join(root, 'test', '__reproduce_consumer__.ts').replaceAll('\\', '/')
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const isVirtual = file => file.replaceAll('\\', '/') === filename
  host.readFile = file => (isVirtual(file) ? source : readFile(file))
  host.fileExists = file => isVirtual(file) || fileExists(file)
  const program = ts.createProgram([filename], options, host)
  return ts.getPreEmitDiagnostics(program).map(diagnostic => diagnostic.code)
}

async function main() {
  console.log(`i18n bug reproductions | Node ${process.version}`)
  console.log('Rebuilding dist with the installed Rollup configuration...')
  const build = runNode([path.join(root, 'node_modules/rollup/dist/bin/rollup'), '-c'])
  if (build.status !== 0) throw new Error('Build failed; run npm run build to investigate')

  const implementations = [
    ['ESM', await import(pathToFileURL(path.join(root, 'dist/index.js')).href)],
    ['CJS', await import(pathToFileURL(path.join(root, 'dist/index.cjs')).href)],
  ]
  for (const [, api] of implementations) {
    for (const method of ['log', 'warn', 'error']) {
      const original = api.logger[method]
      restoreLoggers.push(() => {
        api.logger[method] = original
      })
      api.logger[method] = () => {}
    }
    const i18n = new api.I18n({ adapter: new api.ObjectAdapter({ en: { hello: 'Hello' } }), defaultLanguage: 'en' })
    if (i18n.translate('hello') !== 'Hello') throw new Error('Baseline translation failed')
  }
  if (
    compile(`import { I18n, ObjectAdapter } from '@piclist/i18n';
    new I18n({ adapter: new ObjectAdapter({ en: { hello: 'Hello' } }), defaultLanguage: 'en' });`).length
  ) {
    throw new Error('Baseline TypeScript consumer failed')
  }
  console.log('Build and baseline ESM, CJS, and TypeScript controls passed.')

  const runtime = callback =>
    implementations.flatMap(([format, api]) => {
      const make = locales => new api.I18n({ adapter: new api.ObjectAdapter(locales), defaultLanguage: 'en' })
      return callback(api, make).map(item => ({ ...item, label: `${format}: ${item.label}` }))
    })

  await probe(1, 'P1', 'Test runner accepts a failing node:test test', () => {
    const filename = path.join(tempRoot, 'intentional-failure.mjs')
    fs.writeFileSync(
      filename,
      `import { it } from 'node:test';
      import assert from 'node:assert/strict';
      it('synthetic reproduction failure', () => assert.equal(1, 2));`,
    )
    // Run the configured runner against a disposable failing test, without editing
    // the real suite. Support both the audited command and its suggested fix.
    let args
    let runner
    if (packageJson.scripts.test === 'node --test ./test/index.js') {
      args = ['--test', filename]
      runner = 'node --test (current configuration)'
    } else if (packageJson.scripts.test === 'mocha ./test/index.js') {
      const suite = fs.readFileSync(path.join(root, 'test/index.js'), 'utf8')
      if (!/from\s+['"]node:test['"]/.test(suite)) {
        throw new Error('The suite no longer uses node:test; reassess this reproduction')
      }
      args = [requireFromProject.resolve('mocha/bin/mocha.js'), filename]
      runner = 'Mocha with node:test (current configuration)'
    } else {
      throw new Error('Unsupported test command; update the runner reproduction')
    }
    const control = runNode(['--test', filename])
    const observed = runNode(args)
    if (control.status !== 1 || !/not ok/.test(control.stdout + control.stderr)) {
      throw new Error('The intentionally failing control did not fail')
    }
    if (!/not ok/.test(observed.stdout + observed.stderr)) {
      throw new Error('The configured runner did not execute the failing test')
    }
    return [check(`${runner}: failing test exit code`, 1, observed.status)]
  })

  await probe(2, 'P1', 'Browser bundle retains Node built-ins', async () => {
    const entry = path.join(root, 'test', '__reproduce_browser__.mjs')
    const bundle = await rollup({
      input: entry,
      plugins: [
        {
          name: 'synthetic-browser-consumer',
          resolveId: id => (id === entry ? entry : null),
          load: id =>
            id === entry
              ? `import { I18n, ObjectAdapter } from '@piclist/i18n';
            console.log(new I18n({ adapter: new ObjectAdapter({ en: { hello: 'Hello' } }),
              defaultLanguage: 'en' }).translate('hello'));`
              : null,
        },
        nodeResolve({ browser: true }),
      ],
      onwarn(warning) {
        if (warning.code === 'UNRESOLVED_IMPORT') throw new Error('Browser dependency resolution failed')
      },
    })
    try {
      const { output } = await bundle.generate({ format: 'es' })
      const imports = output.filter(item => item.type === 'chunk').flatMap(item => item.imports)
      const nodeImports = [
        ...new Set(imports.filter(id => id.startsWith('node:') || builtinModules.includes(id))),
      ].sort()
      return [
        check('Node imports in an ObjectAdapter-only browser bundle', [], nodeImports),
        valueCheck('browser bundle translates without Node globals', ['Hello'], () => {
          const messages = []
          runInNewContext(
            output.find(item => item.type === 'chunk').code,
            {
              console: { log: message => messages.push(message) },
            },
            { timeout: 5000 },
          )
          return messages
        }),
      ]
    } finally {
      await bundle.close()
    }
  })

  await probe(3, 'P2', 'Missing phrase does not fall back', () =>
    runtime((_api, make) => {
      const i18n = make({
        en: { greeting: 'Hello', user: { name: 'Ana' }, shared: 'English' },
        es: { user: {}, shared: 'Español' },
      })
      i18n.setLanguage('es')
      return [
        valueCheck('missing es.greeting falls back to en', 'Hello', () => i18n.translate('greeting')),
        valueCheck('missing nested phrase falls back to en', 'Ana', () => i18n.translate('user.name')),
        valueCheck('current-language phrase takes precedence', 'Español', () => i18n.translate('shared')),
        valueCheck('phrase absent from both locales stays missing', undefined, () => i18n.translate('absent')),
      ]
    }),
  )

  await probe(4, 'P2', 'Interpolation mishandles repeated tokens and replacement values', () =>
    runtime((_api, make) => {
      const cases = [
        ['repeated placeholder', '${name}, ${name}!', { name: 'Ana' }, 'Ana, Ana!'],
        ['literal dollar value', 'Value: ${value}', { value: '$&' }, 'Value: $&'],
        ['inserted values must not be reprocessed', '${a} ${b}', { a: '${b}', b: 'B' }, '${b} B'],
        ['missing argument stays unchanged', '${missing}', {}, '${missing}'],
        ['falsy values are interpolated', '${zero}/${no}/${blank}', { zero: 0, no: false, blank: '' }, '0/false/'],
        ['inherited arguments are ignored', '${name}', Object.create({ name: 'Ana' }), '${name}'],
        ['argument names are literal', '${a.b} ${a+b}', { 'a.b': 'A', 'a+b': 'B' }, 'A B'],
      ]
      return cases.map(([label, template, args, expected]) =>
        valueCheck(label, expected, () => make({ en: { template } }).translate('template', args)),
      )
    }),
  )

  await probe(5, 'P2', 'Unreadable locale file prevents fallback', () => {
    const directory = fixture('missing-file', { 'en.json': JSON.stringify({ greeting: 'Hello' }) })
    return runtime(api => {
      const adapter = new api.FileSyncAdapter({
        localesBaseDir: directory,
        localeFileName: { en: 'en.json', es: 'missing.json' },
      })
      const i18n = new api.I18n({ adapter, defaultLanguage: 'en' })
      i18n.setLanguage('es')
      return [valueCheck('missing es file falls back to en', 'Hello', () => i18n.translate('greeting'))]
    })
  })

  await probe(6, 'P2', 'Locale discovery includes unrelated files and directories', () => {
    const collision = fixture('filename-collision', {
      'en.json': JSON.stringify({ greeting: 'Hello' }),
      'en.txt': 'synthetic non-JSON fixture',
    })
    const withDirectory = fixture('directory-entry', { 'en.json': JSON.stringify({ greeting: 'Hello' }) })
    fs.mkdirSync(path.join(withDirectory, 'es.json'))
    return runtime(api => [
      valueCheck('en.txt must not override en.json', 'Hello', () => {
        const adapter = new api.FileSyncAdapter({ localesBaseDir: collision })
        return new api.I18n({ adapter, defaultLanguage: 'en' }).translate('greeting')
      }),
      valueCheck('ignore a directory named es.json and fall back', 'Hello', () => {
        const adapter = new api.FileSyncAdapter({ localesBaseDir: withDirectory })
        const i18n = new api.I18n({ adapter, defaultLanguage: 'en' })
        i18n.setLanguage('es')
        return i18n.translate('greeting')
      }),
    ])
  })

  await probe(7, 'P2', 'Documented public types are not exported', () => {
    const diagnostics = compile(`import type { ILocale, II18nConstructorOptions } from '@piclist/i18n';`)
    if (diagnostics.some(code => ![2305, 2459].includes(code))) throw new Error('Unexpected compiler diagnostic')
    return [check('import public types: TypeScript diagnostic codes', [], diagnostics)]
  })

  await probe(8, 'P2', 'Empty and non-string template handling is incorrect', () =>
    runtime((_api, make) => {
      const i18n = make({ en: { blank: '', user: { name: 'Ana' } } })
      return [
        valueCheck('preserve an empty translation', '', () => i18n.translate('blank')),
        valueCheck('namespace lookup returns no string', undefined, () => i18n.translate('user')),
        valueCheck('namespace with interpolation args does not throw', undefined, () =>
          i18n.translate('user', { name: 'Bob' }),
        ),
      ]
    }),
  )

  await probe(9, 'P2', 'Adapter declarations hide missing locales', () => {
    const nullableDiagnostics = compile(`import { BaseAdapter } from '@piclist/i18n';
      class NullableAdapter extends BaseAdapter {
        getLocale(_language: string): Record<string, unknown> | null { return null; }
      }`)
    if (nullableDiagnostics.some(code => code !== 2416)) throw new Error('Unexpected compiler diagnostic')
    const unsafeDiagnostics = compile(`import { ObjectAdapter } from '@piclist/i18n';
      const locale = new ObjectAdapter({}).getLocale('missing');
      locale.greeting.toUpperCase();`)
    if (unsafeDiagnostics.some(code => ![2531, 2532, 18047, 18048, 18049].includes(code))) {
      throw new Error('Unexpected compiler diagnostic')
    }
    return [
      check('nullable custom adapter: TypeScript diagnostic codes', [], nullableDiagnostics),
      ...runtime(api => {
        const result = observe(() => new api.ObjectAdapter({}).getLocale('missing').greeting.toUpperCase())
        return [
          check(
            'compiler rejects the lookup that throws at runtime',
            { compilerRejected: true, runtimeThrows: true },
            { compilerRejected: unsafeDiagnostics.length > 0, runtimeThrows: result.throws === 'TypeError' },
          ),
        ]
      }),
    ]
  })

  await probe(10, 'P3', 'Inherited properties are mistaken for locales', () => {
    const directory = fixture('prototype-lookup', { 'en.json': JSON.stringify({ name: 'Hello' }) })
    return runtime(api => {
      const adapters = [
        ['ObjectAdapter', new api.ObjectAdapter({ en: { name: 'Hello' } })],
        ['FileSyncAdapter', new api.FileSyncAdapter({ localesBaseDir: directory })],
      ]
      return adapters.map(([name, adapter]) =>
        valueCheck(`${name}: unknown language "constructor"`, 'Hello', () => {
          const i18n = new api.I18n({ adapter, defaultLanguage: 'en' })
          i18n.setLanguage('constructor')
          return i18n.translate('name')
        }),
      )
    })
  })

  const count = status => results.filter(item => item.status === status).length
  console.log(
    `\nSummary: ${count('REPRODUCED')} reproduced, ${count('NOT REPRODUCED')} not reproduced, ${count('ERROR')} probe errors.`,
  )
  process.exitCode = count('ERROR') ? 2 : count('REPRODUCED') ? 1 : 0
}

try {
  await main()
} catch (error) {
  console.error(`Reproduction setup failed (${error.name}). Check installed dependencies and npm run build.`)
  process.exitCode = 2
} finally {
  for (const restore of restoreLoggers) restore()
  // Verify the exact generated directory stays beneath the temporary parent before
  // recursively deleting it. Never remove a caller-supplied or repository directory.
  const resolved = path.resolve(tempRoot)
  if (path.dirname(resolved) !== tempParent || !path.basename(resolved).startsWith('piclist-i18n-reproduce-')) {
    console.error('Temporary directory cleanup refused: unexpected path')
    process.exitCode = 2
  } else {
    fs.rmSync(resolved, { recursive: true, force: true })
  }
}
