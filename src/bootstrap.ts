import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Delad app-konfiguration så att den lokala servern (main.ts) och den
 * serverlösa Vercel-handlern (api/index.ts) beter sig exakt likadant.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS för React Native / Expo-klienten.
  app.enableCors();
}
