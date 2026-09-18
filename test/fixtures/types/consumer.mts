import {
  createTypedI18n,
  I18n,
  ObjectAdapter,
  type II18nConstructorOptions,
  type ILocale,
  type PlaceholderNames,
  type TranslationArgs,
  type TranslationKeys,
  type TypedI18n,
  type TypedI18nOptions,
  type TypedTranslate,
} from '@piclist/i18n'

const options: II18nConstructorOptions = {
  adapter: new ObjectAdapter({ en: { greeting: 'Hello' } }),
  defaultLanguage: 'en',
}
const translator = new I18n(options)
const translation: string | undefined = translator.translate('greeting')
void translation

// @ts-expect-error Language must remain typed as a string.
translator.setLanguage(123)

const schema = {
  title: 'Account',
  user: {
    greeting: 'Hello, ${name}! You have ${count} messages, ${name}.',
    profile: { label: 'Profile' },
  },
  special: '${}/${a.b}/${a+b}/${line\nbreak}',
  malformed: '${outer${inner}}/${known}/${unfinished',
  unfinished: 'Hello ${name',
  empty: '',
  '': { leading: 'Leading' },
  trailing: { '': 'Trailing' },
  'literal.dotted': 'Unreachable',
  count: 1,
  nil: null,
  list: ['Item'],
} as const
const typedOptions: TypedI18nOptions<typeof schema> = {
  adapter: new ObjectAdapter({ en: schema }),
  defaultLanguage: 'en',
  schema,
}
const typed: TypedI18n<typeof schema> = createTypedI18n(typedOptions)
const { t } = typed
const bound: TypedTranslate<typeof schema> = t
const typedResult: string | undefined = bound('user.greeting', { name: 'Ada', count: 2 })
const key: TranslationKeys<typeof schema> = 'user.profile.label'
t(key)
t('title')
t('title', {})
t('title', undefined)
t('empty')
t('.leading')
t('trailing.')
t('unfinished')
t('special', { '': '', 'a.b': 0, 'a+b': false, 'line\nbreak': null })
t('malformed', { 'outer${inner': 'Nested', known: 'Known' })
t('user.greeting', { name: Symbol('name'), count: undefined })
const names: PlaceholderNames<'${name}/${name}/${count}/${unfinished'> = 'count'
const args: TranslationArgs<'${name}/${count}'> = { name: 'Ada', count: 2 }
t('user.greeting', args)
void [typedResult, names]

// @ts-expect-error Unknown translation key.
t('user.missing')
// @ts-expect-error Object namespaces are not string leaves.
t('user')
// @ts-expect-error Non-string leaves are not typed translation keys.
t('count')
// @ts-expect-error Null leaves are not typed translation keys.
t('nil')
// @ts-expect-error Arrays are not part of the typed object schema.
t('list.0')
// @ts-expect-error Runtime paths split dots; literal dotted properties are not reachable.
t('literal.dotted')
// @ts-expect-error String prototype properties are not schema keys.
t('title.toString')
// @ts-expect-error Every inferred placeholder is required.
t('user.greeting')
// @ts-expect-error Required arguments cannot be undefined.
t('user.greeting', undefined)
// @ts-expect-error Missing count placeholder.
t('user.greeting', { name: 'Ada' })
// @ts-expect-error Misspelled placeholder name.
t('user.greeting', { name: 'Ada', counts: 2 })
// @ts-expect-error Excess literal argument names are checked.
t('user.greeting', { name: 'Ada', count: 2, typo: true })
// @ts-expect-error A literal without placeholders does not accept interpolation names.
t('title', { name: 'Ada' })
// @ts-expect-error Unfinished tokens do not introduce placeholders.
t('unfinished', { name: 'Ada' })
// @ts-expect-error Repeated placeholders are collected without unmatched tokens.
const unfinishedName: PlaceholderNames<'${name}/${name}/${count}/${unfinished'> = 'unfinished'
void unfinishedName

declare const uncertainKey: 'title' | 'user.greeting'
t(uncertainKey, { name: 'Ada', count: 2 })
// @ts-expect-error A union key that might require arguments must receive them.
t(uncertainKey)
declare const dynamicKey: string
// @ts-expect-error Dynamic strings use the unrestricted translate() method.
t(dynamicKey)

// Inline schemas can preserve literal templates with `as const` too.
const inferred = createTypedI18n({ ...options, schema: { nested: { message: '${value}' } } as const })
inferred.t('nested.message', { value: 'Text' })
// @ts-expect-error Inline placeholder inference requires the value argument.
inferred.t('nested.message')

// Widened strings (e.g. JSON imports) retain keys but cannot infer placeholders.
const widened = createTypedI18n({ ...options, schema: { message: 'Hello' } as { message: string } })
widened.t('message')
widened.t('message', { arbitrary: 1 })
// @ts-expect-error Known keys remain checked even when templates are widened.
widened.t('missing')

// Existing locale, class and translate signatures remain unrestricted.
const legacyLocale: ILocale = { number: 1, object: { nested: true }, nil: null }
const legacyValue: string = legacyLocale.arbitrary.deep.value
const compatible: I18n = typed
translator.translate(dynamicKey, 42)
translator.translate(dynamicKey, { arbitrary: new Date() })
compatible.translate(dynamicKey, null)
typed.translate('outside.the.schema', { arbitrary: true })
void legacyValue
