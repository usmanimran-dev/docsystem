import { Injectable } from '@angular/core';
import Tesseract from 'tesseract.js';
import { logger } from '../logging/logger';

export interface OcrResult {
  text: string;
  confidence: number;
  words: Array<{ text: string; confidence: number }>;
}

@Injectable({
  providedIn: 'root'
})
export class OcrService {

  // Self-hosted under public/tesseract/, not the jsDelivr/tessdata CDN
  // defaults - a bank's network won't have internet access, so anything
  // fetched from a public CDN at runtime fails there exactly like it just
  // did in this sandbox (same root cause: no outbound access to a
  // third-party host). Same reasoning as sanctions.source=local in
  // examination-service.
  private static readonly WORKER_PATH = '/tesseract/worker.min.js';
  private static readonly CORE_PATH = '/tesseract/tesseract-core-simd-lstm.wasm.js';
  private static readonly LANG_PATH = '/tesseract/lang-data';

  async extractText(imageSource: string | File | HTMLCanvasElement): Promise<OcrResult> {
    const result = await Tesseract.recognize(imageSource, 'eng', {
      workerPath: OcrService.WORKER_PATH,
      corePath: OcrService.CORE_PATH,
      langPath: OcrService.LANG_PATH,
      // Fires on every progress tick, so this is silent outside dev mode.
      logger: (m) => logger.debug('OCR progress:', m)
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence / 100,
      words: []
    };
  }

  async extractTextFromRegion(
    canvas: HTMLCanvasElement,
    x: number, y: number, width: number, height: number
  ): Promise<OcrResult> {
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = width;
    regionCanvas.height = height;
    const ctx = regionCanvas.getContext('2d')!;
    ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    return this.extractText(regionCanvas);
  }
}
