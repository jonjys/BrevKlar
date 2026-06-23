import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { FeedbackModule } from './feedback/feedback.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResponsesModule } from './responses/responses.module';
import { RiskModule } from './risk/risk.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    RiskModule,
    AuthModule,
    DocumentsModule,
    FeedbackModule,
    ResponsesModule,
    MonitoringModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
