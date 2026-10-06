import assert from 'node:assert/strict';
import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(String(err)));

  // Hook AudioContext destination to measure real audio energy
  await page.addInitScript(() => {
    window.__audioMonitor = {
      created: false,
      ctx: null,
      analyser: null,
      getRMS() {
        if (!this.analyser) return 0;
        const data = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        return Math.sqrt(sum / data.length);
      },
    };

    const OrigAudioContext = window.AudioContext;
    window.AudioContext = class extends OrigAudioContext {
      constructor(opts) {
        super(opts);
        window.__audioMonitor.created = true;
        window.__audioMonitor.ctx = this;
        const analyser = this.createAnalyser();
        analyser.fftSize = 512;
        window.__audioMonitor.analyser = analyser;

        // Route destination to analyser
        const origConnect = GainNode.prototype.connect;
        GainNode.prototype.connect = function (dest, ...args) {
          if (dest === this.context.destination) {
            origConnect.call(this, analyser);
          }
          return origConnect.call(this, dest, ...args);
        };
      }
    };
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Before ENTER: no AudioContext
  const preEnterCreated = await page.evaluate(() => window.__audioMonitor.created);

  // 2. Click ENTER: AudioContext is unlocked immediately inside user gesture.
  // Option 1: Instant entry without waiting for long synthesis!
  await page.waitForSelector('.enter-button:not([disabled])');
  const t0 = Date.now();
  await page.click('.enter-button');
  await page.waitForSelector('.experience[data-entered="true"]', { timeout: 3000 });
  const enterLatency = Date.now() - t0;
  assert.ok(enterLatency < 2500, `Option 1 enter must be fast (<2.5s), got ${enterLatency}ms`);

  const postEnterCreated = await page.evaluate(() => window.__audioMonitor.created);

  // 3. Audio output must be active and audible
  await page.waitForFunction(
    () => window.__audioMonitor.ctx?.state === 'running' && window.__audioMonitor.getRMS() > 0.005,
    null,
    { timeout: 5000 }
  );
  const activePlayingRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // Check audibility of each chapter in real time
  for (const time of [2, 16, 38, 62, 88, 110]) {
    await page.evaluate(t => window.__cinema.seek(t), time);
    await page.waitForTimeout(100);
    const rms = await page.evaluate(() => window.__audioMonitor.getRMS());
    assert.ok(rms > 0.005, `Chapter at ${time}s must remain audible: ${rms}`);
  }

  // 4. Measure Muted energy
  await page.keyboard.press('m');
  await page.waitForTimeout(100);
  const mutedRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // Unmute
  await page.keyboard.press('m');
  await page.waitForTimeout(100);

  // 5. Measure Paused energy
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const pausedRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // Resume
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);

  // 6. Test Grok Freeze Dead Silence (94.5–96s)
  await page.evaluate(() => window.__cinema.seek(95));
  await page.waitForTimeout(150);
  const freezeRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // 7. Test Grok Particle Explosion (96s)
  await page.evaluate(() => window.__cinema.seek(96.05));
  await page.waitForTimeout(150);
  const postBurstRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // 8. Test Convergence breath silence (103–104s)
  await page.evaluate(() => window.__cinema.seek(103.3));
  await page.waitForTimeout(150);
  const convergenceSilenceRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // 9. Test Convergence crescendo (104s)
  await page.evaluate(() => window.__cinema.seek(104.2));
  await page.waitForTimeout(150);
  const crescendoRMS = await page.evaluate(() => window.__audioMonitor.getRMS());

  // Scrubbing while paused must stay silent; resume must use the new offset.
  await page.evaluate(() => { window.__cinema.pause(); window.__cinema.seek(31); });
  await page.waitForTimeout(120);
  assert.ok(await page.evaluate(() => window.__audioMonitor.getRMS()) < 0.0005);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => window.__audioMonitor.getRMS()) > 0.005);
  const track = page.locator('.timeline-track');
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.waitForTimeout(120);
  assert.ok(await page.evaluate(() => window.__audioMonitor.getRMS()) < 0.0005, 'Dragging stays silent');
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.experience').getAttribute('data-playing'), 'true');

  await page.evaluate(() => window.__cinema.seek(118));
  await page.waitForTimeout(120);
  assert.ok(await page.evaluate(() => window.__audioMonitor.getRMS()) < 0.0005, 'Ending stops audio');
  await page.locator('.replay-button').click();
  assert.ok(await page.evaluate(() => window.__cinema.time()) < 2, 'Replay resets the master clock');
  await page.evaluate(() => { window.__cinema.pause(); window.__cinema.seek(91); });
  const widths = [320, 375, 414, 768];
  let noOverflow320 = true;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 700 });
    const fits = await page.evaluate(() => [...document.querySelectorAll('.player-top button')].every(button => {
      const rect = button.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.width >= 44;
    }));
    assert.ok(fits, `Playback buttons stay visible with 44px targets at ${width}px`);
    if (width === 320) noOverflow320 = fits;
  }

  const blocked = await context.newPage();
  await blocked.addInitScript(() => { window.AudioContext = class { constructor() { throw new Error('No audio device'); } }; });
  await blocked.goto('http://localhost:5173');
  await blocked.locator('.enter-button').click();
  await blocked.locator('.audio-notice').waitFor();
  assert.equal(await blocked.locator('.experience').getAttribute('data-playing'), 'true', 'Visuals survive audio failure');
  assert.equal(await blocked.locator('.audio-button').isDisabled(), true);
  await browser.close();

  assert.equal(errors.length, 0, `Page errors: ${errors.join(', ')}`);
  assert.equal(preEnterCreated, false, 'AudioContext must not be created before user gesture');
  assert.equal(postEnterCreated, true, 'AudioContext must be created after ENTER');
  assert.ok(activePlayingRMS > 0.005, `Active playing should produce sound, got RMS ${activePlayingRMS}`);
  assert.ok(mutedRMS < 0.0005, `Muted state should be silent, got RMS ${mutedRMS}`);
  assert.ok(pausedRMS < 0.0005, `Paused state should be silent, got RMS ${pausedRMS}`);
  assert.ok(freezeRMS < 0.0005, `Grok freeze must be completely silent, got RMS ${freezeRMS}`);
  assert.ok(postBurstRMS > 0.005, `Particle explosion should produce sound, got RMS ${postBurstRMS}`);
  assert.ok(convergenceSilenceRMS < 0.0005, `Convergence breath must be completely silent, got RMS ${convergenceSilenceRMS}`);
  assert.ok(crescendoRMS > 0.005, `Crescendo hit should produce sound, got RMS ${crescendoRMS}`);
  assert.equal(noOverflow320, true, 'Controls must not overflow 320px viewport');

  console.log('ALL AUDIO ASSERTIONS PASSED');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
