import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';

/** How much upstream response body a log line carries — enough to identify the
 *  failure (e.g. a foreign-key violation naming the missing user) without
 *  flooding the log stream. */
const UPSTREAM_BODY_LOG_LIMIT = 500;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();

    // Handle NestJS HttpException (e.g., auth errors, built-in errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = exception.getResponse();
      return res.status(status).json(message);
    }

    // Handle Axios errors from AI service calls. These used to be translated
    // without a trace — hundreds of upstream rejections (e.g. kebi refusing a
    // forwarded user id that doesn't exist) were invisible from the gateway.
    // The stable prefixes are the contract for log-based alerting.
    if (axios.isAxiosError(exception)) {
      if (exception.response) {
        // AI service returned a response
        const status = exception.response.status;
        this.logger.error(
          `[KEBI_REJECT] ${this.requestLine(req)} → upstream ${status}: ${this.upstreamBody(exception.response.data)}`,
        );

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
        this.logger.error(
          `[KEBI_DOWN] ${this.requestLine(req)} → no upstream response: ${exception.message}`,
        );
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'service temporarily unavailable, please retry',
        });
      }
    }

    // Handle any other exception → 500 Internal Server Error
    this.logger.error(
      `[UNHANDLED] ${this.requestLine(req)}: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }

  /** `METHOD /path (user <id>)` — who asked for what, for every error line. */
  private requestLine(req: Request): string {
    const who = req.user?.id ?? 'anonymous';
    return `${req.method} ${req.originalUrl ?? req.url} (user ${who})`;
  }

  /** Upstream body, stringified and bounded, so log lines stay one line. */
  private upstreamBody(data: unknown): string {
    let text: string;
    try {
      text = typeof data === 'string' ? data : JSON.stringify(data);
    } catch {
      text = String(data);
    }
    if (text === undefined || text === 'undefined') return '(empty body)';
    return text.length > UPSTREAM_BODY_LOG_LIMIT
      ? `${text.slice(0, UPSTREAM_BODY_LOG_LIMIT)}…`
      : text;
  }
}
