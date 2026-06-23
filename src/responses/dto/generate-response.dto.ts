import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RESPONSE_TYPES, ResponseType } from '../../ai/response.contract';

export class GenerateResponseDto {
  @IsIn(RESPONSE_TYPES, {
    message: `type måste vara en av: ${RESPONSE_TYPES.join(', ')}`,
  })
  type!: ResponseType;

  /** Fri instruktion, t.ex. "jag vill ha 30 dagars anstånd". */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}
