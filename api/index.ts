import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/**
 * Serverlös ingångspunkt för Vercel.
 *
 * NestJS körs ovanpå en Express-instans. Appen initieras en gång och cachas
 * mellan anrop (varma lambdas), så vi slipper boota om Nest på varje request.
 */
let cachedServer: express.Express | null = null;

async function getServer(): Promise<express.Express> {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  configureApp(app);
  await app.init();

  cachedServer = expressApp;
  return cachedServer;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const server = await getServer();
  server(req, res);
}
