import { BaseAdapter } from './adapters'
import { II18nConstructorOptions, ILocale } from './types'
import { logger } from './utils'

export class I18n {
  private readonly adapter: BaseAdapter
  private currentLanguage: string
  private defaultLanguage: string
  private readonly fallbackLanguages: readonly string[]

  constructor(options: II18nConstructorOptions) {
    const { adapter, defaultLanguage } = options
    this.adapter = adapter
    this.currentLanguage = defaultLanguage.trim()
    this.defaultLanguage = this.currentLanguage
    this.fallbackLanguages = options.fallbackLanguages?.map(language => language.trim()) ?? []
  }

  getAdapter(): BaseAdapter {
    return this.adapter
  }

  getLanguage(): string {
    return this.currentLanguage
  }

  setLanguage(language: string): void {
    this.currentLanguage = language.trim()
  }

  setDefaultLanguage(language: string): void {
    this.defaultLanguage = language.trim()
  }

  /** Select a cardinal or ordinal category without interpreting translation strings. */
  selectPlural(count: number, options?: Intl.PluralRulesOptions, locale = this.currentLanguage): Intl.LDMLPluralRule {
    return new Intl.PluralRules(locale, options).select(count)
  }

  formatNumber(value: number | bigint, options?: Intl.NumberFormatOptions, locale = this.currentLanguage): string {
    return new Intl.NumberFormat(locale, options).format(value)
  }

  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions, locale = this.currentLanguage): string {
    return new Intl.DateTimeFormat(locale, options).format(value)
  }

  private getLocale(): ILocale | null {
    let currentLocale = this.adapter.getLocale(this.currentLanguage)
    if (!currentLocale) {
      currentLocale = this.adapter.getLocale(this.defaultLanguage)
      if (!currentLocale) {
        logger.error(`current locale ${this.currentLanguage} is null`)
        return null
      }
      logger.error(`current locale ${this.currentLanguage} is null, change to default locale ${this.defaultLanguage}`)
    }
    return currentLocale
  }

  translate(phrase: string, args?: any): string | undefined {
    if (this.fallbackLanguages.length > 0) {
      return this.postProcess(this.resolveWithFallbacks(phrase), args)
    }

    const currentLocale = this.getLocale()
    if (!currentLocale) {
      return
    }

    // Flat keys need no array; nested paths are split once, including fallback.
    const keys = phrase.includes('.') ? phrase.split('.') : phrase
    let template = this.resolve(currentLocale, keys)
    if (template === undefined && this.currentLanguage !== this.defaultLanguage) {
      template = this.resolve(this.adapter.getLocale(this.defaultLanguage), keys)
    }
    if (template === undefined) {
      logger.warn(`current locale doesn't contain ${phrase}`)
    }

    return this.postProcess(template, args)
  }

  private resolveWithFallbacks(phrase: string): unknown {
    const languages = new Set([this.currentLanguage, ...this.fallbackLanguages, this.defaultLanguage])
    const keys = phrase.includes('.') ? phrase.split('.') : phrase
    let hasLocale = false

    for (const language of languages) {
      const locale = this.adapter.getLocale(language)
      if (!locale) {
        continue
      }
      hasLocale = true
      const template = this.resolve(locale, keys)
      // Existing non-string values still stop fallback, just as in translate().
      if (template !== undefined) {
        return template
      }
    }

    if (hasLocale) {
      logger.warn(`current locale doesn't contain ${phrase}`)
    } else {
      logger.error(`current locale ${this.currentLanguage} is null`)
    }
  }

  private resolve(locale: ILocale | null, keys: string | string[]): unknown {
    if (typeof keys === 'string') {
      return locale && Object.prototype.hasOwnProperty.call(locale, keys) ? locale[keys] : undefined
    }
    let object: any = locale
    for (const key of keys) {
      if (!object || !Object.prototype.hasOwnProperty.call(object, key)) {
        return
      }
      object = object[key]
    }
    return object
  }

  private postProcess(template: unknown, args?: any): string | undefined {
    if (typeof template !== 'string') {
      return
    }
    if (!args) {
      return template
    }
    let start = template.indexOf('${')
    if (start === -1) {
      return template
    }
    let result = ''
    let cursor = 0
    while (start !== -1) {
      const end = template.indexOf('}', start + 2)
      if (end === -1) {
        break
      }
      const key = template.slice(start + 2, end)
      result += template.slice(cursor, start)
      result += Object.prototype.hasOwnProperty.call(args, key) ? String(args[key]) : template.slice(start, end + 1)
      cursor = end + 1
      start = template.indexOf('${', cursor)
    }
    return result + template.slice(cursor)
  }
}
