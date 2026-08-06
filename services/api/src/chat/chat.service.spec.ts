import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import type { Response } from 'express';
import type { AuthUser } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ChatService } from './chat.service';
import type { ChatRequestBodyDto } from './dto/chat-request.dto';

const USER: AuthUser = {
  id: 'user_test_123',
  ai_enabled: true,
  plan: 'explorer',
  movement_profile: { available_modes: ['walking'], reach: 'normal' },
};

/** A pipe-able upstream stub — `pipe` is a no-op, we only assert on the body. */
function upstreamStub(): EventEmitter & { pipe: jest.Mock } {
  const stream = new EventEmitter() as EventEmitter & { pipe: jest.Mock };
  stream.pipe = jest.fn();
  return stream;
}

function responseStub(): Response {
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    status: jest.fn().mockReturnThis(),
    headersSent: false,
  } as unknown as Response;
}

describe('ChatService', () => {
  let service: ChatService;
  let kebi: jest.Mocked<KebiHttpClient>;
  let req: IncomingMessage;
  let res: Response;

  beforeEach(() => {
    kebi = {
      postStream: jest.fn().mockResolvedValue(upstreamStub()),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new ChatService(kebi, new RateLimitService());
    req = new EventEmitter() as unknown as IncomingMessage;
    res = responseStub();
  });

  function sentBody(): Record<string, unknown> {
    return (kebi.postStream as jest.Mock).mock.calls[0][2];
  }

  it('forwards the client-supplied local_time (kebi ADR-138)', async () => {
    const dto: ChatRequestBodyDto = {
      message: 'somewhere for cheap dinner near me',
      location: { lat: 13.7563, lng: 100.5018 },
      local_time: '2026-08-10T19:30:00+08:00',
    };

    await service.pipeStream(USER, dto, req, res);

    expect(sentBody()).toEqual({
      message: dto.message,
      location: dto.location,
      local_time: '2026-08-10T19:30:00+08:00',
      movement_profile: USER.movement_profile,
    });
  });

  it('sends local_time as null when the client omits it', async () => {
    await service.pipeStream(USER, { message: 'anything' }, req, res);

    expect(sentBody()).toMatchObject({ location: null, local_time: null });
  });
});
