export class OCRService {
    /**
     * Extracts text from an image file using Tesseract.js
     * @param {File|Blob|string} imageSource - The image to process
     * @returns {Promise<string>} - Extracted text
     */
    static async recognize(imageSource) {
        if (!window.Tesseract) {
            // Load Tesseract from CDN if not already present
            await this.loadLibrary();
        }

        const worker = await window.Tesseract.createWorker('eng');
        try {
            const { data: { text } } = await worker.recognize(imageSource);
            return text;
        } catch (error) {
            console.error("OCR recognition failed:", error);
            throw new Error("Failed to read text from image. Please ensure the image is clear.");
        } finally {
            await worker.terminate();
        }
    }

    static loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Tesseract.js library"));
            document.head.appendChild(script);
        });
    }
}
