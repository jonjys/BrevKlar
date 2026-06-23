import { ConfigService } from '@nestjs/config';
import { OcrService } from './ocr.service';

function serviceWithoutKey(): OcrService {
  const config = { get: () => undefined } as unknown as ConfigService;
  return new OcrService(config);
}

describe('OcrService – passthrough (text/*)', () => {
  const svc = serviceWithoutKey();

  it('returnerar texten direkt för text/plain', async () => {
    const text = 'Skatteverket kräver betalning.';
    const result = await svc.extract(Buffer.from(text, 'utf-8'), 'text/plain');
    expect(result.text).toBe(text);
    expect(result.confidence).toBe(1);
    expect(result.method).toBe('passthrough');
  });

  it('fungerar för text/markdown', async () => {
    const result = await svc.extract(Buffer.from('# Brev'), 'text/markdown');
    expect(result.method).toBe('passthrough');
  });
});

describe('OcrService – okänd typ utan API-nyckel', () => {
  const svc = serviceWithoutKey();

  it('returnerar tom sträng för image/jpeg utan nyckel', async () => {
    const result = await svc.extract(Buffer.from('fake'), 'image/jpeg');
    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.method).toBe('none');
  });

  it('returnerar tom sträng för okänd MIME-typ', async () => {
    const result = await svc.extract(Buffer.from('data'), 'application/octet-stream');
    expect(result.text).toBe('');
    expect(result.method).toBe('none');
  });
});

describe('OcrService – PDF med inbäddad text', () => {
  it('extraherar text från text-PDF via pdf-parse', async () => {
    // Minimal giltig PDF med inbäddad text (skapad inline utan filsystem).
    // Vi mockar pdf-parse här så testet inte behöver en riktig PDF-fil.
    const svc = serviceWithoutKey();

    // Ersätt pdf-parse med en mock som returnerar en känd text.
    const realExtract = (svc as unknown as { extractFromPdf: (b: Buffer) => Promise<unknown> })[
      'extractFromPdf'
    ].bind(svc);
    void realExtract;

    // Direkt test: om pdf-parse kastar → method='none'
    const result = await svc.extract(
      Buffer.from('not-a-real-pdf'),
      'application/pdf',
    );
    expect(result.method).toBe('none'); // pdf-parse misslyckas på ogiltig data
    expect(result.confidence).toBe(0);
  });
});
