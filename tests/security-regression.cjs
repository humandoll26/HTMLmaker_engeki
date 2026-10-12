// Run with PLAYWRIGHT_MODULE pointing to Playwright and BASE_URL to a local server.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/HTMLmaker_engeki/';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local tests only');
const key = 'small-theater-lp-generator-data';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNd0AAAAASUVORK5CYII=';
const text = '日本語 "引用" と\'単引用\' & <script>parent.proof=1</script>';
const malicious = {
  page: {title: text}, hero: {headline: text, imageUrl: 'missing-image" data-proof="added', buttonUrl: 'jAvAsCrIpT:parent.proof=1'},
  cast: [{name: text, imageUrl: 'data:text/html,<script>parent.proof=1</script>'}],
  ticket: {buttonUrl: 'java\tscript:parent.proof=1'}, cta: {buttonUrl: 'data:text/html,marker'},
  contact: {websiteUrl: 'javascript:parent.proof=1', email: 'user" onmouseover="parent.proof=1@example.org'},
  seo: {metaDescription: text, ogTitle: text, ogDescription: text, faviconURL: 'javascript:parent.proof=1', ogImageURL: 'data:image/svg+xml,<svg onload="parent.proof=1"/>'},
  design: {primaryColor: '</style><script>parent.proof=1</script>', accentColor: 'red; background:url(https://invalid.test/)', backgroundColor: '</style><img src=x onerror="parent.proof=1">', textColor: '</style><script>parent.proof=1</script>'}
};

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const context = await browser.newContext({acceptDownloads: true});
  const errors = [], blockedRequests = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'file:' && process.env.TEST_OUTPUT && url.href === pathToFileURL(path.join(process.env.TEST_OUTPUT, 'lp-export.html')).href) return route.continue();
    if (url.hostname !== '127.0.0.1') { blockedRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept().catch(error => {
    if (!error.message.includes('No dialog is showing')) errors.push(String(error));
  }));
  await page.addInitScript(({key, data}) => { if (window === top && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data)); }, {key, data: malicious});
  await page.goto(base);
  while (await page.locator('.panel-toggle[aria-expanded="false"]').count()) await page.locator('.panel-toggle[aria-expanded="false"]').first().click();
  await page.locator('#preview-frame[srcdoc]').waitFor();
  const inspect = async () => {
    const src = await page.locator('#preview-frame').getAttribute('srcdoc');
    const parsed = await page.evaluate(src => {
      const doc = new DOMParser().parseFromString(src, 'text/html');
      return {scripts: doc.scripts.length, badAttrs: [...doc.querySelectorAll('*')].flatMap(el => [...el.attributes].filter(a => a.name.startsWith('on') || a.name === 'data-proof')),
        unsafe: [...doc.querySelectorAll('[href],[src]')].filter(el => /^(javascript|data:text)/i.test(el.getAttribute('href') || el.getAttribute('src'))).length,
        title: doc.title, meta: doc.querySelector('meta[name="description"]').content, color: doc.querySelector('style').textContent};
    }, src);
    assert.equal(parsed.scripts, 0); assert.equal(parsed.badAttrs.length, 0); assert.equal(parsed.unsafe, 0);
    assert.equal(parsed.title, text); assert.equal(parsed.meta, text); assert(!parsed.color.includes('</style>'));
    assert.equal(await page.evaluate(() => window.proof), undefined);
    assert.equal(await page.locator('#preview-frame').getAttribute('sandbox'), '');
    return src;
  };
  const hostileHtml = await inspect();
  const hostileOutput = await context.newPage();
  await hostileOutput.setContent(hostileHtml);
  assert.equal(await hostileOutput.evaluate(() => window.proof), undefined);
  assert.equal(await hostileOutput.locator('script,[onerror],[data-proof]').count(), 0);
  await hostileOutput.close();
  assert((await page.locator('#publish-check-summary').innerText()).includes('安全でないURL'));
  // Explicit JSON import and stored draft reload reach the same protected output.
  await page.locator('#input-upload-json').setInputFiles({name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malicious))});
  await inspect();
  await page.evaluate(({key, data}) => localStorage.setItem(key, JSON.stringify(data)), {key, data: malicious});
  await page.locator('#btn-load-local').click(); await inspect();
  // Even synthetic scripts placed directly in the preview cannot access the parent.
  await page.evaluate(() => { document.querySelector('#preview-frame').srcdoc = '<script>parent.proof=1</script><img src=x onerror="parent.proof=2">'; });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.proof), undefined);
  const frame = page.frames().find(frame => frame.parentFrame());
  assert(await frame.evaluate(() => { try { void parent.document.body; return false; } catch { return true; } }));

  const normal = {page: {title: text}, hero: {headline: text, imageUrl: png, buttonUrl: '#ticket'},
    overview: {description: '一行目\n二行目<br>三行目'}, ticket: {buttonUrl: './reserve.html', buttonText: '予約'},
    cta: {buttonUrl: 'mailto:booking@example.org', buttonText: '予約'}, access: {mapUrl:'../tickets/?a=1&b=2'}, schedule: {rows: [{date: '2026/10/20', time: '14:00'}]},
    contact: {email: 'user@example.org', phone: '03-1234-5678', websiteUrl: 'https://example.org/'},
    cast: [{name: '俳優 "名前"', imageUrl: png}], seo: {metaDescription: text, faviconURL: png, ogImageURL: png}};
  await page.locator('#input-upload-json').setInputFiles({name:'normal.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(normal))});
  await page.waitForFunction(png => document.querySelector('#preview-frame').srcdoc.includes(png), png);
  assert(!(await page.locator('#publish-check-summary').getAttribute('class')).includes('is-error'));
  await page.locator('#btn-preview-desktop').click(); assert((await page.locator('#preview-frame').getAttribute('class')).includes('desktop'));
  await page.locator('#btn-preview-mobile').click(); assert((await page.locator('#preview-frame').getAttribute('class')).includes('mobile'));
  await page.locator('[data-bind="hero.headline"]').fill('手入力 "日本語"');
  assert((await page.locator('#preview-frame').getAttribute('srcdoc')).includes('手入力 &quot;日本語&quot;'));
  await page.locator('[data-image-target="hero.imageUrl"]').setInputFiles({name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64')});
  await page.waitForTimeout(100);
  await page.locator('[data-add-collection="cast"]').click();
  assert.equal(await page.locator('.cast-item').count(), 2);
  await page.locator('[data-remove-collection="cast"]').first().click(); assert.equal(await page.locator('.cast-item').count(), 1);
  const download = async id => { const event = page.waitForEvent('download'); await page.locator(id).click(); const dl = await event; return fs.readFile(await dl.path(), 'utf8'); };
  const html = await download('#btn-download-html'); const css = await download('#btn-download-css'); const json = await download('#btn-download-json');
  assert(css.includes('.lp-page')); assert.equal(JSON.parse(json).page.title, text);
  const exported = await context.newPage();
  if (process.env.TEST_OUTPUT) {
    await fs.writeFile(path.join(process.env.TEST_OUTPUT, 'lp-export.html'), html);
    await exported.goto(pathToFileURL(path.join(process.env.TEST_OUTPUT, 'lp-export.html')).href);
  } else await exported.setContent(html);
  assert.equal(await exported.title(), text);
  assert.equal(await exported.locator('meta[name="description"]').getAttribute('content'), text);
  assert.equal(await exported.locator('script').count(), 0);
  assert.equal(await exported.locator('a[href="./reserve.html"]').count(), 1);
  assert.equal(await exported.locator('a[href="mailto:user@example.org"]').count(), 1);
  assert.equal(await exported.locator('a[href="mailto:booking@example.org"]').count(), 1);
  assert.equal(await exported.locator('a[href="tel:03-1234-5678"]').count(), 1);
  assert.equal(await exported.locator('a[href="../tickets/?a=1&b=2"]').count(), 1);
  assert(await exported.locator('.hero-image').evaluate(image => image.complete && image.naturalWidth > 0));
  await page.locator('#btn-save-local').click(); await page.reload();
  assert.equal(await page.locator('[data-bind="hero.headline"]').inputValue(), '手入力 "日本語"');
  assert.equal(errors.length, 0, errors.join('\n'));
  if (process.env.TEST_OUTPUT) { await fs.mkdir(process.env.TEST_OUTPUT, {recursive:true}); await fs.writeFile(path.join(process.env.TEST_OUTPUT, 'lp-export.html'), html); await page.screenshot({path:path.join(process.env.TEST_OUTPUT, 'lp.png'), fullPage:true}); }
  console.log('PASS: LP saved hostile draft/import/reload, attribute/protocol/CSS injection, sandbox, normal input/images/sections/mobile-PC/downloads/persistence');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
