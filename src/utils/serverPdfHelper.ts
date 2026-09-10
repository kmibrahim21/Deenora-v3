/**
 * Helper utility for server-side PDF generation via /api/pdf
 * Handles caching in Supabase, Puppeteer rendering, and forced client-side download
 * without redirecting or navigating to external Supabase URLs.
 */

import { solaimanLipiBase64 } from './fonts';
import { downloadBlob, downloadFromUrl } from './fileDownloader';

export interface ServerPdfOptions {
  html: string;
  format?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  entity_type: string;
  entity_id: string;
  filename: string;
  is_published?: boolean;
}

export const SOLAIMAN_LIPI_FONT_STYLE = `
  @font-face {
    font-family: 'SolaimanLipi';
    src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype'),
         url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-normal-v1.0.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'SolaimanLipi';
    src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype'),
         url('https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts@main/fonts/solaiman-lipi/solaimanlipi-bold-v1.0.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
    font-display: swap;
  }
  .font-solaiman, .font-solaiman * {
    font-family: 'SolaimanLipi', sans-serif !important;
  }
`;

export function wrapHtmlForPdf(contentHtml: string, title: string, orientation: 'portrait' | 'landscape' = 'portrait'): string {
  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? '297mm' : '210mm';
  const height = isLandscape ? '210mm' : '297mm';

  return `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        ${SOLAIMAN_LIPI_FONT_STYLE}
        @page {
          size: a4 ${orientation};
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          background-color: #ffffff;
          width: ${width};
          min-height: ${height};
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
        }
        body, body * {
          font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
        }
        * {
          box-sizing: border-box;
        }
      </style>
    </head>
    <body>
      ${contentHtml}
    </body>
    </html>
  `;
}

export async function downloadServerPdf(options: ServerPdfOptions): Promise<boolean> {
  try {
    const response = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data.url) {
        return await downloadFromUrl(data.url, options.filename, 'application/pdf');
      }
    } else {
      // Direct stream
      const blob = await response.blob();
      await downloadBlob(blob, options.filename, 'application/pdf');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('downloadServerPdf error:', err);
    return false;
  }
}
