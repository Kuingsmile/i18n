import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

for (const entry of ['index.js', 'index.cjs', 'browser.js', 'browser.cjs']) {
  const { createTypedI18n, I18n, ObjectAdapter, logger } = await import(`../dist/${entry}`)
  const make = locales => new I18n({ adapter: new ObjectAdapter(locales), defaultLanguage: 'en' })

  describe(`translation regressions (${entry})`, () => {
    it('keeps the typed helper bound to live language, fallback and adapter state', context => {
      context.mock.method(logger, 'warn', () => {})
      context.mock.method(logger, 'error', () => {})
      const schema = { title: 'Schema only', user: { greeting: 'Schema ${name}' }, empty: '' }
      const en = { title: 'Account', user: { greeting: 'Hello, ${name}!' }, empty: '' }
      const adapter = new ObjectAdapter({ en, fr: { user: { greeting: 'Bonjour, ${name}!' } } })
      const i18n = createTypedI18n({ adapter, defaultLanguage: 'en', schema })
      const { t } = i18n

      assert.ok(i18n instanceof I18n)
      assert.equal(i18n.getAdapter(), adapter)
      assert.equal(t('user.greeting', { name: 'Ada' }), 'Hello, Ada!')
      assert.equal(t('title'), 'Account')
      assert.equal(t('empty'), '')
      i18n.setLanguage('fr')
      assert.equal(t('user.greeting', { name: 'Ada' }), 'Bonjour, Ada!')
      assert.equal(t('title'), 'Account')
      en.title = 'Edited'
      assert.equal(t('title'), 'Edited')
      adapter.setLocale('es', { title: 'Cuenta' })
      i18n.setDefaultLanguage('es')
      assert.equal(t('title'), 'Cuenta')
      adapter.setLocale('fr', { title: 'Compte', dynamic: 'Outside the schema' })
      assert.equal(t('title'), 'Compte')
      assert.equal(i18n.translate('dynamic'), 'Outside the schema')
      assert.equal(t('user.greeting', { name: 'Ada' }), undefined)
      adapter.setLocales({})
      assert.equal(t('title'), undefined)
    })

    it('observes replacements and in-place edits after repeated lookups', () => {
      const en = { user: { title: 'Original' } }
      const i18n = make({ en })
      for (let i = 0; i < 100; i++) assert.equal(i18n.translate('user.title'), 'Original')
      en.user.title = 'Edited'
      assert.equal(i18n.translate('user.title'), 'Edited')
      i18n.getAdapter().setLocale('en', { user: { title: 'Replaced' } })
      assert.equal(i18n.translate('user.title'), 'Replaced')
      i18n.getAdapter().setLocales({ en: { user: { title: 'New map' } } })
      assert.equal(i18n.translate('user.title'), 'New map')
    })

    it('resolves live fallback data and preserves empty/non-string values', context => {
      context.mock.method(logger, 'warn', () => {})
      const locales = {
        en: { user: { title: 'English' }, empty: 'Fallback', number: 'Fallback' },
        fr: { user: {}, empty: '', number: 0 },
        es: { user: { title: 'Spanish' } },
      }
      const i18n = make(locales)
      i18n.setLanguage('fr')
      assert.equal(i18n.translate('user.title'), 'English')
      assert.equal(i18n.translate('empty'), '')
      assert.equal(i18n.translate('number'), undefined)
      assert.equal(i18n.translate('missing'), undefined)
      locales.fr.missing = 'Added later'
      assert.equal(i18n.translate('missing'), 'Added later')
      i18n.setDefaultLanguage('es')
      assert.equal(i18n.translate('user.title'), 'Spanish')
      locales.fr.user.title = 'French'
      assert.equal(i18n.translate('user.title'), 'French')
      delete locales.fr.user.title
      assert.equal(i18n.translate('user.title'), 'Spanish')
    })

    it('preserves empty path segments and only traverses own properties', context => {
      context.mock.method(logger, 'warn', () => {})
      const en = Object.setPrototypeOf(
        {
          '': { leading: 'Leading' },
          trailing: { '': 'Trailing' },
          middle: { '': { value: 'Middle' } },
          constructor: { name: 'Own constructor' },
          hasOwnProperty: { label: 'Own method name' },
          ['__proto__']: { label: 'Own prototype name' },
          user: { name: 'Nested' },
          'user.name': 'Literal dotted key',
          text: 'abc',
          nil: null,
        },
        { inherited: 'Hidden' },
      )
      const i18n = make({ en })
      for (const [key, expected] of [
        ['.leading', 'Leading'],
        ['trailing.', 'Trailing'],
        ['middle..value', 'Middle'],
        ['constructor.name', 'Own constructor'],
        ['hasOwnProperty.label', 'Own method name'],
        ['__proto__.label', 'Own prototype name'],
        ['user.name', 'Nested'],
        ['text.1', 'b'],
        ['inherited', undefined],
        ['user.toString', undefined],
        ['nil.value.deep', undefined],
      ])
        assert.equal(i18n.translate(key), expected, key)
      en[''] = 'Empty key'
      assert.equal(i18n.translate(''), 'Empty key')
    })

    it('interpolates repeated tokens literally and preserves unknown or unfinished tokens', () => {
      const cases = [
        ['${x}/${x}', { x: "$&$`$'$$${other}" }, "$&$`$'$$${other}/$&$`$'$$${other}"],
        [
          '${zero}/${no}/${blank}/${nil}/${unset}',
          { zero: 0, no: false, blank: '', nil: null, unset: undefined },
          '0/false//null/undefined',
        ],
        [
          '${}/${a.b}/${a+b}/${line\nbreak}',
          { '': 'Empty', 'a.b': 'Dot', 'a+b': 'Plus', 'line\nbreak': 'Newline' },
          'Empty/Dot/Plus/Newline',
        ],
        [
          '${outer${inner}}/${known}/${unfinished',
          { 'outer${inner': 'Nested', known: 'Known' },
          'Nested}/Known/${unfinished',
        ],
        ['${unknown}/${known}/${unknown}', { known: 'Known' }, '${unknown}/Known/${unknown}'],
        [
          '${inherited}/${own}',
          Object.assign(Object.create({ inherited: 'Hidden' }), { own: 'Visible' }),
          '${inherited}/Visible',
        ],
        ['${x}', { x: Symbol('value') }, 'Symbol(value)'],
        ['Plain text', { unused: 1 }, 'Plain text'],
        ['', { unused: 1 }, ''],
        ['${x}', undefined, '${x}'],
      ]
      for (const [template, args, expected] of cases) {
        const i18n = make({ en: { message: template } })
        assert.equal(i18n.translate('message', args), expected)
      }
    })

    it('reads argument getters once per occurrence and observes changed templates and arguments', () => {
      let reads = 0
      const args = {
        get x() {
          return ++reads
        },
      }
      const en = { message: '${x}/${x}' }
      const i18n = make({ en })
      assert.equal(i18n.translate('message', args), '1/2')
      assert.equal(i18n.translate('message', args), '3/4')
      en.message = 'Updated ${x}'
      assert.equal(i18n.translate('message', args), 'Updated 5')
      assert.equal(i18n.translate('message', { x: 'New argument' }), 'Updated New argument')
    })
  })
}
