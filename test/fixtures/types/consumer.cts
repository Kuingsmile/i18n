import { createTypedI18n, I18n, ObjectAdapter, type II18nConstructorOptions, type TypedTranslate } from '@piclist/i18n'
import i18n = require('@piclist/i18n')

const options: II18nConstructorOptions = {
  adapter: new ObjectAdapter({ en: { greeting: 'Hello' } }),
  defaultLanguage: 'en',
}
const translator = new I18n(options)
const requiredTranslator: I18n = new i18n.I18n(options)
const translation: string | undefined = requiredTranslator.translate('greeting')
void translation

const enhancedOptions: i18n.II18nConstructorOptions = { ...options, fallbackLanguages: ['fr', 'de'] as const }
const enhanced = i18n.createTypedI18n({ ...enhancedOptions, schema: { title: 'Title' } as const })
const category: Intl.LDMLPluralRule = enhanced.selectPlural(2, { type: 'ordinal' }, 'en')
const formattedNumber: string = enhanced.formatNumber(1234.5, { style: 'currency', currency: 'EUR' }, 'de-DE')
const formattedBigInt: string = enhanced.formatNumber(12345678901234567890n)
const formattedDate: string = enhanced.formatDate(new Date(), { timeZone: 'UTC', dateStyle: 'long' }, 'en-GB')
enhanced.formatDate(0)
void [category, formattedNumber, formattedBigInt, formattedDate]

// @ts-expect-error Fallback chains contain only language strings.
new i18n.I18n({ ...options, fallbackLanguages: ['fr', 123] })
// @ts-expect-error Plural selection takes a numeric count.
enhanced.selectPlural('2')
// @ts-expect-error Plural options use the native Intl types.
enhanced.selectPlural(2, { type: 'invalid' })
// @ts-expect-error Number formatting accepts numbers and bigints, not strings.
enhanced.formatNumber('1234')
// @ts-expect-error Date strings must be explicitly parsed into dates or timestamps.
enhanced.formatDate('2024-02-29')

// @ts-expect-error Language must remain typed as a string.
translator.setLanguage(123)

const schema = { title: 'Account', user: { greeting: 'Hello, ${name}!' } } as const
const typed = createTypedI18n({ ...options, schema })
const { t } = i18n.createTypedI18n({ ...options, schema })
const bound: TypedTranslate<typeof schema> = typed.t
const typedTranslation: string | undefined = t('user.greeting', { name: 'Ada' })
bound('title')
typed.translate('any.dynamic.key', 42)
const compatible: I18n = typed
void [typedTranslation, compatible]

// @ts-expect-error Required placeholder arguments survive CommonJS declarations.
t('user.greeting')
// @ts-expect-error Unknown keys are rejected for require() consumers too.
t('user.unknown')
// @ts-expect-error Placeholder names are checked for CommonJS imports.
bound('user.greeting', { typo: 'Ada' })
