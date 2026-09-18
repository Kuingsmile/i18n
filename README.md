# @piclist/i18n

![npm version](https://img.shields.io/npm/v/@piclist/i18n.svg)
![license](https://img.shields.io/npm/l/@piclist/i18n.svg) ![downloads](https://img.shields.io/npm/dm/@piclist/i18n.svg)

A lightweight, flexible, and powerful internationalization (i18n) library for JavaScript and TypeScript applications.
Designed to work seamlessly in both Node.js and browser environments.

## ✨ Features

- 🚀 **Lightweight & Fast** - Minimal overhead with maximum performance
- 🔧 **Flexible Adapters** - Support for different storage backends
- 🌐 **Universal** - Works in both Node.js and browser environments
- 📝 **TypeScript Support** - Full TypeScript definitions included
- 🎯 **Template Variables** - Dynamic string interpolation with `${variable}` syntax
- 🔌 **Extensible** - Easy to create custom adapters
- 📦 **Small Dependency Footprint** - Runtime dependencies: `chalk` and `tslib`

## 📦 Installation

```bash
npm install @piclist/i18n
```

```bash
yarn add @piclist/i18n
```

```bash
pnpm add @piclist/i18n
```

## 🚀 Quick Start

The package provides both ESM (`import`) and CommonJS (`require`) exports. For Node.js, save ESM examples as `.mjs` (or
use `.js` with `"type": "module"` in your `package.json`) and CommonJS examples as `.cjs`.

### Using ObjectAdapter (Recommended for most cases)

**ESM — `object-example.mjs`:**

```javascript
import { I18n, ObjectAdapter } from '@piclist/i18n'

const adapter = new ObjectAdapter({
  en: {
    greeting: 'Hello, ${name}!',
    user: {
      welcome: 'Welcome back!',
      profile: 'User Profile',
    },
  },
  zh: {
    greeting: '你好，${name}！',
    user: {
      welcome: '欢迎回来！',
      profile: '用户资料',
    },
  },
})

const i18n = new I18n({
  adapter,
  defaultLanguage: 'en',
})

// Basic usage
console.log(i18n.translate('user.welcome')) // "Welcome back!"

// With variables
console.log(i18n.translate('greeting', { name: 'John' })) // "Hello, John!"

// Switch language
i18n.setLanguage('zh')
console.log(i18n.translate('greeting', { name: '张三' })) // "你好，张三！"
```

**CommonJS — `object-example.cjs`:**

```javascript
const { I18n, ObjectAdapter } = require('@piclist/i18n')

const adapter = new ObjectAdapter({
  en: { greeting: 'Hello, ${name}!' },
  zh: { greeting: '你好，${name}！' },
})

const i18n = new I18n({ adapter, defaultLanguage: 'en' })

console.log(i18n.translate('greeting', { name: 'John' })) // "Hello, John!"
i18n.setLanguage('zh')
console.log(i18n.translate('greeting', { name: '张三' })) // "你好，张三！"
```

Run either example with `node object-example.mjs` or `node object-example.cjs` after installing the package.

For browser applications, use `ObjectAdapter` with a bundler that honors the package's `browser` export condition. The
browser entry excludes `FileSyncAdapter`.

### Using FileSyncAdapter (Node.js only)

Create `locales/en.json` using the JSON below, in a `locales` directory next to your example script.

**ESM — `file-example.mjs`:**

```javascript
import { fileURLToPath } from 'node:url'
import { I18n, FileSyncAdapter } from '@piclist/i18n'

const adapter = new FileSyncAdapter({
  localesBaseDir: fileURLToPath(new URL('./locales/', import.meta.url)),
})

const i18n = new I18n({
  adapter,
  defaultLanguage: 'en',
})

console.log(i18n.translate('welcome.message')) // "Welcome to our application!"
```

**CommonJS — `file-example.cjs`:**

```javascript
const path = require('node:path')
const { I18n, FileSyncAdapter } = require('@piclist/i18n')

const adapter = new FileSyncAdapter({
  localesBaseDir: path.resolve(__dirname, './locales'),
})

const i18n = new I18n({
  adapter,
  defaultLanguage: 'en',
})

console.log(i18n.translate('welcome.message')) // "Welcome to our application!"
```

Run either example with `node file-example.mjs` or `node file-example.cjs`. Both resolve the locale directory relative
to the script, regardless of the working directory.

**Locale files structure:**

```text
locales/
└── en.json
```

Add other languages as additional JSON files, such as `zh.json` or `fr.json`.

**locales/en.json:**

```json
{
  "welcome": {
    "message": "Welcome to our application!",
    "subtitle": "Get started by exploring our features"
  },
  "navigation": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 📚 API Reference

### I18n Class

#### Constructor

```typescript
new I18n(options: II18nConstructorOptions)
```

**Options:**

- `adapter`: BaseAdapter - The adapter instance to use for locale data
- `defaultLanguage`: string - The default language code

#### Methods

##### `translate(phrase: string, args?: any): string | undefined`

Translates a phrase using dot notation for nested keys and interpolates `${variable}` placeholders from `args`. Missing
locales or keys fall back to the default language. Returns `undefined` if neither locale is available, the key is still
missing, or the resolved value is not a string. An empty string is a valid translation and is returned unchanged. See
[Fallback Behavior](#fallback-behavior) for details.

```typescript
// Basic translation
i18n.translate('user.name')

// With variables
i18n.translate('welcome.message', { name: 'John', count: 5 })

// Supply application text when no string translation is available.
// Use ?? to preserve valid empty-string translations.
const label = i18n.translate('user.name') ?? 'Unknown user'
```

##### `setLanguage(language: string): void`

Changes the current language.

```typescript
i18n.setLanguage('zh')
```

##### `getLanguage(): string`

Returns the current language code.

```typescript
const currentLang = i18n.getLanguage() // 'en'
```

##### `setDefaultLanguage(language: string): void`

Changes the default fallback language.

```typescript
i18n.setDefaultLanguage('en')
```

##### `getAdapter(): BaseAdapter`

Returns the current adapter instance.

```typescript
const adapter = i18n.getAdapter()
```

### Adapters

#### ObjectAdapter

Stores locale data in memory as JavaScript objects. Perfect for web applications and smaller datasets.

```typescript
new ObjectAdapter(locales: Record<string, ILocale>)
```

**Methods:**

- `getLocale(language: string): ILocale | null` - Get locale data for a specific language
- `setLocale(language: string, locales: ILocale): void` - Add or replace one language's entire locale, preserving other
  languages
- `setLocales(locales: Record<string, ILocale>): void` - Replace the entire locale map; omitted languages are removed

Neither setter merges nested keys. Updates are visible to existing `I18n` instances on their next translation.

**Example:**

```typescript
import { I18n, ObjectAdapter } from '@piclist/i18n'

const adapter = new ObjectAdapter({
  en: { hello: 'Hello' },
  zh: { hello: '你好' },
})

const i18n = new I18n({ adapter, defaultLanguage: 'en' })

// Replace English while preserving Chinese.
adapter.setLocale('en', { hello: 'Hi', goodbye: 'Goodbye' })
console.log(i18n.translate('hello')) // "Hi"

// Replace the entire map. Chinese is removed.
adapter.setLocales({
  en: { hello: 'Hello', goodbye: 'Goodbye' },
  fr: { hello: 'Bonjour', goodbye: 'Au revoir' },
})
console.log(i18n.translate('hello')) // "Hello"
```

#### FileSyncAdapter

Reads locale data from JSON files on the filesystem. Ideal for Node.js applications.

```typescript
new FileSyncAdapter(options: IFileSyncAdapterConstructorOptions)
```

**Options:**

- `localesBaseDir`: string - Absolute path to the directory containing locale files
- `localeFileName?`: Record<string, string> - Optional mapping of language codes to file names

**Methods:**

- `getLocale(language: string): ILocale | null` - Get locale data for a specific language

**Examples:**

```typescript
// Auto-detect locale files
const autoAdapter = new FileSyncAdapter({
  localesBaseDir: '/path/to/locales',
})

// Custom file mapping
const mappedAdapter = new FileSyncAdapter({
  localesBaseDir: '/path/to/locales',
  localeFileName: {
    en: 'english.json',
    zh: 'chinese.json',
  },
})
```

### Creating Custom Adapters

Extend the `BaseAdapter` class to create your own storage backend:

```typescript
import { BaseAdapter, I18n } from '@piclist/i18n'
import type { ILocale } from '@piclist/i18n'

interface Database {
  getLocaleData(language: string): ILocale | null
}

class DatabaseAdapter extends BaseAdapter {
  private db: Database

  constructor(database: Database) {
    super()
    this.db = database
  }

  getLocale(language: string): ILocale | null {
    // Implement your database logic here
    return this.db.getLocaleData(language)
  }
}

// Replace this sample database with your own synchronous data source.
const myDatabase: Database = {
  getLocaleData(language) {
    return language === 'en' ? { greeting: 'Hello from the database!' } : null
  },
}

const adapter = new DatabaseAdapter(myDatabase)
const i18n = new I18n({ adapter, defaultLanguage: 'en' })
console.log(i18n.translate('greeting')) // "Hello from the database!"
```

## 🌟 Advanced Usage

### Nested Translation Keys

Access nested translation keys using dot notation:

```json
{
  "user": {
    "profile": {
      "settings": {
        "privacy": "Privacy Settings"
      }
    }
  }
}
```

```typescript
i18n.translate('user.profile.settings.privacy') // "Privacy Settings"
```

### Variable Interpolation

Use `${variable}` syntax for dynamic content:

```json
{
  "welcome": "Welcome back, ${username}! You have ${count} new messages.",
  "product": {
    "price": "Price: ${currency}${amount}",
    "discount": "${percent}% off until ${date}"
  }
}
```

```typescript
i18n.translate('welcome', {
  username: 'John',
  count: 3,
}) // "Welcome back, John! You have 3 new messages."

i18n.translate('product.price', {
  currency: '$',
  amount: 29.99,
}) // "Price: $29.99"
```

### Fallback Behavior

If the current locale is unavailable, the library tries the default locale. If a key resolves to `undefined` in the
current locale, it tries the same key in the default locale. If neither locale provides the key, `translate()` returns
`undefined`.

Empty strings are returned unchanged. Existing non-string values such as `null`, numbers, or objects return `undefined`
without triggering key fallback.

```typescript
import { I18n, ObjectAdapter } from '@piclist/i18n'

const i18n = new I18n({
  adapter: new ObjectAdapter({
    en: { greeting: 'Hello', empty: 'Default text', count: 'Default count' },
    es: { empty: '', count: 0 }, // greeting key missing
  }),
  defaultLanguage: 'en',
})

i18n.setLanguage('es')
i18n.translate('greeting') // Falls back to "Hello" from English
i18n.translate('missing') // undefined
i18n.translate('empty') // ""
i18n.translate('count') // undefined (no fallback for an existing number)

const text = i18n.translate('missing') ?? 'Translation unavailable'
```

## 🔧 TypeScript Support

The library is written in TypeScript and includes comprehensive type definitions:

```typescript
import { I18n, ObjectAdapter } from '@piclist/i18n'
import type { ILocaleMap, II18nConstructorOptions } from '@piclist/i18n'

// Unrestricted locale definition (compatible with existing consumers)
const locales: ILocaleMap = {
  en: {
    message: 'Hello, world!',
  },
}

const adapter = new ObjectAdapter(locales)
const options: II18nConstructorOptions = { adapter, defaultLanguage: 'en' }
const i18n = new I18n(options)
const message: string | undefined = i18n.translate('message')
console.log(message ?? 'Translation unavailable')
```

Public types are available through `import type` from `@piclist/i18n`: `ILocale`, `ILocaleMap`, `ILocaleFileName`,
`II18nConstructorOptions`, and `IFileSyncAdapterConstructorOptions`.

### Optional typed translations

Use `createTypedI18n()` with a reference locale to infer nested string keys and `${placeholder}` names. Its `t()` helper
is bound to the instance, so components can import or destructure it directly. The factory accepts the same adapter and
language options as `I18n`, plus a `schema` used for type inference. It works with any existing adapter in Node.js and
with browser-compatible adapters in the browser.

```typescript
import { createTypedI18n, ObjectAdapter } from '@piclist/i18n'

const en = {
  navigation: { home: 'Home' },
  welcome: 'Hello, ${name}! You have ${count} messages.',
} as const

export const i18n = createTypedI18n({
  adapter: new ObjectAdapter({
    en,
    fr: {
      navigation: { home: 'Accueil' },
      welcome: 'Bonjour, ${name} ! Vous avez ${count} messages.',
    },
  }),
  defaultLanguage: 'en',
  schema: en,
})

export const { t } = i18n
t('navigation.home') // 'Home'
t('welcome', { name: 'Ada', count: 2 }) // 'Hello, Ada! You have 2 messages.'

// TypeScript errors:
// t('navigation.missing')
// t('welcome')
// t('welcome', { name: 'Ada' }) // Missing count
// t('welcome', { name: 'Ada', count: 2, typo: true })

i18n.setLanguage('fr')
t('navigation.home') // 'Accueil'; the same helper observes language changes

// Dynamic keys and partial arguments remain available through translate().
i18n.translate('any.dynamic.key', { arbitrary: true })
```

Use `as const` on the reference locale to preserve literal strings, including when supplying an inline `schema` object.
Templates widened to `string` (such as JSON imports) still provide key checking but accept an optional
argument record with arbitrary names. Annotating the schema as `ILocale` or `ILocaleMap` loses the literal information
needed for inference.

The helper checks paths to string leaves in object schemas, excluding arrays, non-string leaves, and properties with
literal dots in their names. Templates with placeholders require all named arguments; templates without placeholders
accept no arguments or an empty record. Values use the existing `String()` conversion, including numbers and booleans.
As with normal TypeScript object checks, excess properties are rejected on object literals; a variable may contain
additional properties.

The adapter supplies all runtime translations: `schema` does not load or validate locale data. Keep other locales and
later adapter updates consistent with the reference keys and placeholder names. `t()` preserves fallback behavior and
returns `string | undefined`, just like `translate()`. Existing `I18n`, `ILocale`, and `translate(phrase: string, args?: any)`
signatures remain available unchanged.

The factory also exports `TranslationKeys`, `PlaceholderNames`, `TranslationArgs`, `TypedTranslate`, `TypedI18n`, and
`TypedI18nOptions` for reusable component and application types.

## 🧪 Testing

Run the test suite:

```bash
npm run build
npm test
```

## Performance benchmarks

Run the benchmark against a fresh production build:

```bash
npm run benchmark
```

Save a baseline before changing the implementation, then compare after making changes:

```bash
npm run benchmark -- --output benchmark/results/baseline.json
# Make source changes, then rebuild and compare:
npm run benchmark -- --compare benchmark/results/baseline.json --output benchmark/results/current.json
```

In PowerShell, use `npm.cmd` in these commands when passing benchmark options.

The benchmark covers object and file adapters, nested and rotating keys, interpolation, fallback, language switching,
locale updates, and construction. It uses only Node.js built-ins and generated fixtures. See
[benchmark details and measured results](benchmark/README.md) for methodology, options, and limitations.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to
discuss what you would like to change.

## 📄 License

[MIT](./LICENSE)

Copyright (c) 2025-present Kuingsmile
