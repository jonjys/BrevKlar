import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { Injectable } from '@nestjs/common';

/**
 * Lagringsabstraktion. Lokalt filsystem i utveckling; byts mot S3/Supabase
 * (krypterad lagring) i produktion utan att anropande kod ändras.
 */
@Injectable()
export class StorageService {
  private readonly baseDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

  async save(buffer: Buffer, originalName: string): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const key = `${randomUUID()}-${originalName.replace(/[^\w.-]/g, '_')}`;
    await fs.writeFile(join(this.baseDir, key), buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(join(this.baseDir, key));
  }
}
