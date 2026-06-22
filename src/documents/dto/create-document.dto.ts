import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * För test och för källor som redan ger text (t.ex. vidarebefordrad e-post
 * eller Kivra-PDF som redan tolkats): skicka in texten direkt, hoppa över OCR.
 */
export class CreateTextDocumentDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  source?: string; // upload | kivra | email | photo
}
