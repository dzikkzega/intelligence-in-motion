import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const dir = 'C:/Users/user/.gemini/antigravity/brain/bfc18027-e99e-467d-b62f-ce65f5bb1fb5/scratch/frames';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.locator('.enter-button').waitFor({ timeout: 15000 });
await page.screenshot({ path: `${dir}/00-lobby.png` });

// Mute before entering to enter immediately
await page.locator('.sound-preference').click();
await page.locator('.enter-button').click();
await page.waitForSelector('.experience[data-entered="true"]');
await page.evaluate(() => window.__cinema.pause());

const timestamps = [5, 18, 23, 29, 34, 40, 44, 47, 52, 57, 62, 67, 70.5, 76, 80, 87, 92, 98, 102, 106, 112];
for (const time of timestamps) {
  await page.evaluate(t => { window.__cinema.pause(); window.__cinema.seek(t); }, time);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.screenshot({ path: `${dir}/${String(time).padStart(5, '0')}.png` });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => { window.__cinema.seek(62); });
await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
await page.screenshot({ path: `${dir}/mobile-62.png` });

const fallbackCount = await page.locator('.rendering-notice').count();
const duration = await page.evaluate(() => window.__cinema.duration());
console.log(JSON.stringify({ errors, fallbackCount, duration }, null, 2));

await browser.close();
