import { BaseAdapter } from '../adapters'
export type ILocaleFileName = Record<string, string>

export type ILocale = Record<string, any>

export type ILocaleMap = Record<string, ILocale>

export interface II18nConstructorOptions {
  adapter: BaseAdapter
  defaultLanguage: string
}

export interface IFileSyncAdapterConstructorOptions {
  localesBaseDir: string
  localeFileName?: ILocaleFileName
}

export enum EFileChangeType {
  change = 'change',
}

export enum ERUN_ENV {
  dev = 'development',
}

export enum EPlatform {
  node = 'node',
  web = 'web',
}
