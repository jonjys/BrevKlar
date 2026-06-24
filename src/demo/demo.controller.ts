import { Body, Controller, Post } from '@nestjs/common';
import { DemoAnalyzeDto } from './dto/demo.dto';
import { DemoService } from './demo.service';

/**
 * Publik demo – ingen auth. Låter besökare prova Brevklar direkt på webben.
 * Inget persisteras. För skarp användning krävs BankID + /documents.
 */
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Post('analyze')
  analyze(@Body() dto: DemoAnalyzeDto) {
    return this.demo.analyze(dto.text, dto.language ?? 'sv');
  }
}
