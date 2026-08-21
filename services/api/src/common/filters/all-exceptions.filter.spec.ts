import 'reflect-metadata';
import { ArgumentsHost, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const req = {
    method: 'GET',
    originalUrl: '/api/v1/user/library',
    user: { id: 'user_1' },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function axiosErrorWithStatus(status: number, data: unknown): AxiosError {
  const error = new AxiosError('upstream failed');
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('passes HttpExceptions through quietly (no error log)', () => {
    const { host, res } = makeHost();

    filter.catch(new UnauthorizedException('nope'), host);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs upstream rejections with the [KEBI_REJECT] alert prefix, request line, and body', () => {
    // The alerting contract: Railway log alerts match on the stable prefix.
    // A rejected forwarded user id (e.g. an FK violation upstream) must be
    // one grep away, not silent.
    const { host, res } = makeHost();

    filter.catch(
      axiosErrorWithStatus(500, { detail: 'user user_bad not found' }),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[KEBI_REJECT] GET /api/v1/user/library (user user_1)'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('user user_bad not found'),
    );
  });

  it('logs unreachable upstream with the [KEBI_DOWN] prefix', () => {
    const { host, res } = makeHost();

    filter.catch(new AxiosError('timeout of 30000ms exceeded'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[KEBI_DOWN] GET /api/v1/user/library (user user_1)'),
    );
  });

  it('logs anything else with the [UNHANDLED] prefix and a stack', () => {
    const { host, res } = makeHost();

    filter.catch(new Error('boom'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[UNHANDLED] GET /api/v1/user/library (user user_1): boom'),
      expect.stringContaining('Error: boom'),
    );
  });
});
