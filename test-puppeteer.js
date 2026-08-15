import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    console.log("Puppeteer launched successfully!");
    await browser.close();
  } catch (error) {
    console.error("Puppeteer launch failed:", error);
  }
})();
