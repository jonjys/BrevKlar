import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { SUPPORTED_OUTPUT_LANGUAGES, type OutputLanguage } from '../../ai/analysis.contract';
import { type ScanAction } from '../../ai/ai.service';

const LANGUAGE_CODES = Object.keys(SUPPORTED_OUTPUT_LANGUAGES) as OutputLanguage[];
const SCAN_ACTIONS: ScanAction[] = ['translate', 'explain', 'analyze', 'deal'];

export class DemoFetchUrlDto {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, {
    message: 'Ange en giltig URL som börjar med http:// eller https://',
  })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsIn(LANGUAGE_CODES, { message: 'Språket stöds inte.' })
  language?: OutputLanguage;

  @IsOptional()
  @IsString()
  @IsIn(SCAN_ACTIONS, { message: 'action måste vara translate, explain, analyze eller deal.' })
  action?: ScanAction;
}
