import { equal } from 'assert';
import path from 'path';
import {fileURLToPath} from 'url';
import  { describe, it } from 'node:test';
import { I18n, FileSyncAdapter, ObjectAdapter } from '../dist/index.cjs';

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fileSyncAdapter = new FileSyncAdapter({
  localesBaseDir: path.resolve(__dirname, './locales'),
});

const objectAdapter = new ObjectAdapter({
  zh: {
    user: {
      name: 'PicList',
      country: '中国',
    },
    report: {
      singular: ' ${cnt}个报告',
      plural: '${cnt}个报告',
    },
  },
  en: {
    user: {
      name: 'PicList',
      country: 'China',
    },
    report: {
      singular: 'only ${cnt} report',
      plural: '${cnt} reports',
    },
  },
});

describe('i18n', () => {
  describe('fileSyncAdapter', () => {
    const i18n = new I18n({
      adapter: fileSyncAdapter,
      defaultLanguage: 'zh',
    });

    it('translate', () => {
      equal(i18n.translate('report.plural', { cnt: 2 }), '2个报告');
    });
    it('setLanguage', () => {
      i18n.setLanguage('en');
      equal(i18n.translate('report.plural', { cnt: 2 }), '2 reports');
    });
  });

  describe('objectAdapter', () => {
    const i18n = new I18n({
      adapter: objectAdapter,
      defaultLanguage: 'zh',
    });
    it('translate', () => {
      equal(i18n.translate('report.plural', { cnt: 2 }), '2个报告');
    });
    it('setLanguage', () => {
      i18n.setLanguage('en');
      equal(i18n.translate('report.plural', { cnt: 2 }), '2 reports');
    });

    it('setLocales', () => {
      objectAdapter.setLocales({
        en: {
          user: {
            name: 'PicList',
            country: 'China',
          },
          post: {
            singular: 'only ${cnt} post',
            plural: '${cnt} posts',
          },
        },
      });
      equal(i18n.translate('post.plural', { cnt: 2 }), '2 posts');

    });
    it('getLocale null & translate to undefined', () => {
      i18n.setLanguage('TEST')
      equal(i18n.translate('test'), undefined)
    })
    it('getLocale null but change to default', () => {
      i18n.setDefaultLanguage('en')
      equal(i18n.translate('user.name'), 'PicList')
    })
    it('language can has upper-case string', () => {
      objectAdapter.setLocale('zh-CN', {
        test: '测试PicList'
      })
      i18n.setLanguage('zh-CN')
      equal(i18n.translate('test'), '测试PicList')
    })
  });
});
