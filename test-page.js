import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Timeout or error:', e.message);
  }
  await browser.close();
})();
