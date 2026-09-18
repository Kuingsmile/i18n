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
