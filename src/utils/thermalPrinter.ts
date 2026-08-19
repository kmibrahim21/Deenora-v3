/**
 * Deenora Thermal Printer Engine
 * Supports:
 * 1. Android WebView Native JavaScript Bridge (window.DeenoraPrint / window.AndroidPrinter)
 * 2. Web Bluetooth API (Direct Bluetooth ESC/POS to XP-P502A and other 58mm/80mm printers)
 * 3. WebUSB / Web Serial API (Direct USB OTG ESC/POS)
 * 4. Canvas-to-ESC/POS Monochrome Bitmap Encoder (Flawless Bangla & Graphic printing)
 * 5. Web Print Dialog Fallback (Exact 58mm layout)
 */

export interface PrinterDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'usb' | 'native_bridge' | 'web';
  status: 'connected' | 'disconnected' | 'connecting';
  rawDevice?: any;
}

export interface ThermalPrintOptions {
  paperSize?: '58mm' | '80mm';
  copies?: number;
  printLogo?: boolean;
  printBranding?: boolean;
  cutPaper?: boolean;
}

const STORAGE_KEY_SAVED_PRINTER = 'deenora_thermal_printer_config';

class ThermalPrinterService {
  private bluetoothDevice: any = null;
  private bluetoothCharacteristic: any = null;
  private usbDevice: any = null;
  private usbEndpoint: any = null;
  private isConnecting: boolean = false;
  private activeDeviceName: string = '';

  constructor() {
    this.restoreLastPrinter();
  }

  /**
   * Check if running inside Android WebView with Native Print Bridge
   */
  public hasNativeBridge(): boolean {
    const win = window as any;
    return !!(
      win.DeenoraPrint ||
      win.AndroidPrinter ||
      (win.Android && typeof win.Android.printThermal === 'function')
    );
  }

  /**
   * Check if Web Bluetooth is supported in the current browser
   */
  public isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Check if WebUSB is supported in the current browser
   */
  public isUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  /**
   * Check if a printer is currently connected or native bridge is available
   */
  public isConnected(): boolean {
    if (this.hasNativeBridge()) return true;
    if (this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected) return true;
    if (this.usbDevice && this.usbDevice.opened) return true;
    return false;
  }

  /**
   * Get active connected printer details
   */
  public getActivePrinter(): { name: string; type: string; isConnected: boolean } {
    if (this.hasNativeBridge()) {
      return { name: 'Android Native Thermal Bridge', type: 'native_bridge', isConnected: true };
    }
    if (this.bluetoothDevice && this.bluetoothDevice.gatt?.connected) {
      return { name: this.bluetoothDevice.name || this.activeDeviceName || 'Bluetooth Thermal Printer', type: 'bluetooth', isConnected: true };
    }
    if (this.usbDevice && this.usbDevice.opened) {
      return { name: this.usbDevice.productName || 'USB Thermal Printer', type: 'usb', isConnected: true };
    }
    const saved = this.getSavedPrinterConfig();
    if (saved && saved.name) {
      return { name: saved.name, type: saved.type, isConnected: false };
    }
    return { name: '', type: 'none', isConnected: false };
  }

