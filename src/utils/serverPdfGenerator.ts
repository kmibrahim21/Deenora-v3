import { jsPDF as RealJsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

export const jsPDF = RealJsPDF;

// Find the hidden container and move it into the viewport temporarily
const captureElement = async (element: HTMLElement, options: any, isJpeg: boolean) => {
    // Find if the element or any parent has -9999px
    let hiddenNode: HTMLElement | null = element;
    while (hiddenNode && hiddenNode !== document.body) {
        if (hiddenNode.style.left === '-9999px' || hiddenNode.style.top === '-9999px' || hiddenNode.style.position === 'absolute') {
            break;
        }
        hiddenNode = hiddenNode.parentElement;
    }
    
    // If we didn't find the exact hidden wrapper, we just operate on the element
    if (!hiddenNode || hiddenNode === document.body) {
        hiddenNode = element;
    }

    // Save original styles of the hidden node
    const origPosition = hiddenNode.style.position;
    const origLeft = hiddenNode.style.left;
    const origTop = hiddenNode.style.top;
    const origZIndex = hiddenNode.style.zIndex;
    const origOpacity = hiddenNode.style.opacity;

    // Temporarily move the hidden node into the viewport, but hide it behind everything else
    hiddenNode.style.position = 'fixed';
    hiddenNode.style.left = '0px';
    hiddenNode.style.top = '0px';
    hiddenNode.style.zIndex = '-9999'; // Hide behind other elements
    hiddenNode.style.opacity = '1';

    try {
        // Wait a tiny bit for the browser to apply styles and layout
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const canvas = await html2canvas(element, { 
            scale: options?.pixelRatio || 3, 
            backgroundColor: options?.backgroundColor || '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false,
            windowWidth: document.documentElement.clientWidth,
            windowHeight: document.documentElement.clientHeight
        });
        
        // Restore styles immediately
        hiddenNode.style.position = origPosition;
        hiddenNode.style.left = origLeft;
        hiddenNode.style.top = origTop;
        hiddenNode.style.zIndex = origZIndex;
        hiddenNode.style.opacity = origOpacity;
        
        return isJpeg ? canvas.toDataURL('image/jpeg', options?.quality || 1.0) : canvas.toDataURL('image/png');
    } catch (e) {
        console.error("html2canvas capture failed", e);
        // Restore styles on error
        hiddenNode.style.position = origPosition;
        hiddenNode.style.left = origLeft;
        hiddenNode.style.top = origTop;
        hiddenNode.style.zIndex = origZIndex;
        hiddenNode.style.opacity = origOpacity;
        throw e;
    }
};

export const toPng = async (element: HTMLElement, options?: any) => {
    return captureElement(element, options, false);
};

export const toJpeg = async (element: HTMLElement, options?: any) => {
    return captureElement(element, options, true);
};
