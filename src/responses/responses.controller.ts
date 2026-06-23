import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateResponseDto } from './dto/generate-response.dto';
import { ResponsesService } from './responses.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  /** Generera ett svarsutkast (formellt svar, överklagande, anstånd ...). */
  @Post('documents/:documentId/responses')
  generate(
    @CurrentUser() user: User,
    @Param('documentId') documentId: string,
    @Body() dto: GenerateResponseDto,
  ) {
    return this.responses.generate(user.id, documentId, dto.type, dto.instructions);
  }

  /** Lista alla svarsutkast för ett dokument. */
  @Get('documents/:documentId/responses')
  list(@CurrentUser() user: User, @Param('documentId') documentId: string) {
    return this.responses.list(user.id, documentId);
  }

  /** Hämta ett enskilt svarsutkast. */
  @Get('responses/:id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.responses.findOne(user.id, id);
  }
}
