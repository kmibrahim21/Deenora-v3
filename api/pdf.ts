import { Request, Response } from 'express';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { html, format = 'a4', orientation = 'portrait' } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required.' });
    }

    // Configure Sparticuz Chromium for Vercel/Serverless
    const executablePath = await chromium.executablePath();
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 } as any,
      executablePath: executablePath || '/usr/bin/google-chrome', // Fallback for local env if installed
      headless: true,
    });

    const page = await browser.newPage();
    
    // Set HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0' as any,
    });

    // Emulate print media
    await page.emulateMediaType('print');

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: format as any,
      landscape: orientation === 'landscape',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });

    await browser.close();

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    
    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
}
