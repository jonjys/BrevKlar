import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Skyddar cron-endpointen. Vercel Cron skickar automatiskt
 * `Authorization: Bearer <CRON_SECRET>` när miljövariabeln CRON_SECRET är satt,
 * så bara schemaläggaren (eller någon med hemligheten) kan trigga svepet.
 *
 * Saknas hemligheten helt vägrar vi köra hellre än att lämna endpointen öppen.
 */
@Injectable()
export class CronGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException(
        'CRON_SECRET är inte konfigurerad – cron-endpointen är avstängd.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['authorization'];
    if (header !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Ogiltig eller saknad cron-hemlighet.');
    }
    return true;
  }
}
