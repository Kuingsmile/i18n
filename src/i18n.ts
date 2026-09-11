import { BaseAdapter } from './adapters'
import { II18nConstructorOptions, ILocale } from './types'
import { logger } from './utils'

export class I18n {
  private readonly adapter: BaseAdapter
  private currentLanguage: string
  private defaultLanguage: string

  constructor(options: II18nConstructorOptions) {
    const { adapter, defaultLanguage } = options
    this.adapter = adapter
    this.currentLanguage = defaultLanguage.trim()
    this.defaultLanguage = this.currentLanguage
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
