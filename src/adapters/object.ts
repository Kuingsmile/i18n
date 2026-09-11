import { ILocale, ILocaleMap } from '../types'
import { BaseAdapter } from './base'

export class ObjectAdapter extends BaseAdapter {
  private locales: ILocaleMap = {}
  constructor(locales: ILocaleMap) {
    super()
    this.locales = locales
  }

  getLocale(language: string): ILocale | null {
    return this.locales[language] ?? null
  }

  // change the locales
  setLocales(locales: ILocaleMap): void {
    this.locales = locales
  }

  // change the locale dynamic
  setLocale(language: string, locales: ILocale): void {
    this.locales[language] = locales
  }
}
