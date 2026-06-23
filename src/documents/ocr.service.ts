import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pdfParse from 'pdf-parse';

export interface OcrResult {
  text: string;
  confidence: number;
  method: 'passthrough' | 'pdf-parse' | 'claude-vision' | 'none';
}

const VISION_SYSTEM_PROMPT = `Du är en OCR-motor specialiserad på svenska myndighetsbrev, skatteavier, försäkringsdokument och juridiska brev.
Extrahera ALL text från bilden exakt som den ser ut – behåll radbrytningar, sifferformat och specialtecken.
Svara ENBART med den extraherade texten, ingenting annat. Inga kommentarer, ingen förklaring.`;

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.model = config.get<string>('BREVKLAR_AI_MODEL') ?? 'claude-opus-4-8';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;

    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY saknas – Claude Vision-OCR ej tillgängligt.');
    }
  }

  async extract(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    if (mimeType.startsWith('text/')) {
      return { text: buffer.toString('utf-8'), confidence: 1, method: 'passthrough' };
    }

    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer);
    }

    if (mimeType.startsWith('image/')) {
      return this.extractFromImage(buffer, mimeType);
    }

    this.logger.warn(`Okänd MIME-typ ${mimeType} – ingen text extraherad.`);
    return { text: '', confidence: 0, method: 'none' };
  }

  private async extractFromPdf(buffer: Buffer): Promise<OcrResult> {
    try {
      const result = await pdfParse(buffer);
      const text = result.text.trim();

      if (text.length > 50) {
        this.logger.log(`PDF: ${result.numpages} sida(or), ${text.length} tecken extraherade.`);
        return { text, confidence: 0.95, method: 'pdf-parse' };
      }

      // Skannad PDF utan inbäddad text → försök Claude Vision på första sidan om möjligt.
      this.logger.warn('PDF saknar inbäddad text (skannat dokument). Returnerar tom sträng.');
      return { text: '', confidence: 0, method: 'none' };
    } catch (err) {
      this.logger.error('pdf-parse misslyckades', err as Error);
      return { text: '', confidence: 0, method: 'none' };
    }
  }

  private async extractFromImage(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    if (!this.client) {
      this.logger.warn(`Bild-OCR kräver ANTHROPIC_API_KEY (${mimeType}).`);
      return { text: '', confidence: 0, method: 'none' };
    }

    const supportedByApi: Anthropic.Base64ImageSource['media_type'][] = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    const mediaType = supportedByApi.includes(mimeType as Anthropic.Base64ImageSource['media_type'])
      ? (mimeType as Anthropic.Base64ImageSource['media_type'])
      : 'image/jpeg';

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: buffer.toString('base64'),
                },
              },
              { type: 'text', text: 'Extrahera all text från det här dokumentet.' },
            ],
          },
        ],
      });

      const block = response.content[0];
      if (block?.type !== 'text') {
        return { text: '', confidence: 0, method: 'none' };
      }

      const text = block.text.trim();
      this.logger.log(`Claude Vision OCR: ${text.length} tecken extraherade från ${mimeType}.`);
      return { text, confidence: 0.9, method: 'claude-vision' };
    } catch (err) {
      this.logger.error('Claude Vision OCR misslyckades', err as Error);
      return { text: '', confidence: 0, method: 'none' };
    }
  }
}
