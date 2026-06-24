import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RiskModule } from '../risk/risk.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AiModule, RiskModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
