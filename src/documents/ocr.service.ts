import { Injectable, Logger } from '@nestjs/common';

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * OCR-steget (steg 2 i analysmotorn).
 *
 * Placeholder-implementation: ren text (.txt / .md) läses direkt. Bilder och
 * PDF:er kräver en riktig OCR-motor (t.ex. AWS Textract eller Google Vision) –
 * den kopplas in här utan att resten av pipelinen påverkas.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extract(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    if (mimeType.startsWith('text/')) {
      return { text: buffer.toString('utf-8'), confidence: 1 };
    }

    this.logger.warn(
      `OCR för ${mimeType} är inte konfigurerad – ingen text extraherad. Koppla in en OCR-motor.`,
    );
    return {
      text: '',
      confidence: 0,
    };
  }
}
