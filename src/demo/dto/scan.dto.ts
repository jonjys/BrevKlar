import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SUPPORTED_OUTPUT_LANGUAGES, type OutputLanguage } from '../../ai/analysis.contract';
import { type ScanAction } from '../../ai/ai.service';

const LANGUAGE_CODES = Object.keys(SUPPORTED_OUTPUT_LANGUAGES) as OutputLanguage[];
const SCAN_ACTIONS: ScanAction[] = ['translate', 'explain', 'analyze'];

export class DemoScanDto {
  @IsString()
  @MaxLength(2_000_000, { message: 'Bilden är för stor (max ~1,5 MB komprimerad).' })
  @Matches(/^data:image\/(jpeg|png|gif|webp);base64,/, {
    message: 'imageBase64 måste vara en data-URL (jpeg/png/gif/webp).',
  })
  imageBase64!: string;

  @IsOptional()
  @IsIn(SCAN_ACTIONS, { message: 'action måste vara translate, explain eller analyze.' })
  action?: ScanAction;

  @IsOptional()
  @IsIn(LANGUAGE_CODES, { message: 'Språket stöds inte.' })
  language?: OutputLanguage;
}
