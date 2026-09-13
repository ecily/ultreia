import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./web-auth.js', import.meta.url), 'utf8');
const loginSource = source.slice(source.indexOf('function renderLogin(role)'), source.indexOf('async function renderVerify()'));
for (const role of ['provider', 'admin', 'pilgrim']) {
  for (const locale of ['de', 'en', 'es']) {
    it(`shows a localized shutdown and prevents repeat submits for ${role}/${locale}`, async () => {
      let submit;
      let calls = 0;
      const button = { disabled: false, setAttribute() {}, removeAttribute() {} };
      const message = { textContent: '' };
      const form = { addEventListener(_event, handler) { submit = handler; }, querySelector() { return button; } };
      const context = {
        tx: key => key, webShell() {}, currentWebLanguage: () => locale,
        document: { querySelector: selector => selector === '[data-auth-form]' ? form : message },
        window: { sessionStorage: { setItem() {} } }, WEB_SCOPE_KEY: 'scope',
        FormData: class { get(key) { return key === 'localTest' ? 'on' : 'test@example.test'; } },
        webApi: async () => { calls++; throw { status: 'magic_link_temporarily_disabled', httpStatus: 403 }; },
      };
      vm.runInNewContext(loginSource + `\nrenderLogin('${role}');`, context);
      await submit({ preventDefault() {}, currentTarget: form });
      assert.equal(button.disabled, true);
      assert.match(message.textContent, { de: /vorübergehend deaktiviert/, en: /temporarily disabled/, es: /desactivado temporalmente/ }[locale]);
      assert.doesNotMatch(message.textContent, /403|magic_link|HTTP/);
      await submit({ preventDefault() {}, currentTarget: form });
      assert.equal(calls, 1);
    });
  }
}
