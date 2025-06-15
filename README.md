# @piclist/i18n

![npm version](https://img.shields.io/npm/v/@piclist/i18n.svg)
![license](https://img.shields.io/npm/l/@piclist/i18n.svg)
![downloads](https://img.shields.io/npm/dm/@piclist/i18n.svg)

A lightweight, flexible, and powerful internationalization (i18n) library for JavaScript and TypeScript applications. Designed to work seamlessly in both Node.js and browser environments.

## ✨ Features

- 🚀 **Lightweight & Fast** - Minimal overhead with maximum performance
- 🔧 **Flexible Adapters** - Support for different storage backends
- 🌐 **Universal** - Works in both Node.js and browser environments
- 📝 **TypeScript Support** - Full TypeScript definitions included
- 🎯 **Template Variables** - Dynamic string interpolation with `${variable}` syntax
- 🔌 **Extensible** - Easy to create custom adapters
- 📦 **Zero Dependencies** - No external dependencies required

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

### Using ObjectAdapter (Recommended for most cases)

```typescript
import { I18n, ObjectAdapter } from '@piclist/i18n';

const adapter = new ObjectAdapter({
  en: {
    greeting: 'Hello, ${name}!',
    user: {
      welcome: 'Welcome back!',
      profile: 'User Profile'
    }
  },
  zh: {
    greeting: '你好，${name}！',
    user: {
      welcome: '欢迎回来！',
      profile: '用户资料'
    }
  }
});

const i18n = new I18n({
  adapter,
  defaultLanguage: 'en'
});

// Basic usage
console.log(i18n.translate('user.welcome')); // "Welcome back!"

// With variables
console.log(i18n.translate('greeting', { name: 'John' })); // "Hello, John!"

// Switch language
i18n.setLanguage('zh');
console.log(i18n.translate('greeting', { name: '张三' })); // "你好，张三！"
```

### Using FileSyncAdapter (Node.js only)

```typescript
import { I18n, FileSyncAdapter } from '@piclist/i18n';
import path from 'path';

const adapter = new FileSyncAdapter({
  localesBaseDir: path.resolve(__dirname, './locales')
});

const i18n = new I18n({
  adapter,
  defaultLanguage: 'en'
});

console.log(i18n.translate('welcome.message'));
```

**Locale files structure:**

```text
locales/
├── en.json
├── zh.json
└── fr.json
```

**en.json:**

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

##### `translate(phrase: string, args?: object): string`

Translates a phrase using dot notation for nested keys.

```typescript
// Basic translation
i18n.translate('user.name');

// With variables
i18n.translate('welcome.message', { name: 'John', count: 5 });
```

##### `setLanguage(language: string): void`

Changes the current language.

```typescript
i18n.setLanguage('zh');
```

##### `getLanguage(): string`

Returns the current language code.

```typescript
const currentLang = i18n.getLanguage(); // 'en'
```

##### `setDefaultLanguage(language: string): void`

Changes the default fallback language.

```typescript
i18n.setDefaultLanguage('en');
```

##### `getAdapter(): BaseAdapter`

Returns the current adapter instance.

```typescript
const adapter = i18n.getAdapter();
```

### Adapters

#### ObjectAdapter

Stores locale data in memory as JavaScript objects. Perfect for web applications and smaller datasets.

```typescript
new ObjectAdapter(locales: Record<string, ILocale>)
```

**Methods:**

- `getLocale(language: string): ILocale | null` - Get locale data for a specific language
- `setLocales(locales: Record<string, ILocale>): void` - Update locale data dynamically

**Example:**

```typescript
const adapter = new ObjectAdapter({
  en: { hello: 'Hello' },
  zh: { hello: '你好' }
});

// Update locales dynamically
adapter.setLocales({
  en: { hello: 'Hello', goodbye: 'Goodbye' },
  fr: { hello: 'Bonjour', goodbye: 'Au revoir' }
});
```

#### FileSyncAdapter

Reads locale data from JSON files on the filesystem. Ideal for Node.js applications.

```typescript
new FileSyncAdapter(options: IFileSyncAdapterOptions)
```

**Options:**

- `localesBaseDir`: string - Absolute path to the directory containing locale files
- `localeFileName?`: Record<string, string> - Optional mapping of language codes to file names

**Methods:**

- `getLocale(language: string): ILocale | null` - Get locale data for a specific language

**Examples:**

```typescript
// Auto-detect locale files
const adapter = new FileSyncAdapter({
  localesBaseDir: '/path/to/locales'
});

// Custom file mapping
const adapter = new FileSyncAdapter({
  localesBaseDir: '/path/to/locales',
  localeFileName: {
    'en': 'english.json',
    'zh': 'chinese.json'
  }
});
```

### Creating Custom Adapters

Extend the `BaseAdapter` class to create your own storage backend:

```typescript
import { BaseAdapter, ILocale } from '@piclist/i18n';

class DatabaseAdapter extends BaseAdapter {
  private db: Database;

  constructor(database: Database) {
    super();
    this.db = database;
  }

  getLocale(language: string): ILocale | null {
    // Implement your database logic here
    return this.db.getLocaleData(language);
  }
}

// Usage
const adapter = new DatabaseAdapter(myDatabase);
const i18n = new I18n({ adapter, defaultLanguage: 'en' });
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
i18n.translate('user.profile.settings.privacy'); // "Privacy Settings"
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
  count: 3 
}); // "Welcome back, John! You have 3 new messages."

i18n.translate('product.price', { 
  currency: '$', 
  amount: 29.99 
}); // "Price: $29.99"
```

### Fallback Behavior

When a translation key is not found in the current language, the library automatically falls back to the default language:

```typescript
const i18n = new I18n({
  adapter: new ObjectAdapter({
    en: { greeting: 'Hello' },
    es: { /* greeting key missing */ }
  }),
  defaultLanguage: 'en'
});

i18n.setLanguage('es');
i18n.translate('greeting'); // Falls back to "Hello" from English
```

## 🔧 TypeScript Support

The library is written in TypeScript and includes comprehensive type definitions:

```typescript
import { I18n, ObjectAdapter, ILocale, II18nConstructorOptions } from '@piclist/i18n';

// Type-safe locale definition
const locales: Record<string, ILocale> = {
  en: {
    message: 'Hello, world!'
  }
};

const adapter = new ObjectAdapter(locales);
const i18n = new I18n({ adapter, defaultLanguage: 'en' });
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2020 PicGo Group
Copyright (c) 2025 Kuingsmile
