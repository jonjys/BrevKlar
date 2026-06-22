import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewFeedbackDto, SubmitFeedbackDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@UseGuards(JwtAuthGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** "Håller du med om denna tolkning?" – Ja/Nej. Nej skickas till granskning. */
  @Post()
  submit(@CurrentUser() user: User, @Body() dto: SubmitFeedbackDto) {
    return this.feedback.submit(user.id, dto.analysisId, dto.agrees, dto.comment);
  }

  /** Granskningskö (endast REVIEWER/ADMIN). */
  @Get('review-queue')
  reviewQueue(@CurrentUser() user: User) {
    return this.feedback.reviewQueue(user.role);
  }

  /** Expert rättar en omtvistad analys -> blir Golden Dataset. */
  @Post(':id/review')
  review(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReviewFeedbackDto,
  ) {
    return this.feedback.review(user.id, user.role, id, dto.correctedOutput, dto.comment);
  }
}
