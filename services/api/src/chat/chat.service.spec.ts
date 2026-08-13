import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import type { Response } from 'express';
import type { AuthUser, NormalizedIdentity } from '@kebi-app/shared';
import { KebiHttpClient } from '../kebi/kebi-http.client';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ChatService } from './chat.service';
import { ChatUserProfileFactory } from './chat-user-profile.factory';
import type { ChatRequestBodyDto } from './dto/chat-request.dto';

const USER: AuthUser = {
  id: 'user_test_123',
  ai_enabled: true,
  plan: 'explorer',
  movement_profile: { available_modes: ['walking'], reach: 'normal' },
  about_me: { call_me: 'Saher', home_country: 'AE', about: 'I do not drink.' },
};

/** The verified identity behind USER — `name` is the contract's `call_me`. */
const IDENTITY: NormalizedIdentity = {
  externalId: 'ext_1',
  claims: {},
  email: 'saher@kebi.app',
  name: 'Saher',
};

const USER_PROFILE = {
  call_me: 'Saher',
  home_country: 'AE',
  about: 'I do not drink.',
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
    socket: { setNoDelay: jest.fn() },
  } as unknown as Response;
}

/** The dto used wherever the test cares about delivery, not about the body. */
const ANY_DTO: ChatRequestBodyDto = {
  message: 'drinks tonight',
  location: null,
  local_time: null,
};

describe('ChatService', () => {
  let service: ChatService;
  let kebi: jest.Mocked<KebiHttpClient>;
  let req: IncomingMessage;
  let res: Response;

  beforeEach(() => {
    kebi = {
      postStream: jest.fn().mockResolvedValue(upstreamStub()),
    } as unknown as jest.Mocked<KebiHttpClient>;
    service = new ChatService(kebi, new RateLimitService(), new ChatUserProfileFactory());
    req = new EventEmitter() as unknown as IncomingMessage;
    res = responseStub();
  });

  function sentBody(): Record<string, unknown> {
    return (kebi.postStream as jest.Mock).mock.calls[0][2];
  }

  // Token-sized frames (`reasoning_delta`/`message_delta`) only feel live if
  // nothing between kebi and the device holds them back.
  it('opts out of proxy buffering and Nagle so frames ship as they arrive', async () => {
    await service.pipeStream(IDENTITY, USER, ANY_DTO, req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.socket?.setNoDelay).toHaveBeenCalledWith(true);
  });

  it('pipes the upstream body untouched — no frame parsing in the gateway', async () => {
    const upstream = upstreamStub();
    (kebi.postStream as jest.Mock).mockResolvedValue(upstream);

    await service.pipeStream(IDENTITY, USER, ANY_DTO, req, res);

    // Byte-transparent: new kebi frame types need no change here.
    expect(upstream.pipe).toHaveBeenCalledWith(res);
  });

  it('aborts the upstream stream when the client hangs up (stop mid-answer)', async () => {
    await service.pipeStream(IDENTITY, USER, ANY_DTO, req, res);
    const signal = (kebi.postStream as jest.Mock).mock.calls[0][3] as AbortSignal;
    expect(signal.aborted).toBe(false);

    // What "stop" looks like server-side: the app drops the request mid-stream.
    req.emit('close');

    expect(signal.aborted).toBe(true);
  });

  it('forwards the client-supplied local_time (kebi ADR-138)', async () => {
    const dto: ChatRequestBodyDto = {
      message: 'somewhere for cheap dinner near me',
      location: { lat: 13.7563, lng: 100.5018 },
      local_time: '2026-08-10T19:30:00+08:00',
    };

    await service.pipeStream(IDENTITY, USER, dto, req, res);

    expect(sentBody()).toEqual({
      message: dto.message,
      location: dto.location,
      local_time: '2026-08-10T19:30:00+08:00',
      movement_profile: USER.movement_profile,
      user_profile: USER_PROFILE,
    });
  });

  it('sends local_time as null when the client omits it', async () => {
    await service.pipeStream(IDENTITY, USER, { message: 'anything' }, req, res);

    expect(sentBody()).toMatchObject({ location: null, local_time: null });
  });

  it('sends user_profile as null when we know neither a name nor an about-me', async () => {
    await service.pipeStream(
      { externalId: 'ext_2', claims: {} },
      { id: USER.id, ai_enabled: true },
      { message: 'anything' },
      req,
      res,
    );

    expect(sentBody()).toMatchObject({ user_profile: null });
  });

  it('sends the name alone as call_me when there is no about-me', async () => {
    await service.pipeStream(
      IDENTITY,
      { id: USER.id, ai_enabled: true },
      { message: 'anything' },
      req,
      res,
    );

    expect(sentBody()).toMatchObject({
      user_profile: { call_me: 'Saher', home_country: null, about: null },
    });
  });
});
