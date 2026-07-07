import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // Handle NestJS HttpException (e.g., auth errors, built-in errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = exception.getResponse();
      return res.status(status).json(message);
    }

    // Handle Axios errors from AI service calls
    if (axios.isAxiosError(exception)) {
      if (exception.response) {
        // AI service returned a response
        const status = exception.response.status;

        // Status 400 → pass through
        if (status === 400) {
          return res.status(400).json(exception.response.data);
        }

        // Status 422 → pass through with custom message
        if (status === 422) {
          return res.status(422).json({
            statusCode: 422,
            message: "couldn't understand your request",
          });
        }

        // Status 5xx → map to 503
        if (status >= 500) {
          return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'service temporarily unavailable, please retry',
          });
        }

        // Any other response status → pass through
        return res.status(status).json(exception.response.data);
      } else {
        // AxiosError without response (timeout, network error, etc.)
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'service temporarily unavailable, please retry',
        });
      }
    }

    // Handle any other exception → 500 Internal Server Error
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
