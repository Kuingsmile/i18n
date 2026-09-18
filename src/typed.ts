import { I18n } from './i18n'
import type { II18nConstructorOptions } from './types'

/** Dot-separated paths to string leaves in a reference locale. */
export type TranslationKeys<Schema> = Schema extends readonly unknown[]
  ? never
  : Schema extends object
    ? string extends keyof Schema
      ? string
      : {
          [Key in keyof Schema & string]: Key extends `${string}.${string}`
            ? never
            : Schema[Key] extends string
              ? Key
              : `${Key}.${TranslationKeys<Schema[Key]>}`
        }[keyof Schema & string]
    : never

type TranslationValue<Schema, Key extends string> = Key extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Schema
    ? TranslationValue<Schema[Head], Tail>
    : never
  : Key extends keyof Schema
    ? Schema[Key]
    : never

/** Placeholder names use the same first-${ / next-} matching as interpolation. */
export type PlaceholderNames<Template extends string> = string extends Template
  ? string
  : Template extends `${string}\${${infer Name}}${infer Rest}`
    ? Name | PlaceholderNames<Rest>
    : never

/** Values are stringified by the existing interpolation implementation. */
export type TranslationArgs<Template extends string> = [PlaceholderNames<Template>] extends [never]
  ? Record<string, never>
  : Record<PlaceholderNames<Template>, unknown>

type TranslationParameters<Template extends string> = string extends Template
  ? [args?: Record<string, unknown>]
  : [PlaceholderNames<Template>] extends [never]
    ? [args?: TranslationArgs<Template>]
    : [args: TranslationArgs<Template>]

export type TypedTranslate<Schema> = <Key extends TranslationKeys<Schema>>(
  phrase: Key,
  ...args: TranslationParameters<Extract<TranslationValue<Schema, Key>, string>>
) => string | undefined

export type TypedI18n<Schema> = I18n & { readonly t: TypedTranslate<Schema> }

export interface TypedI18nOptions<Schema extends object> extends II18nConstructorOptions {
  /** Type inference only; the adapter remains the source of translations. */
  schema: Schema
}

/** Add a checked, bound t() while retaining the unrestricted translate() API. */
export function createTypedI18n<Schema extends object>(options: TypedI18nOptions<Schema>): TypedI18n<Schema> {
  const i18n = new I18n(options)
  return Object.assign(i18n, { t: i18n.translate.bind(i18n) as TypedTranslate<Schema> })
}
