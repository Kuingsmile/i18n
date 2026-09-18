import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

for (const entry of ['index.js', 'index.cjs', 'browser.js', 'browser.cjs']) {
  const { createTypedI18n, I18n, ObjectAdapter, logger } = await import(`../dist/${entry}`)
  const make = (locales, options = {}) =>
    new I18n({ adapter: new ObjectAdapter(locales), defaultLanguage: 'en', ...options })

  describe(`optional internationalization (${entry})`, () => {
    it('keeps the default fallback and literal locale identifiers with no chain or an empty chain', context => {
      context.mock.method(logger, 'error', () => {})
      context.mock.method(logger, 'warn', () => {})
      for (const options of [{}, { fallbackLanguages: [] }]) {
        const i18n = make(
          {
            en: { title: 'Default', empty: 'Default', nil: 'Default' },
            fr: { title: 'Parent' },
            'fr-ca': { title: 'Lowercase' },
            fr_CA: { title: 'Underscore', empty: '', nil: null },
          },
          options,
        )
        i18n.setLanguage('fr-CA')
        assert.equal(i18n.translate('title'), 'Default')
        assert.equal(i18n.getLanguage(), 'fr-CA')
        i18n.setLanguage(' fr_CA ')
        assert.equal(i18n.translate('title'), 'Underscore')
        assert.equal(i18n.getLanguage(), 'fr_CA')
        assert.equal(i18n.translate('empty'), '')
        assert.equal(i18n.translate('nil'), undefined)
        assert.equal(i18n.translate('missing'), undefined)
        i18n.getAdapter().setLocales({})
        assert.equal(i18n.translate('title'), undefined)
      }
    })

    it('tries the current language, configured languages in order, then the default', context => {
      context.mock.method(logger, 'warn', () => {})
      const i18n = make(
        {
          'fr-CA': { current: 'Canadian' },
          fr: { current: 'French', user: { greeting: 'Bonjour ${name}' }, next: undefined },
          de: { user: { greeting: 'Hallo ${name}' }, next: 'German' },
          en: { user: { greeting: 'Hello ${name}' }, next: 'English', last: 'Default' },
        },
        { fallbackLanguages: ['unavailable', 'fr', 'de'] },
      )
      i18n.setLanguage('fr-CA')
      assert.equal(i18n.translate('current'), 'Canadian')
      assert.equal(i18n.translate('user.greeting', { name: 'Ada' }), 'Bonjour Ada')
      assert.equal(i18n.translate('next'), 'German')
      assert.equal(i18n.translate('last'), 'Default')
      assert.equal(i18n.translate('missing'), undefined)
      i18n.setLanguage('missing-locale')
      assert.equal(i18n.translate('user.greeting', { name: 'Ada' }), 'Bonjour Ada')
      assert.equal(i18n.getLanguage(), 'missing-locale')
    })

    it('stops at empty strings and defined non-string values in any chain position', () => {
      for (const language of ['fr-CA', 'fr', 'de', 'en']) {
        for (const value of ['', null, 0, false, {}, []]) {
          const locales = { 'fr-CA': {}, fr: {}, de: {}, en: { message: 'Default' } }
          locales[language].message = value
          const i18n = make(locales, { fallbackLanguages: ['fr', 'de'] })
          i18n.setLanguage('fr-CA')
          assert.equal(i18n.translate('message'), value === '' ? '' : undefined)
        }
      }
    })

    it('deduplicates literal trimmed codes without normalizing case or separators', context => {
      const i18n = make(
        { fr: {}, FR: {}, fr_CA: {}, en: { title: 'Default' } },
        { fallbackLanguages: [' fr ', 'FR', 'fr', 'fr_CA', 'en', 'en'] },
      )
      i18n.setLanguage('fr')
      const lookup = context.mock.method(i18n.getAdapter(), 'getLocale')
      assert.equal(i18n.translate('title'), 'Default')
      assert.deepEqual(
        lookup.mock.calls.map(call => call.arguments[0]),
        ['fr', 'FR', 'fr_CA', 'en'],
      )
    })

    it('uses only own properties across nested fallback paths', context => {
      context.mock.method(logger, 'warn', () => {})
      const i18n = make(
        {
          fr: Object.assign(Object.create({ title: 'Inherited' }), {
            user: Object.create({ name: 'Inherited name' }),
          }),
          en: { title: 'Default', user: { name: 'Default name' }, ['__proto__']: { title: 'Own' } },
        },
        { fallbackLanguages: ['fr'] },
      )
      i18n.setLanguage('fr-CA')
      assert.equal(i18n.translate('title'), 'Default')
      assert.equal(i18n.translate('user.name'), 'Default name')
      assert.equal(i18n.translate('__proto__.title'), 'Own')
      assert.equal(i18n.translate('user.toString'), undefined)
    })

    it('observes live language, default and adapter changes through the typed helper', context => {
      context.mock.method(logger, 'error', () => {})
      const fr = { title: 'French' }
      const fallbackLanguages = ['fr']
      const adapter = new ObjectAdapter({ en: { title: 'English' }, fr, de: { title: 'German' } })
      const i18n = createTypedI18n({
        adapter,
        defaultLanguage: 'en',
        fallbackLanguages,
        schema: { title: 'Schema' },
      })
      const { t } = i18n
      i18n.setLanguage('fr-CA')
      fallbackLanguages[0] = 'de'
      assert.equal(t('title'), 'French')
      fr.title = 'Edited French'
      assert.equal(t('title'), 'Edited French')
      adapter.setLocale('fr', {})
      assert.equal(t('title'), 'English')
      i18n.setDefaultLanguage('de')
      assert.equal(t('title'), 'German')
      assert.equal(i18n.getLanguage(), 'fr-CA')
      adapter.setLocale('fr-CA', { title: 'Canadian' })
      assert.equal(t('title'), 'Canadian')
      adapter.setLocales({})
      assert.equal(t('title'), undefined)
    })

    it('never infers plural messages or another message syntax during translation', () => {
      for (const options of [{}, { fallbackLanguages: ['fr'] }]) {
        const i18n = make(
          {
            en: {
              object: { one: 'One item', other: '${count} items' },
              message: '{count, plural, one {One item} other {# items}} / ${count}',
              special: '${count}/${unknown}/${count}',
            },
          },
          options,
        )
        assert.equal(i18n.translate('object', { count: 1 }), undefined)
        assert.equal(i18n.translate('message', { count: 2 }), '{count, plural, one {One item} other {# items}} / 2')
        assert.equal(i18n.translate('special', { count: '$&${unknown}' }), '$&${unknown}/${unknown}/$&${unknown}')
      }
    })

    it('selects cardinal categories for singular, fractional and multi-category languages', () => {
      const i18n = make({})
      for (const [locale, cases] of [
        [
          'en',
          [
            [0, 'other'],
            [1, 'one'],
            [2, 'other'],
            [1.5, 'other'],
          ],
        ],
        [
          'ru',
          [
            [1, 'one'],
            [2, 'few'],
            [5, 'many'],
            [21, 'one'],
            [1.5, 'other'],
          ],
        ],
        [
          'ar',
          [
            [0, 'zero'],
            [1, 'one'],
            [2, 'two'],
            [3, 'few'],
            [11, 'many'],
            [100, 'other'],
          ],
        ],
      ]) {
        i18n.setLanguage(locale)
        for (const [count, category] of cases) assert.equal(i18n.selectPlural(count), category)
      }
    })

    it('supports ordinal rules, digit options and an explicit plural locale override', () => {
      const i18n = make({})
      for (const [count, category] of [
        [1, 'one'],
        [2, 'two'],
        [3, 'few'],
        [4, 'other'],
        [11, 'other'],
      ]) {
        assert.equal(i18n.selectPlural(count, { type: 'ordinal' }), category)
      }
      assert.equal(i18n.selectPlural(1, { minimumFractionDigits: 1 }), 'other')
      assert.equal(i18n.selectPlural(2, undefined, 'ar'), 'two')
      assert.equal(i18n.getLanguage(), 'en')
      assert.throws(() => i18n.selectPlural(1, { type: 'invalid' }), RangeError)
    })

    it('composes plural selection and formatting with the existing interpolation', () => {
      const i18n = make({ en: { items: { one: '${count} item for ${name}', other: '${count} items for ${name}' } } })
      for (const [count, expected] of [
        [1, '1 item for Ada'],
        [1200, '1,200 items for Ada'],
      ]) {
        assert.equal(
          i18n.translate(`items.${i18n.selectPlural(count)}`, { count: i18n.formatNumber(count), name: 'Ada' }),
          expected,
        )
      }
    })

    it('formats numbers and bigints with native Intl options and current or explicit locales', () => {
      const i18n = make({})
      for (const locale of ['en-US', 'de-DE', 'ar-EG']) {
        i18n.setLanguage(locale)
        for (const [value, options] of [
          [12345.678, undefined],
          [12345.678, { style: 'currency', currency: 'EUR' }],
          [0.25, { style: 'percent', minimumFractionDigits: 1 }],
          [12345678901234567890n, { useGrouping: false }],
          [NaN, undefined],
          [Infinity, undefined],
        ]) {
          assert.equal(i18n.formatNumber(value, options), new Intl.NumberFormat(locale, options).format(value))
        }
      }
      const options = Object.freeze({ style: 'currency', currency: 'USD' })
      assert.equal(i18n.formatNumber(12.5, options, 'en-US'), '$12.50')
      assert.equal(i18n.getLanguage(), 'ar-EG')
      assert.throws(() => i18n.formatNumber(1, { minimumFractionDigits: -1 }), RangeError)
    })

    it('formats dates and timestamps with native Intl options, time zones and locale overrides', () => {
      const i18n = make({})
      const date = new Date('2024-02-29T23:30:00Z')
      const options = Object.freeze({ year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      for (const locale of ['en-US', 'de-DE', 'ja-JP']) {
        i18n.setLanguage(locale)
        for (const value of [date, date.getTime(), 0]) {
          assert.equal(i18n.formatDate(value, options), new Intl.DateTimeFormat(locale, options).format(value))
          assert.equal(i18n.formatDate(value), new Intl.DateTimeFormat(locale).format(value))
        }
      }
      assert.equal(i18n.formatDate(date, options, 'en-US'), 'February 29, 2024')
      const timeOptions = { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Tokyo' }
      assert.equal(i18n.formatDate(date, timeOptions), new Intl.DateTimeFormat('ja-JP', timeOptions).format(date))
      assert.equal(i18n.getLanguage(), 'ja-JP')
      assert.throws(() => i18n.formatDate(new Date(NaN), options), RangeError)
      assert.throws(() => i18n.formatDate(date, { timeZone: 'Invalid/Zone' }), RangeError)
    })

    it('keeps helper locales independent of translation fallback and default-language changes', () => {
      const i18n = make({ en: { title: 'Default' } }, { fallbackLanguages: ['fr'] })
      i18n.setLanguage('de-DE')
      assert.equal(i18n.translate('title'), 'Default')
      i18n.setDefaultLanguage('ar')
      assert.equal(i18n.formatNumber(1234.5), new Intl.NumberFormat('de-DE').format(1234.5))
      assert.equal(i18n.selectPlural(2), 'other')
      assert.equal(i18n.getLanguage(), 'de-DE')
    })

    it('only requires Intl when helpers are called and permits overrides for custom locale keys', context => {
      const i18n = make({ custom_locale: { title: 'Custom' } }, { defaultLanguage: 'custom_locale' })
      assert.equal(i18n.translate('title'), 'Custom')
      assert.throws(() => i18n.selectPlural(1), RangeError)
      assert.throws(() => i18n.formatNumber(1), RangeError)
      assert.throws(() => i18n.formatDate(0), RangeError)
      assert.equal(i18n.selectPlural(1, undefined, 'en'), 'one')
      assert.equal(i18n.formatNumber(1, undefined, 'en'), '1')
      assert.equal(
        i18n.formatDate(0, { timeZone: 'UTC' }, 'en'),
        new Intl.DateTimeFormat('en', { timeZone: 'UTC' }).format(0),
      )
      for (const name of ['PluralRules', 'NumberFormat', 'DateTimeFormat']) {
        context.mock.method(Intl, name, () => {
          throw new Error('Intl unavailable')
        })
      }
      const plain = make({ custom_locale: { title: '${name}' } }, { fallbackLanguages: ['custom_locale'] })
      assert.equal(plain.translate('title', { name: 'Ada' }), 'Ada')
      assert.equal(i18n.translate('title'), 'Custom')
    })
  })
}
