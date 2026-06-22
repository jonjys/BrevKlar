import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { RiskModule } from '../risk/risk.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { OcrService } from './ocr.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule, AiModule, RiskModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService, OcrService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
