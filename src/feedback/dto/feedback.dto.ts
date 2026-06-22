import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitFeedbackDto {
  @IsString()
  analysisId!: string;

  /** Svar på "Håller du med om denna tolkning?" */
  @IsBoolean()
  agrees!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ReviewFeedbackDto {
  /** Expertens korrigerade analys (anonymiserad träningsdata). */
  @IsObject()
  correctedOutput!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  comment?: string;
}
