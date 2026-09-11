import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function createWorkloads({ I18n, ObjectAdapter, FileSyncAdapter }) {
  const messages = Object.fromEntries(Array.from({ length: 4096 }, (_, i) => [`key${i}`, `Message ${i}`]))
  const en = {
    hello: 'Hello world',
    user: { profile: { title: 'Profile' } },
    greeting: 'Hello, ${name}!',
    summary: '${name}: ${count} items at ${price}; thanks, ${name}!',
    messages,
  }
  const locales = { en, fr: { hello: 'Bonjour' } }
  const make = () => new I18n({ adapter: new ObjectAdapter(locales), defaultLanguage: 'en' })
  const cases = []
  const add = (name, run, expected, validationCount = 1) => {
    // Validate outside the timed region, including every key in rotating workloads.
    for (let i = 0; i < validationCount; i++) assert.equal(run(i), expected(i), name)
    cases.push({ name, run })
  }
  const instance = make()
  add(
    'object / flat key',
    () => instance.translate('hello'),
    () => en.hello,
  )
  const nested = make()
  add(
    'object / nested key',
    () => nested.translate('user.profile.title'),
    () => 'Profile',
  )
  for (const size of [256, 4096]) {
    const translator = make()
    const keys = Array.from({ length: size }, (_, i) => `messages.key${i}`)
    add(
      `object / rotating ${size} keys`,
      i => translator.translate(keys[i % size]),
      i => `Message ${i % size}`,
      size,
    )
  }
  const oneArgument = { name: 'Ada' }
  const argumentsObject = { name: 'Ada', count: 3, price: '$5' }
  const interpolation = make()
  add(
    'interpolation / one token',
    () => interpolation.translate('greeting', oneArgument),
    () => 'Hello, Ada!',
  )
  add(
    'interpolation / repeated tokens',
    () => interpolation.translate('summary', argumentsObject),
    () => 'Ada: 3 items at $5; thanks, Ada!',
  )
  add(
    'interpolation / unused args',
    () => interpolation.translate('hello', oneArgument),
    () => en.hello,
  )
  const fallback = make()
  fallback.setLanguage('fr')
  add(
    'fallback / missing phrase',
    () => fallback.translate('user.profile.title'),
    () => 'Profile',
  )
  const missingLanguage = make()
  missingLanguage.setLanguage('unknown')
  add(
    'fallback / missing language',
    () => missingLanguage.translate('hello'),
    () => en.hello,
  )
  add(
    'missing / unknown key',
    () => interpolation.translate('absent.deep.key'),
    () => undefined,
  )
  const switching = make()
  add(
    'object / language switching',
    i => {
      switching.setLanguage(i % 2 ? 'fr' : 'en')
      return switching.translate('hello')
    },
    i => (i % 2 ? 'Bonjour' : en.hello),
    2,
  )
  const updating = make()
  const alternatives = [{ hello: 'First' }, { hello: 'Second' }]
  add(
    'object / locale replacement',
    i => {
      updating.getAdapter().setLocales({ en: alternatives[i % 2] })
      return updating.translate('hello')
    },
    i => alternatives[i % 2].hello,
    2,
  )
  add(
    'object / construct and translate',
    () => make().translate('user.profile.title'),
    () => 'Profile',
  )

  // Keep real disk I/O separate from steady-state translation. Cold refers to the
  // adapter cache: the operating system's file cache is intentionally left alone.
  const parent = fs.realpathSync(os.tmpdir())
  const directory = fs.mkdtempSync(path.join(parent, 'piclist-i18n-benchmark-'))
  const cleanup = () => {
    const resolved = fs.realpathSync(directory)
    if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith('piclist-i18n-benchmark-')) {
      throw new Error('Unexpected benchmark temporary directory')
    }
    fs.rmSync(resolved, { recursive: true, force: true })
  }
  try {
    fs.writeFileSync(path.join(directory, 'en.json'), JSON.stringify(en))
    const options = { localesBaseDir: directory, localeFileName: { en: 'en.json' } }
    const warm = new I18n({ adapter: new FileSyncAdapter(options), defaultLanguage: 'en' })
    add(
      'file / cached nested key',
      () => warm.translate('user.profile.title'),
      () => 'Profile',
    )
    add(
      'file / cold load 4096 messages',
      () => new I18n({ adapter: new FileSyncAdapter(options), defaultLanguage: 'en' }).translate('hello'),
      () => en.hello,
    )
    add(
      'file / discover and load',
      () =>
        new I18n({ adapter: new FileSyncAdapter({ localesBaseDir: directory }), defaultLanguage: 'en' }).translate(
          'hello',
        ),
      () => en.hello,
    )
    return { cases, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}
