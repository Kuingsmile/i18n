import { I18n, ObjectAdapter, type II18nConstructorOptions } from '@piclist/i18n'

const options: II18nConstructorOptions = {
  adapter: new ObjectAdapter({ en: { greeting: 'Hello' } }),
  defaultLanguage: 'en',
}
const translator = new I18n(options)
const translation: string | undefined = translator.translate('greeting')
void translation

// @ts-expect-error Language must remain typed as a string.
translator.setLanguage(123)
