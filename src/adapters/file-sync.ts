import fs from 'node:fs'
import path from 'node:path'

import { IFileSyncAdapterConstructorOptions, ILocale, ILocaleFileName, ILocaleMap } from '../types'
import { logger } from '../utils'
import { BaseAdapter } from './base'

export class FileSyncAdapter extends BaseAdapter {
  private locales: ILocaleMap = Object.create(null)
  private localeFileName: ILocaleFileName = Object.create(null)
  private readonly localesBaseDir: string

  constructor(options: IFileSyncAdapterConstructorOptions) {
    super()
    const { localesBaseDir, localeFileName } = options
    this.localesBaseDir = localesBaseDir
    if (localeFileName !== null && localeFileName !== undefined) {
      this.localeFileName = localeFileName
    } else {
      this.guessLocaleFileName(localesBaseDir)
    }
  }

  getLocale(language: string): ILocale | null {
    if (!this.locales[language]) {
      this.loadLocale(language)
    }
    return this.locales[language] ?? null
  }

  private loadLocale(language: string): void {
    if (!Object.prototype.hasOwnProperty.call(this.localeFileName, language) || !this.localeFileName[language]) {
      logger.error(`can't locate the locale file of language ${language}`)
      return
    }
    const filePath = path.join(this.localesBaseDir, this.localeFileName[language])
    try {
      const fileContent = fs.readFileSync(filePath, {
        encoding: 'utf-8',
      })
      const locale = JSON.parse(fileContent)
      this.locales[language] = locale
    } catch {
      logger.error(`unable to read or parse locale file ${filePath}`)
    }
  }

  private guessLocaleFileName(dir: string): void {
    const files = fs.readdirSync(dir, { withFileTypes: true })
    const localeFileName: ILocaleFileName = Object.create(null)
    files.forEach(file => {
      if (!file.isFile() || path.extname(file.name) !== '.json') {
        return
      }
      const localeName = path.basename(file.name, '.json')
      localeFileName[localeName] = file.name
    })
    logger.log(`guess locale file path from ${dir}`)
    logger.log(`localeFileName: ${JSON.stringify(localeFileName)}`)
    this.localeFileName = localeFileName
  }
}
