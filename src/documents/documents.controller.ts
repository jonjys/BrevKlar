import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateTextDocumentDto } from './dto/create-document.dto';

interface UploadedMulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** Ladda upp en fil (PDF/bild/txt). Kör OCR -> AI-analys -> risk. */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentUser() user: User, @UploadedFile() file: UploadedMulterFile) {
    return this.documents.createFromUpload(user.id, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  /** Skicka in text direkt (test, e-post, redan tolkad Kivra-PDF). */
  @Post('text')
  createFromText(@CurrentUser() user: User, @Body() dto: CreateTextDocumentDto) {
    return this.documents.createFromText(user.id, dto.text, dto.filename, dto.source);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.documents.list(user.id);
  }

  /** AI Tidslinje: alla kommande deadlines, prioriterade. */
  @Get('timeline')
  timeline(@CurrentUser() user: User) {
    return this.documents.timeline(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.documents.findOne(user.id, id);
  }

  /** Kör om analysen för ett dokument. */
  @Post(':id/analyze')
  analyze(@CurrentUser() user: User, @Param('id') id: string) {
    return this.documents.analyze(user.id, id);
  }
}
