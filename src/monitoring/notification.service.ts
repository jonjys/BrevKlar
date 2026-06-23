import { Injectable, Logger } from '@nestjs/common';
import { ReminderUrgency } from './reminder.logic';

/** En färdigbyggd påminnelse som ska levereras till en användare. */
export interface ReminderNotification {
  userId: string;
  email: string | null;
  deadlineId: string;
  documentId: string;
  dueDate: Date;
  daysLeft: number;
  urgency: ReminderUrgency;
  message: string;
}

/**
 * Notifieringskanal. Just nu en strukturerad logg (ingen e-post-/push-infra än),
 * men gränssnittet är medvetet smalt: byt implementationen mot e-post (Postmark/
 * SES), push eller SMS utan att svep-logiken behöver röras.
 *
 * `send` returnerar true om leveransen lyckades – svepet markerar bara
 * `reminderSent` för de påminnelser som faktiskt gick iväg, så en strul-leverans
 * försöker igen vid nästa körning.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async send(notification: ReminderNotification): Promise<boolean> {
    this.logger.log(
      `Påminnelse [${notification.urgency}] → ${notification.email ?? 'användare ' + notification.userId}: ${notification.message}`,
    );
    return true;
  }
}
