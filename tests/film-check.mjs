import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Run against the Vite dev server; __cinema is deliberately unavailable in production.
const BASE_URL = process.env.FILM_URL || 'http://localhost:5173';
const output = process.env.FILM_SCREENSHOTS ? resolve(process.env.FILM_SCREENSHOTS) : null;
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 414, height: 896 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
];

async function settle(page) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function seek(page, time) {
  await page.evaluate(value => { window.__cinema.pause(); window.__cinema.seek(value); }, time);
  await settle(page);
  assert.equal(await page.locator('.experience').getAttribute('data-playing'), 'false', 'Seek tests remain paused');
}

async function capture(page, name) {
  // Canvas locator screenshots include overlapping DOM; hide only that ink, not layout.
  const buffer = await page.locator('.webgl-canvas').screenshot({
    type: 'png',
    caret: 'hide',
    style: '.experience > :not(.canvas-layer) { visibility: hidden !important; }',
  });
  if (output) await writeFile(resolve(output, `${name}.png`), buffer);
  return buffer;
}

async function assertFits(page, selector, label) {
  assert.ok(await page.locator(selector).count() > 0, `${label}: expected elements exist`);
  const failures = await page.locator(selector).evaluateAll(elements => elements.flatMap(element => {
    if (element.closest('.cue') && Number(getComputedStyle(element.closest('.cue')).opacity) < 0.01) return [];
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(element).visibility === 'hidden') return [];
    const range = document.createRange();
    range.selectNodeContents(element);
    const fits = [rect, ...range.getClientRects()].every(box => box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1);
    return fits ? [] : [`${element.className}: ${JSON.stringify(rect.toJSON())}`];
  }));
  assert.deepEqual(failures, [], `${label}: elements and text must fit viewport`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label}: no page overflow`);
}

async function assertControls(page) {
  assert.ok(await page.getByRole('button', { name: 'Play', exact: true }).isVisible(), 'Play remains visible while paused');
  assert.ok(await page.getByRole('slider', { name: 'Seek time' }).isVisible(), 'Seek remains accessible');
  assert.equal(await page.locator('.timeline-track').getAttribute('max'), '118');
  assert.equal(await page.locator('.timeline-chapters button').count(), 6);
  const controls = await page.locator('.player-top button').evaluateAll(buttons => buttons.every(button => {
    const rect = button.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  }));
  assert.ok(controls, 'Playback buttons retain 44px targets');
}

function watchErrors(page, errors, label, expectedFallback = false) {
  page.on('console', message => {
    const text = message.text();
    if (expectedFallback && /THREE.WebGLRenderer: (Error creating WebGL context|A WebGL context could not be created)/i.test(text)) return;
    if (message.type() === 'error' || /shader error|shader.*(?:compile|link).*fail|VALIDATE_STATUS.*false/i.test(text)) errors.push(`${label}: ${text}`);
  });
  page.on('pageerror', error => errors.push(`${label}: ${error}`));
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    if (output) await mkdir(output, { recursive: true });
    const context = await browser.newContext({ viewport: viewports[0] });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    watchErrors(page, errors, 'desktop');
    await page.addInitScript(() => {
      window.__filmAudio = { created: 0, beforeGesture: 0 };
      for (const name of ['AudioContext', 'webkitAudioContext']) {
        const NativeAudioContext = window[name];
        if (!NativeAudioContext) continue;
        window[name] = class extends NativeAudioContext {
          constructor(...args) {
            super(...args);
            window.__filmAudio.created++;
            if (!navigator.userActivation.hasBeenActive) window.__filmAudio.beforeGesture++;
          }
        };
      }
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'ENTER EXPERIENCE', exact: true }).waitFor();
    await page.waitForFunction(() => Boolean(window.__cinema));
    assert.deepEqual(await page.evaluate(() => ({
      entered: document.querySelector('.experience').dataset.entered,
      playing: document.querySelector('.experience').dataset.playing,
      time: window.__cinema.time(),
      audio: window.__filmAudio.created,
    })), { entered: 'false', playing: 'false', time: 0, audio: 0 }, 'Lobby waits for a user gesture, including audio');
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await settle(page);
      await assertFits(page, '.lobby-title, .lobby-title span, .lobby-description, .entry-zone button, .entry-note', `Lobby ${viewport.width}px`);
    }
    await page.setViewportSize(viewports[0]);

    await page.locator('.sound-preference').click();
    assert.equal(await page.evaluate(() => window.__filmAudio.created), 0, 'Sound preference alone creates no AudioContext');
    await page.getByRole('button', { name: 'ENTER EXPERIENCE', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.experience').dataset.playing === 'true');
    assert.equal(await page.evaluate(() => window.__filmAudio.beforeGesture), 0, 'Audio never initializes before gesture');
    assert.equal(await page.evaluate(() => window.__cinema.duration()), 118, 'Film lasts 118 seconds');

    for (const [value, expected] of [[-10, 0], [200, 118], [NaN, 0], [Infinity, 0]]) {
      await seek(page, value);
      assert.equal(await page.evaluate(() => window.__cinema.time()), expected, `Clamp invalid seek ${value}`);
    }
    await page.locator('.rendering-notice').waitFor({ state: 'hidden' });
    assert.ok(await page.locator('.webgl-canvas').isVisible(), 'Determinism tests require actual WebGL');

    for (const [a, b] of [[44, 74], [74, 92], [92, 44]]) {
      await seek(page, a);
      const first = await capture(page, `seek-${a}-first`);
      await seek(page, b);
      const other = await capture(page, `seek-${b}-alternate`);
      assert.ok(!first.equals(other), `Different physical worlds at ${a}s and ${b}s must differ`);
      await seek(page, a);
      const repeat = await capture(page, `seek-${a}-repeat`);
      assert.ok(first.equals(repeat), `Exact A/B/A canvas equality at ${a}s; renderer must not retain seek history`);
    }
    await assertControls(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.experience').dataset.playing === 'true');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await page.locator('.experience').getAttribute('data-playing'), 'false');
    await page.getByRole('button', { name: 'Seek to Claude, 00:35', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__cinema.time()), 35, 'Chapter jump uses new timing');
    await seek(page, 118);
    assert.ok(await page.locator('.replay-button').isVisible(), 'End screen provides replay');
    await page.locator('.replay-button').click();
    assert.ok(await page.evaluate(() => window.__cinema.time()) < 2, 'Replay resets the clock');
    await seek(page, 44);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const time of [4, 9, 16, 41, 62, 85, 111]) {
        await seek(page, time);
        await assertFits(page, '.player-top button, .timeline-chapters button, .cue, .cue h2, .cue p', `Film ${viewport.width}px at ${time}s`);
      }
      await assertControls(page);
      if (output) await page.screenshot({ path: resolve(output, `film-${viewport.width}.png`) });
    }
    await context.close();

    // 8. Reduced Motion behavior: stationary tableau
    const reducedContext = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce' });
    const reducedPage = await reducedContext.newPage();
    reducedPage.setDefaultTimeout(45000);
    watchErrors(reducedPage, errors, 'reduced-motion');
    await reducedPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await reducedPage.locator('.sound-preference').click();
    await reducedPage.getByRole('button', { name: 'ENTER EXPERIENCE', exact: true }).click();
    await reducedPage.waitForFunction(() => document.querySelector('.experience').dataset.playing === 'true');
    await seek(reducedPage, 40);
    const red40 = await capture(reducedPage, 'reduced-seek-40');
    await seek(reducedPage, 41);
    const red41 = await capture(reducedPage, 'reduced-seek-41');
    assert.ok(red40.equals(red41), 'Reduced motion holds a stationary world between adjacent seconds in a scene');
    assert.ok(await reducedPage.locator('.webgl-canvas').isVisible(), 'Reduced motion still uses the WebGL world');
    await seek(reducedPage, 65);
    assert.ok(!red40.equals(await capture(reducedPage, 'reduced-seek-65')), 'Reduced-motion chapters still present different worlds');
    await seek(reducedPage, 115.5);
    assert.equal(await reducedPage.locator('.film-whiteout').evaluate(element => getComputedStyle(element).opacity), '0', 'Reduced motion skips whiteout');
    await assertControls(reducedPage);
    await reducedPage.getByRole('button', { name: 'Play', exact: true }).click();
    await reducedPage.waitForFunction(() => document.querySelector('.experience').dataset.playing === 'true');
    await reducedPage.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await reducedPage.locator('.experience').getAttribute('data-playing'), 'false');
    await reducedContext.close();

    // 9. Forced WebGL unavailable fallback test (save original getContext)
    const fallbackContext = await browser.newContext({ viewport: viewports[0] });
    const fallbackPage = await fallbackContext.newPage();
    fallbackPage.setDefaultTimeout(45000);
    watchErrors(fallbackPage, errors, 'fallback', true);
    await fallbackPage.addInitScript(() => {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (typeof type === 'string' && /webgl/i.test(type)) return null;
        return nativeGetContext.call(this, type, ...args);
      };
    });
    await fallbackPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await fallbackPage.locator('.sound-preference').click();
    await fallbackPage.getByRole('button', { name: 'ENTER EXPERIENCE', exact: true }).click();
    await fallbackPage.waitForFunction(() => document.querySelector('.experience').dataset.playing === 'true');
    await fallbackPage.locator('.rendering-notice').waitFor();
    assert.match(await fallbackPage.locator('.rendering-notice').innerText(), /Simplified rendering/);
    assert.equal(await fallbackPage.locator('.fallback-canvas').isVisible(), true, '2D Fallback canvas must be visible');
    assert.equal(await fallbackPage.locator('.webgl-canvas').isVisible(), false, 'WebGL canvas hidden when fallback activates');
    await seek(fallbackPage, 44);
    await assertControls(fallbackPage);
    await fallbackContext.close();

    assert.deepEqual(errors, [], `No runtime, console, or shader errors permitted: ${errors.join('; ')}`);
    console.log('ALL FILM-CHECK ASSERTIONS PASSED');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

