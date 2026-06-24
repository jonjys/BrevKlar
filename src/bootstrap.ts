import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

/**
 * Delad app-konfiguration så att den lokala servern (main.ts) och den
 * serverlösa Vercel-handlern (api/index.ts) beter sig exakt likadant.
 */
export function configureApp(app: NestExpressApplication): void {
  // Must come before app.init() so our limit wins over NestJS's 100 KB default.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS för React Native / Expo-klienten.
  app.enableCors();

  // Webbfrontend: serverar public/ (landningssida, demo, i18n). Statiska filer
  // levereras direkt; allt annat faller igenom till API-controllers.
  // Serve scan.html at /scan (not just /scan.html).
  app.useStaticAssets(join(process.cwd(), 'public'), { extensions: ['html'] });
}
