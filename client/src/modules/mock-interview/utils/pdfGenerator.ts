import html2pdf from "html2pdf.js";
import logger from "../../../utils/logger";

/**
 * Generates a PDF report from an HTML element
 * @param elementId The ID of the HTML element to render
 * @param filename The name of the output PDF file
 */
export const generatePDFReport = async (elementId: string, filename: string): Promise<void> => {
  const element = document.getElementById(elementId);
  
  if (!element) {
    logger.error(`[pdfGenerator] Element with ID '${elementId}' not found in the DOM.`);
    throw new Error(`Element with ID '${elementId}' not found`);
  }

  const opt: any = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      logging: false,
      windowWidth: 800 // Matches the w-[800px] class on the target element
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(element).save();
    logger.info(`[pdfGenerator] Successfully generated ${filename}`);
  } catch (error) {
    logger.error("[pdfGenerator] Failed to generate PDF", error);
    throw error;
  }
};
