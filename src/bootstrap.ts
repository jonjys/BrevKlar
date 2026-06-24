import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

/**
 * Delad app-konfiguration så att den lokala servern (main.ts) och den
 * serverlösa Vercel-handlern (api/index.ts) beter sig exakt likadant.
 */
export function configureApp(app: NestExpressApplication): void {
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
  app.useStaticAssets(join(process.cwd(), 'public'));
}