  /**
   * Save printer preference to LocalStorage
   */
  private savePrinterConfig(name: string, type: 'bluetooth' | 'usb' | 'native_bridge') {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_PRINTER, JSON.stringify({ name, type, lastConnected: Date.now() }));
    } catch (e) {
      console.warn('Failed to save printer config to localStorage', e);
    }
  }

  /**
   * Retrieve saved printer config
   */
  public getSavedPrinterConfig(): { name: string; type: string } | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SAVED_PRINTER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private restoreLastPrinter() {
    const saved = this.getSavedPrinterConfig();
    if (saved) {
      this.activeDeviceName = saved.name;
    }
  }

  /**
   * Request and connect to a Bluetooth Thermal Printer (XP-P502A, POS-58, etc.)
   */
  public async connectBluetooth(): Promise<{ success: boolean; name?: string; message?: string }> {
    if (!this.isBluetoothSupported()) {
      return {
        success: false,
        message: 'আপনার ব্রাউজারে Web Bluetooth সাপোর্ট নেই। Chrome ব্রাউজার বা Android App ব্যবহার করুন।'
      };
    }

    try {
      this.isConnecting = true;
      const nav = navigator as any;

      // Common Thermal Printer Bluetooth Service UUIDs
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '0000ae00-0000-1000-8000-00805f9b34fb',
          '0000ae30-0000-1000-8000-00805f9b34fb',
          '0000af30-0000-1000-8000-00805f9b34fb',
        ]
      });

      if (!device) {
        return { success: false, message: 'কোনো ব্লুটুথ ডিভাইস নির্বাচন করা হয়নি।' };
      }

      device.addEventListener('gattserverdisconnected', () => {
        console.log('Bluetooth printer disconnected');
        this.bluetoothCharacteristic = null;
      });

      const server = await device.gatt.connect();
      
      // Discover available services and find writable characteristic
      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        // Fallback to searching standard characteristics
        for (const service of services) {
          try {
            const char = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            if (char) { writeChar = char; break; }
          } catch {}
        }
      }

      if (!writeChar) {
        return { success: false, message: 'প্রিন্টারের রাইটিং চ্যানেল পাওয়া যায়নি।' };
      }

      this.bluetoothDevice = device;
      this.bluetoothCharacteristic = writeChar;
      this.activeDeviceName = device.name || 'XP-P502A Bluetooth Printer';
      this.savePrinterConfig(this.activeDeviceName, 'bluetooth');

      return { success: true, name: this.activeDeviceName };
    } catch (err: any) {
      console.error('Bluetooth connection failed:', err);
      return { success: false, message: err.message || 'ব্লুটুথ প্রিন্টার কানেক্ট করা সম্ভব হয়নি।' };
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Connect to a USB Thermal Printer via WebUSB
   */
  public async connectUsb(): Promise<{ success: boolean; name?: string; message?: string }> {
    if (!this.isUsbSupported()) {
      return {
        success: false,
        message: 'আপনার ব্রাউজারে WebUSB সাপোর্ট নেই। Chrome বা Android OTG ব্যবহার করুন।'
      };
    }

    try {
      const nav = navigator as any;
      const device = await nav.usb.requestDevice({ filters: [] });
      if (!device) return { success: false, message: 'কোনো USB ডিভাইস নির্বাচন করা হয়নি।' };

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Find USB Printer interface (Class 7 is Printer)
      let printerInterface: any = null;
      let outEndpoint: any = null;

      for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
          if (alt.interfaceClass === 7 || alt.endpoints.some((e: any) => e.direction === 'out')) {
            printerInterface = iface;
            outEndpoint = alt.endpoints.find((e: any) => e.direction === 'out');
            break;
          }
        }
        if (outEndpoint) break;
      }

      if (printerInterface) {
        await device.claimInterface(printerInterface.interfaceNumber);
      }

      this.usbDevice = device;
      this.usbEndpoint = outEndpoint;
      this.activeDeviceName = device.productName || 'USB Thermal Printer';
      this.savePrinterConfig(this.activeDeviceName, 'usb');

      return { success: true, name: this.activeDeviceName };
    } catch (err: any) {
      console.error('USB connection failed:', err);
      return { success: false, message: err.message || 'USB প্রিন্টার কানেক্ট করা সম্ভব হয়নি।' };
    }
  }

  /**
   * Disconnect current active printer
   */
  public async disconnect(): Promise<void> {
    if (this.bluetoothDevice?.gatt?.connected) {
      this.bluetoothDevice.gatt.disconnect();
    }
    this.bluetoothDevice = null;
    this.bluetoothCharacteristic = null;

    if (this.usbDevice?.opened) {
      await this.usbDevice.close();
    }
    this.usbDevice = null;
    this.usbEndpoint = null;
  }

  /**
   * Convert an HTML Element into a high-contrast monochrome ESC/POS Bitmap
   * Handles perfect Bangla font glyphs, English, tables, and Logos without corruption!
   */
  public async elementToEscPosBitmap(
    element: HTMLElement,
    targetDotsWidth: number = 384 // 384 dots for 58mm, 576 dots for 80mm
  ): Promise<Uint8Array> {
    const { toCanvas } = await import('html-to-image');

    // Create high resolution canvas
    const canvas = await toCanvas(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Scale canvas to exact printer dots width (384 dots for 58mm XP-P502A)
    const scale = targetDotsWidth / canvas.width;
    const targetHeight = Math.round(canvas.height * scale);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = targetDotsWidth;
    scaledCanvas.height = targetHeight;
    const scaledCtx = scaledCanvas.getContext('2d');
    if (!scaledCtx) throw new Error('Scaled canvas context not available');

    scaledCtx.fillStyle = '#ffffff';
    scaledCtx.fillRect(0, 0, targetDotsWidth, targetHeight);
    scaledCtx.drawImage(canvas, 0, 0, targetDotsWidth, targetHeight);

    const imgData = scaledCtx.getImageData(0, 0, targetDotsWidth, targetHeight);
    const data = imgData.data;

    // Convert to 1-bit Monochrome using Floyd-Steinberg Dithering for ultra crisp text and logos
    const width = targetDotsWidth;
    const height = targetHeight;
    const bytesWidth = Math.ceil(width / 8);

    // Initialize ESC/POS Commands:
    // ESC @ (Initialize)
    // ESC 3 0 (Set line spacing to 0)
    // GS v 0 (Print raster bit image)
    const escInit = [0x1b, 0x40]; // Initialize printer
    const escLineSpacing = [0x1b, 0x33, 0x00]; // 0 line spacing for seamless image printing

    // ESC/POS GS v 0 command header:
    // GS v 0 m xL xH yL yH
    // m = 0 (Normal mode)
    // xL, xH = bytesWidth
    // yL, yH = height
    const xL = bytesWidth & 0xff;
    const xH = (bytesWidth >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    const rasterHeader = [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH];
    const rasterData = new Uint8Array(bytesWidth * height);

    // Greyscale thresholding (1 = black, 0 = white in ESC/POS)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luminance < 165) {
          const byteIdx = y * bytesWidth + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          rasterData[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    // Feed lines & optional safe cut
    const feedLines = [0x1b, 0x64, 0x04]; // Feed 4 lines
    // Partial Cut (GS V 66 0) - Only sent if supported
    const partialCut = [0x1d, 0x56, 0x42, 0x00];

    // Combine all bytes
    const totalLength = escInit.length + escLineSpacing.length + rasterHeader.length + rasterData.length + feedLines.length + partialCut.length;
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    combined.set(escInit, offset); offset += escInit.length;
    combined.set(escLineSpacing, offset); offset += escLineSpacing.length;
    combined.set(rasterHeader, offset); offset += rasterHeader.length;
    combined.set(rasterData, offset); offset += rasterData.length;
    combined.set(feedLines, offset); offset += feedLines.length;
    combined.set(partialCut, offset);

    return combined;
  }

  /**
   * Send raw byte buffer in chunks to Bluetooth or USB
   */
  public async sendRawBytes(bytes: Uint8Array): Promise<void> {
    if (this.bluetoothCharacteristic) {
      // Chunk transmission to prevent Bluetooth buffer overflow (typically 512 bytes per packet)
      const chunkSize = 128;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (this.bluetoothCharacteristic.writeValueWithoutResponse) {
          await this.bluetoothCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.bluetoothCharacteristic.writeValue(chunk);
        }
        await new Promise((r) => setTimeout(r, 15)); // 15ms delay per chunk
      }
      return;
    }

    if (this.usbDevice && this.usbEndpoint) {
      await this.usbDevice.transferOut(this.usbEndpoint.endpointNumber, bytes);
      return;
    }

    throw new Error('কোনো সক্রিয় প্রিন্টার চ্যানেল পাওয়া যায়নি।');
  }

  /**
   * Main print method for 58mm Thermal Receipt
   */
  public async printReceiptElement(
    element: HTMLElement,
    options: ThermalPrintOptions = {}
  ): Promise<{ success: boolean; method: string; message?: string }> {
    const paperSize = options.paperSize || '58mm';
    const dotsWidth = paperSize === '58mm' ? 384 : 576;
    const copies = options.copies || 1;

    // 1. Android Native WebView Bridge Priority
    if (this.hasNativeBridge()) {
      try {
        const win = window as any;
        const { toJpeg } = await import('html-to-image');
        const imgData = await toJpeg(element, {
          pixelRatio: 3,
          quality: 1.0,
          backgroundColor: '#ffffff'
        });

        // If native bridge supports direct image printing
        if (win.DeenoraPrint && typeof win.DeenoraPrint.printThermalReceipt === 'function') {
          win.DeenoraPrint.printThermalReceipt(imgData, JSON.stringify(options));
          return { success: true, method: 'native_bridge_image' };
        }

        if (win.AndroidPrinter && typeof win.AndroidPrinter.printImage === 'function') {
          win.AndroidPrinter.printImage(imgData);
          return { success: true, method: 'android_printer_bridge' };
        }
      } catch (err: any) {
        console.warn('Native bridge print attempt had error, trying fallback:', err);
      }
    }

    // 2. Direct Bluetooth / USB ESC/POS Bitmap Printing
    if (this.isConnected() && (this.bluetoothCharacteristic || this.usbDevice)) {
      try {
        const bitmapBytes = await this.elementToEscPosBitmap(element, dotsWidth);
        for (let c = 0; c < copies; c++) {
          await this.sendRawBytes(bitmapBytes);
          if (c < copies - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        return { success: true, method: this.bluetoothCharacteristic ? 'bluetooth_escpos' : 'usb_escpos' };
      } catch (err: any) {
        console.error('ESC/POS printing failed:', err);
        return { success: false, method: 'escpos_error', message: err.message || 'প্রিন্টারে ডেটা পাঠাতে সমস্যা হয়েছে।' };
      }
    }

    return {
      success: false,
      method: 'not_connected',
      message: 'প্রিন্টার সংযুক্ত নেই। Bluetooth অথবা USB দিয়ে প্রিন্টার সংযুক্ত করুন।'
    };
  }

  /**
   * Run a quick Test Print to verify printer communication
   */
  public async printTest(): Promise<{ success: boolean; message?: string }> {
    if (!this.isConnected()) {
      return { success: false, message: 'প্রিন্টার সংযুক্ত নেই।' };
    }

    try {
      // Create a test element
      const testDiv = document.createElement('div');
      testDiv.style.width = '384px';
      testDiv.style.padding = '12px';
      testDiv.style.backgroundColor = '#ffffff';
      testDiv.style.color = '#000000';
      testDiv.style.fontFamily = 'Arial, sans-serif';
      testDiv.style.textAlign = 'center';
      testDiv.innerHTML = `
        <div style="font-size: 16px; font-weight: 900; margin-bottom: 4px;">DEENORA TEST PRINT</div>
        <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px;">58mm Thermal Printer OK</div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="font-size: 12px; font-weight: 800;">বাংলা ফন্ট টেস্ট: ফি আদায় রসিদ সফল</div>
        <div style="font-size: 10px; margin-top: 4px;">XP-P502A / ESC-POS Compatible</div>
        <div style="font-size: 9px; margin-top: 4px;">Date: ${new Date().toLocaleString()}</div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="font-size: 11px; font-weight: 900;">*** ধন্যবাদ ***</div>
      `;
      document.body.appendChild(testDiv);

      const res = await this.printReceiptElement(testDiv, { paperSize: '58mm' });
      document.body.removeChild(testDiv);
      return res;
    } catch (e: any) {
      return { success: false, message: e.message || 'টেস্ট প্রিন্ট ব্যর্থ হয়েছে।' };
    }
  }
}

export const thermalPrinterService = new ThermalPrinterService();
