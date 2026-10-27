import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadAppConfig, loadEnvFileIfPresent } from './config/app-config';
import { configureHttpPipeline } from './http-pipeline';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadAppConfig(process.env);

  const app = await NestFactory.create(AppModule.register(config));
  app.enableCors({ origin: config.corsOrigins });
  configureHttpPipeline(app);
  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`Backend listening on http://localhost:${config.port}`);
}

bootstrap().catch((error: unknown) => {
  logger.error(
    'Backend failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
