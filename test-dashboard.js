import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
    // Try to log in? We don't have credentials easily available here, but we can check if it rendered the login screen.
    const content = await page.content();
    if (content.includes('login') || content.includes('Login')) {
       console.log('Login screen visible');
    }
  } catch (e) {
    console.log('Timeout or error:', e.message);
  }
  await browser.close();
})();
