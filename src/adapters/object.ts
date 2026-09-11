import { ILocale, ILocaleMap } from '../types'
import { BaseAdapter } from './base'

export class ObjectAdapter extends BaseAdapter {
  private locales: ILocaleMap = {}
  constructor(locales: ILocaleMap) {
    super()
    this.locales = locales
  }

  getLocale(language: string): ILocale | null {
    if (!Object.prototype.hasOwnProperty.call(this.locales, language)) {
      return null
    }
    return this.locales[language] ?? null
  }

  // change the locales
  setLocales(locales: ILocaleMap): void {
    this.locales = locales
  }

  // change the locale dynamic
  setLocale(language: string, locales: ILocale): void {
    Object.defineProperty(this.locales, language, {
      value: locales,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
}
