import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { invalidRequest } from './common/validation-problems';
import { F1ApiErrorFilter } from './f1-api/f1-api-error.filter';

/** Request validation and error translation shared by main.ts and the HTTP tests. */
export function configureHttpPipeline(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: invalidRequest,
    }),
  );
  app.useGlobalFilters(new F1ApiErrorFilter());
}
