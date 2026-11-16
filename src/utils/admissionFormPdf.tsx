import { toJpeg, toPng } from 'html-to-image';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdmissionFormData, AdmissionFormConfig, AdmissionFormLang } from '../components/admission_form/types';
import { Institution } from '../types';
import AdmissionFormPreview from '../components/admission_form/AdmissionFormPreview';
import { downloadServerPdf, wrapHtmlForPdf, SOLAIMAN_LIPI_FONT_STYLE } from './serverPdfHelper';
import { downloadBlob } from './fileDownloader';

/**
 * Converts an external image URL to base64 via the local image proxy.
 * Prevents CORS taint issues on mobile and desktop browsers.
 */
export const getBase64Image = async (url: string): Promise<string | null> => {
  try {
    if (!url) return null;
    if (url.startsWith('data:')) return url;

    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      const directRes = await fetch(url).catch(() => null);
      if (directRes && directRes.ok) {
        const blob = await directRes.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Image to base64 conversion error:', error);
    return null;
  }
};

/**
 * Converts a single A4 page HTML element (210mm x 297mm) to a high-quality JPEG/PNG image data URL.
 */
export const elementToImageDataUrl = async (element: HTMLElement): Promise<string> => {
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  const targetPadding = element.style.padding || '10mm 12mm 10mm 12mm';

  // Method 1: html-to-image toJpeg
  try {
    const dataUrl = await toJpeg(element, {
      quality: 0.96,
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      fontEmbedCSS: SOLAIMAN_LIPI_FONT_STYLE,
      style: {
        transform: 'none',
        transformOrigin: 'none',
        margin: '0',
        padding: targetPadding,
        boxSizing: 'border-box',
        width: '210mm',
        height: '297mm',
        maxWidth: 'none',
        maxHeight: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      },
    });

    if (dataUrl && dataUrl.length > 1000) {
      return dataUrl;
    }
  } catch (err1) {
    console.warn('html-to-image toJpeg failed, trying toPng fallback:', err1);
  }

  // Method 2: html-to-image toPng
  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2.0,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      fontEmbedCSS: SOLAIMAN_LIPI_FONT_STYLE,
      style: {
        transform: 'none',
        transformOrigin: 'none',
        margin: '0',
        padding: targetPadding,
        boxSizing: 'border-box',
        width: '210mm',
        height: '297mm',
      },
    });

    if (dataUrl && dataUrl.length > 1000) {
      return dataUrl;
    }
  } catch (err2) {
    console.warn('html-to-image toPng failed, trying html2canvas-pro fallback:', err2);
  }

  // Method 3: html2canvas-pro fallback
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 794,
    windowHeight: 1123,
  });

  return canvas.toDataURL('image/jpeg', 0.95);
};

/**
 * Generates a single or multi-page A4 PDF from an array of Image Data URLs.
 */
