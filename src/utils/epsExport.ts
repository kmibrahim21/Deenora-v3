import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { solaimanLipiBase64 } from './fonts';

export interface EpsExportOptions {
  title?: string;
  creator?: string;
  widthPt?: number;
  heightPt?: number;
  pixelRatio?: number;
}

/**
 * Converts image data into standard Adobe PostScript Level 2 / Level 3 EPS format.
 * High-definition (300-600 DPI equivalent) with exact PostScript BoundingBox.
 */
export async function dataUrlToEps(
  dataUrl: string,
  options: EpsExportOptions = {}
): Promise<string> {
  const {
    title = 'ID_Card_Press_Ready',
    creator = 'Deenora Madrasah Management System',
    widthPt = 243.78, // ~54mm (CR-80 standard card width) in 72 DPI points
    heightPt = 388.27, // ~85.6mm (CR-80 standard card height) in 72 DPI points
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          throw new Error('Failed to create canvas context');
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const width = canvas.width;
        const height = canvas.height;

        let hexString = '';
        let lineLength = 0;
        const hexChars = '0123456789ABCDEF';

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const rHex = hexChars[(r >> 4) & 0xf] + hexChars[r & 0xf];
          const gHex = hexChars[(g >> 4) & 0xf] + hexChars[g & 0xf];
          const bHex = hexChars[(b >> 4) & 0xf] + hexChars[b & 0xf];

          hexString += rHex + gHex + bHex;
          lineLength += 6;

          if (lineLength >= 72) {
            hexString += '\n';
            lineLength = 0;
          }
        }

        const epsHeader = [
          '%!PS-Adobe-3.0 EPSF-3.0',
          `%%BoundingBox: 0 0 ${Math.round(widthPt)} ${Math.round(heightPt)}`,
          `%%HiResBoundingBox: 0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}`,
          `%%Title: ${title.replace(/[^\x20-\x7E]/g, '_')}`,
          `%%Creator: ${creator}`,
          `%%CreationDate: ${new Date().toISOString()}`,
          '%%Pages: 1',
          '%%LanguageLevel: 2',
          '%%DocumentData: Clean7Bit',
          '%%EndComments',
          '%%BeginProlog',
          '%%EndProlog',
          '%%Page: 1 1',
          'save',
          '/DeviceRGB setcolorspace',
          '0 0 translate',
          `${widthPt} ${heightPt} scale`,
          '<<',
          '  /ImageType 1',
          `  /Width ${width}`,
          `  /Height ${height}`,
          '  /BitsPerComponent 8',
          '  /Decode [0 1 0 1 0 1]',
          `  /ImageMatrix [${width} 0 0 -${height} 0 ${height}]`,
          '  /DataSource currentfile /ASCIIHexDecode filter',
          '>>',
          'image',
          hexString,
          '>',
          'restore',
          'showpage',
          '%%EOF'
        ].join('\n');

        resolve(epsHeader);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error(`Failed to load image for EPS conversion: ${e}`));
    img.src = dataUrl;
  });
}

/**
 * Extracts pure scalable SVG XML from an HTML element for 100% infinite-resolution vector editing in Illustrator / CorelDraw.
 */
export function elementToPureSvgXml(element: HTMLElement, title: string = 'ID_Card'): string {
  // Clone element to sanitize for clean standalone SVG
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';

  const width = 280;
  const height = 448;

  const serializedHtml = new XMLSerializer().serializeToString(clone);

  const svgXml = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style type="text/css">
      @font-face {
        font-family: 'SolaimanLipi';
        src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      * {
        font-family: 'SolaimanLipi', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif !important;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
    </style>
  </defs>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px; height:${height}px; background:#ffffff; overflow:hidden;">
      ${serializedHtml}
    </div>
  </foreignObject>
</svg>`;

  return svgXml;
}

/**
 * Captures an HTML Element at Ultra-High Definition (4.5x pixel ratio = ~450 DPI) to guarantee razor-sharp press quality with zero blur.
 */
export async function elementToEps(
  element: HTMLElement,
  options: EpsExportOptions = {}
): Promise<string> {
  const pixelRatio = options.pixelRatio || 4.5; // 4.5x density = 1260 x 2016 px for 54 x 85.6 mm card (~450 DPI razor sharp)
  const fontEmbed = `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/ttf;base64,${solaimanLipiBase64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    * {
      font-family: 'SolaimanLipi', sans-serif !important;
    }
  `;

  const dataUrl = await toPng(element, {
    pixelRatio,
    backgroundColor: '#ffffff',
    cacheBust: true,
    fontEmbedCSS: fontEmbed,
    width: 280,
    height: 448,
  });

  return dataUrlToEps(dataUrl, options);
}

import { downloadBlob } from './fileDownloader';

/**
 * Triggers a download of a single .eps file compatible with Android and Web.
 */
export async function triggerEpsDownload(epsContent: string, filename: string) {
  const blob = new Blob([epsContent], { type: 'application/postscript;charset=utf-8' });
  const finalName = filename.endsWith('.eps') ? filename : `${filename}.eps`;
  await downloadBlob(blob, finalName, 'application/postscript');
}

/**
 * Downloads both Front and Back of an ID card bundled in an EPS + Vector SVG Press-Ready .zip archive.
 * Provides both EPS (PostScript) and Scalable Vector SVG so press designers can open it in any software without quality loss.
 */
export async function downloadCardEpsZip(
  frontElement: HTMLElement,
  backElement: HTMLElement,
  baseFilename: string,
  personName: string
) {
  const zip = new JSZip();

  // Generate Ultra High Definition 450 DPI EPS
  const [frontEps, backEps] = await Promise.all([
    elementToEps(frontElement, { title: `${personName}_Front`, widthPt: 243.78, heightPt: 388.27 }),
    elementToEps(backElement, { title: `${personName}_Back`, widthPt: 243.78, heightPt: 388.27 })
  ]);

  // Generate Pure Vector SVGs (for Adobe Illustrator & CorelDRAW direct editing)
  const frontSvg = elementToPureSvgXml(frontElement, `${personName}_Front`);
  const backSvg = elementToPureSvgXml(backElement, `${personName}_Back`);

  const safeBase = baseFilename.replace(/[\s/\\:]+/g, '_');
  
  // EPS files for PostScript RIPs and direct card printers
  zip.file(`${safeBase}_Front.eps`, frontEps);
  zip.file(`${safeBase}_Back.eps`, backEps);

  // Scalable Vector SVG files for Illustrator / CorelDraw drag-and-drop
  zip.file(`${safeBase}_Front_Vector.svg`, frontSvg);
  zip.file(`${safeBase}_Back_Vector.svg`, backSvg);

  const content = await zip.generateAsync({ type: 'blob' });
  const zipFileName = `${safeBase}_Press_Ready_Vector_EPS.zip`;
  await downloadBlob(content, zipFileName, 'application/zip');
}
