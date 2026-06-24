import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SUPPORTED_OUTPUT_LANGUAGES, type OutputLanguage } from '../../ai/analysis.contract';
import { type ScanAction } from '../../ai/ai.service';

const LANGUAGE_CODES = Object.keys(SUPPORTED_OUTPUT_LANGUAGES) as OutputLanguage[];
const SCAN_ACTIONS: ScanAction[] = ['translate', 'explain', 'analyze', 'deal'];

export class DemoScanDto {
  /** Data URL för en bild (jpeg/png/gif/webp) eller en PDF. Antingen detta eller textContent krävs. */
  @IsOptional()
  @IsString()
  @MaxLength(5_000_000, { message: 'Filen är för stor (max ~3,7 MB).' })
  fileBase64?: string;

  /** Råtext inklistrad eller hämtad från ett dokument. Antingen detta eller fileBase64 krävs. */
  @IsOptional()
  @IsString()
  @MaxLength(12_000, { message: 'Texten är för lång (max 12 000 tecken).' })
  textContent?: string;

  @IsOptional()
  @IsIn(SCAN_ACTIONS, { message: 'action måste vara translate, explain, analyze eller deal.' })
  action?: ScanAction;

  @IsOptional()
  @IsIn(LANGUAGE_CODES, { message: 'Språket stöds inte.' })
  language?: OutputLanguage;
}