export const saveImagesAsA4Pdf = async (imgDataUrls: string[], fileName: string): Promise<void> => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  imgDataUrls.forEach((imgDataUrl, idx) => {
    if (idx > 0) {
      pdf.addPage('a4', 'portrait');
    }
    pdf.addImage(imgDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const blob = pdf.output('blob');
  await downloadBlob(blob, fileName, 'application/pdf');
};

/**
 * Backward-compatible single-page helper.
 */
export const saveImageAsA4Pdf = async (imgDataUrl: string, fileName: string): Promise<void> => {
  await saveImagesAsA4Pdf([imgDataUrl], fileName);
};

/**
 * Headless direct Admission Form Image-to-PDF Generator.
 * Supports both 1-page compact and 2-page double-sided A4 layouts.
 */
export const exportAdmissionFormHeadless = async ({
  formData,
  madrasah,
  lang,
  config,
  isBlank = false,
  fileName,
  onProgress,
}: {
  formData: AdmissionFormData;
  madrasah: Institution | null;
  lang: AdmissionFormLang;
  config: AdmissionFormConfig;
  isBlank?: boolean;
  fileName?: string;
  onProgress?: (progress: number, stepText: string) => void;
}): Promise<void> => {
  onProgress?.(15, lang === 'bn' ? 'লোগো ও ছবি প্রক্রিয়াকরণ করা হচ্ছে...' : 'Processing logo & images...');

  let safeLogoUrl = madrasah?.logo_url || null;
  let safePhotoUrl = formData.photoUrl || null;

  if (safeLogoUrl) {
    const base64Logo = await getBase64Image(safeLogoUrl);
    if (base64Logo) safeLogoUrl = base64Logo;
  }

  if (safePhotoUrl && !isBlank) {
    const base64Photo = await getBase64Image(safePhotoUrl);
    if (base64Photo) safePhotoUrl = base64Photo;
  }

  const preparedMadrasah = madrasah ? { ...madrasah, logo_url: safeLogoUrl } : null;

  const emptyFormData: AdmissionFormData = {
    formNumber: '',
    admissionDate: '',
    academicYear: '',
    session: '',
    studentName: '',
    studentNameEn: '',
    username: '',
    biometricId: '',
    birthRegNo: '',
    date_of_birth: '',
    gender: undefined,
    blood_group: '',
    religion: '',
    nationality: '',
    admissionClass: '',
    department: '',
    residentialStatus: '',
    photoUrl: '',
    fatherName: '',
    fatherOccupation: '',
    fatherNid: '',
    motherName: '',
    motherOccupation: '',
    motherNid: '',
    guardian_name: '',
    guardianRelation: '',
    guardian_phone: '',
    whatsappNumber: '',
    emergencyPhone: '',
    presentAddress: '',
    permanentAddress: '',
    previousInstitution: '',
    previousClass: '',
    tcNumber: '',
    admissionFee: '',
    monthlyFee: '',
    receiptNumber: '',
    admission_number: '',
    roll: undefined,
    documentsChecked: [],
  };

  const preparedFormData = isBlank ? emptyFormData : { ...formData, photoUrl: safePhotoUrl || '' };
  const isTwoPage = config.layoutMode === '2-page';

  onProgress?.(35, lang === 'bn' ? 'লেআউট ও ফন্ট রেন্ডার করা হচ্ছে...' : 'Rendering layout & fonts...');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '794px';
  container.style.height = isTwoPage ? '2246px' : '1123px';
  container.style.overflow = 'hidden';
  container.style.zIndex = '-9999';
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        <div style={{ width: '794px', height: isTwoPage ? '2246px' : '1123px', backgroundColor: '#ffffff' }}>
          <AdmissionFormPreview
            formData={preparedFormData}
            madrasah={preparedMadrasah}
            lang={lang}
            config={config}
            isPrint={true}
            hideButtons={true}
            isBlank={isBlank}
          />
        </div>
      );
      setTimeout(resolve, 600);
    });

    onProgress?.(65, lang === 'bn' ? 'হাই-কোয়ালিটি ভেক্টর/পিডিএফ তৈরি হচ্ছে...' : 'Generating high quality PDF...');

    const printAreaElement = (container.querySelector('#print-area') as HTMLElement) || (container.firstElementChild as HTMLElement);
    const page1El = container.querySelector('#print-page-1') as HTMLElement;
    const page2El = container.querySelector('#print-page-2') as HTMLElement;

    const defaultFileName = isBlank
      ? 'Admission_Form_Blank.pdf'
      : `Admission_Form_${(formData.studentNameEn || formData.studentName || 'Student').replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')}.pdf`;
    const finalFileName = fileName || defaultFileName;

    // Try server-side PDF generation first with SolaimanLipi font
    try {
      const targetHtml = printAreaElement.outerHTML;
      const fullHtml = wrapHtmlForPdf(targetHtml, finalFileName, 'portrait');
      const serverSuccess = await downloadServerPdf({
        html: fullHtml,
        format: 'a4',
        orientation: 'portrait',
        entity_type: 'admission_form',
        entity_id: isBlank ? 'blank' : (formData.id || formData.formNumber || formData.studentName || 'form').replace(/[^a-zA-Z0-9_-]/g, '_'),
        filename: finalFileName,
      });
      if (serverSuccess) {
        onProgress?.(100, lang === 'bn' ? 'পিডিএফ ডাউনলোড সম্পন্ন!' : 'Download complete!');
        return;
      }
    } catch (serverErr) {
      console.warn('Server PDF generation failed for admission form, using client fallback:', serverErr);
    }

    onProgress?.(80, lang === 'bn' ? 'ক্লায়েন্ট ইমেজ-টু-পিডিএফ কম্পাইল হচ্ছে...' : 'Compiling client image-to-PDF...');

    const pagesToCapture: HTMLElement[] = [];
    if (page1El) pagesToCapture.push(page1El);
    if (isTwoPage && page2El) pagesToCapture.push(page2El);
    if (pagesToCapture.length === 0 && printAreaElement) {
      pagesToCapture.push(printAreaElement);
    }

    const imgDataUrls: string[] = [];
    for (const pageEl of pagesToCapture) {
      const imgUrl = await elementToImageDataUrl(pageEl);
      imgDataUrls.push(imgUrl);
    }

    onProgress?.(95, lang === 'bn' ? 'ফাইল ডাউনলোড শুরু হচ্ছে...' : 'Initiating download...');
    await saveImagesAsA4Pdf(imgDataUrls, finalFileName);
    onProgress?.(100, lang === 'bn' ? 'পিডিএফ ডাউনলোড সম্পন্ন!' : 'Download complete!');
  } finally {
    try {
      root.unmount();
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    } catch (e) {}
  }
};
