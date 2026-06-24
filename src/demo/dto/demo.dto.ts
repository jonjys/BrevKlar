import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_OUTPUT_LANGUAGES, type OutputLanguage } from '../../ai/analysis.contract';

const LANGUAGE_CODES = Object.keys(SUPPORTED_OUTPUT_LANGUAGES) as OutputLanguage[];

export class DemoAnalyzeDto {
  @IsString()
  @MinLength(20, { message: 'Texten är för kort för att analysera (minst 20 tecken).' })
  @MaxLength(12000, { message: 'Texten är för lång (max 12000 tecken i demoläget).' })
  text!: string;

  @IsOptional()
  @IsIn(LANGUAGE_CODES, { message: 'Språket stöds inte.' })
  language?: OutputLanguage;
}
