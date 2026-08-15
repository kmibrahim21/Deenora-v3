import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { html, format = 'A4', landscape = false, margin = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true
    });
    
    const page = await browser.newPage();
    
    // Emulate light theme so Tailwind dark mode doesn't trigger
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: 'light' }
    ]);
    
    // Set viewport and content
    await page.setContent(html, { waitUntil: ['load', 'networkidle0'] });
    
    const pdfBuffer = await page.pdf({
      format: format,
      landscape: landscape,
      printBackground: true,
      margin: margin
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Puppeteer PDF generation error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  }
}
