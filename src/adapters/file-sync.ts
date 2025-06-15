import fs from 'node:fs'
import path from 'node:path'

import { IFileSyncAdapterConstructorOptions, ILocale,ILocaleFileName, ILocaleMap } from '../types'
import { logger } from '../utils'
import { BaseAdapter } from './base'

export class FileSyncAdapter extends BaseAdapter {
  private locales: ILocaleMap = {}
  private localeFileName: ILocaleFileName = {}
  private readonly localesBaseDir: string

  constructor (options: IFileSyncAdapterConstructorOptions) {
    super()
    const { localesBaseDir, localeFileName } = options
    this.localesBaseDir = localesBaseDir
    if (localeFileName !== null  && localeFileName !== undefined) {
      this.localeFileName = localeFileName
    } else {
      this.guessLocaleFileName(localesBaseDir)
    }
  }

  getLocale (language: string): ILocale {
    if (!this.locales[language]) {
      this.loadLocale(language)
    }
    return this.locales[language]
  }

  private loadLocale (language: string): void {
    if (!this.localeFileName[language]) {
      logger.error(`can't locate the locale file of language ${language}`)
      return
    }
    const filePath = path.join(this.localesBaseDir, this.localeFileName[language])
    const fileContent = fs.readFileSync(filePath, {
      encoding: 'utf-8'
    })
    try {
      const locale = JSON.parse(fileContent)
      this.locales[language] = locale
    } catch (err: any) {
      logger.error(`unable to parse locales from file (maybe ${filePath} is empty or invalid json?)`)
      logger.error(`raw error info: ${err}`)
    }
  }

  private guessLocaleFileName (dir: string): void {
    const files = fs.readdirSync(dir)
    const localeFileName: ILocaleFileName = {}
    files.forEach((fileName: string) => {
      const localeName = fileName.replace(path.extname(fileName), '')
      localeFileName[localeName] = fileName
    })
    logger.log(`guess locale file path from ${dir}`)
    logger.log(`localeFileName: ${JSON.stringify(localeFileName)}`)
    this.localeFileName = localeFileName
  }
}
