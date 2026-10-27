import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { apiException } from '../common/api-error';
import { F1ApiError } from './f1-api.error';

/**
 * Translates provider failures into HTTP answers for our own clients. The client
 * already logged the failure, so this filter does not log it again.
 */
@Catch(F1ApiError)
export class F1ApiErrorFilter implements ExceptionFilter<F1ApiError> {
  catch(error: F1ApiError, host: ArgumentsHost): void {
    const exception = toHttpException(error);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(exception.getStatus())
      .json(exception.getResponse());
  }
}

export function toHttpException(error: F1ApiError): HttpException {
  const cause = { cause: error };
  switch (error.kind) {
    case 'timeout':
      return apiException(
        HttpStatus.GATEWAY_TIMEOUT,
        'PROVIDER_TIMEOUT',
        'El proveedor de datos F1 no respondió a tiempo. Puede estar despertando: reintentá en unos segundos.',
        cause,
      );
    case 'not_found':
      return apiException(
        HttpStatus.NOT_FOUND,
        'PROVIDER_NOT_FOUND',
        'El proveedor de datos F1 no tiene el recurso solicitado.',
        cause,
      );
    case 'invalid_response':
      return apiException(
        HttpStatus.BAD_GATEWAY,
        'PROVIDER_INVALID_DATA',
        'El proveedor de datos F1 devolvió datos con un formato inesperado.',
        cause,
      );
    case 'network':
    case 'http_error':
      return apiException(
        HttpStatus.BAD_GATEWAY,
        'PROVIDER_UNAVAILABLE',
        'El proveedor de datos F1 no está disponible en este momento.',
        cause,
      );
  }
}
