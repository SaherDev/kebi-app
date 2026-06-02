import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'svix';
import { ClerkWebhookController } from './clerk.webhook';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { UserIdentityService } from '../auth/user-identity.service';

// Mock svix Webhook class
jest.mock('svix', () => {
  return {
    Webhook: jest.fn().mockImplementation(() => ({
      verify: jest.fn(),
    })),
  };
});

const mockUpdateUser = jest.fn().mockResolvedValue({});
const mockGetUser = jest.fn().mockResolvedValue({ publicMetadata: { plan: 'homebody', ai_enabled: true } });
jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    users: { getUser: mockGetUser, updateUser: mockUpdateUser },
  })),
}));

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'CLERK_WEBHOOK_SECRET') return 'whsec_test_secret';
    return undefined;
  }),
};

const mockResolve = jest.fn().mockResolvedValue('user_internal_abc');

describe('ClerkWebhookController', () => {
  let controller: ClerkWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClerkWebhookController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RateLimitService, useValue: { resetTurns: jest.fn() } },
        { provide: UserIdentityService, useValue: { resolve: mockResolve } },
      ],
    }).compile();

    controller = module.get<ClerkWebhookController>(ClerkWebhookController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleClerkWebhook', () => {
    it('should verify webhook signature and handle user.created event', async () => {
      const mockUserId = 'user_123';
      const mockPayload = {
        type: 'user.created',
        data: { id: mockUserId, email: 'test@example.com' },
      };

      const mockReq = {
        rawBody: JSON.stringify(mockPayload),
        body: mockPayload,
        headers: {
          'svix-id': 'msg_test',
          'svix-timestamp': '1234567890',
          'svix-signature': 'v1,test_signature',
        },
      } as unknown as Request;

      const mockVerify = jest.fn().mockReturnValue(mockPayload);
      (Webhook as jest.Mock).mockImplementation(() => ({ verify: mockVerify }));

      const result = await controller.handleClerkWebhook(
        mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
      );

      expect(result).toEqual({ success: true });
      expect(mockVerify).toHaveBeenCalledWith(JSON.stringify(mockPayload), mockReq.headers);
    });

    it('should resolve and stamp internal_id into publicMetadata on user.created', async () => {
      const mockPayload = { type: 'user.created', data: { id: 'user_123' } };
      const mockReq = {
        rawBody: JSON.stringify(mockPayload),
        body: mockPayload,
        headers: { 'svix-id': 'msg_test' },
      } as unknown as Request;
      (Webhook as jest.Mock).mockImplementation(() => ({
        verify: jest.fn().mockReturnValue(mockPayload),
      }));

      await controller.handleClerkWebhook(
        mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
      );

      expect(mockResolve).toHaveBeenCalledWith('clerk', {
        externalId: 'user_123',
        email: undefined,
        claims: {},
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          publicMetadata: expect.objectContaining({ internal_id: 'user_internal_abc' }),
        }),
      );
    });

    it('should verify webhook signature and pass through other event types', async () => {
      const mockPayload = { type: 'user.updated', data: { id: 'user_123' } };

      const mockReq = {
        rawBody: JSON.stringify(mockPayload),
        body: mockPayload,
        headers: {
          'svix-id': 'msg_test',
          'svix-timestamp': '1234567890',
          'svix-signature': 'v1,test_signature',
        },
      } as unknown as Request;

      const mockVerify = jest.fn().mockReturnValue(mockPayload);
      (Webhook as jest.Mock).mockImplementation(() => ({ verify: mockVerify }));

      const result = await controller.handleClerkWebhook(
        mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
      );

      expect(result).toEqual({ success: true });
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const mockReq = {
        rawBody: 'invalid_body',
        body: {},
        headers: {
          'svix-id': 'msg_test',
          'svix-timestamp': '1234567890',
          'svix-signature': 'v1,invalid_signature',
        },
      } as unknown as Request;

      const mockVerify = jest.fn().mockImplementation(() => {
        throw new Error('Signature verification failed');
      });
      (Webhook as jest.Mock).mockImplementation(() => ({ verify: mockVerify }));

      await expect(
        controller.handleClerkWebhook(
          mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when webhook_secret is not configured', async () => {
      mockConfigService.get.mockReturnValueOnce(undefined);

      const mockReq = { rawBody: '{}', body: {}, headers: {} } as unknown as Request;

      await expect(
        controller.handleClerkWebhook(
          mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fall back to JSON stringified body if rawBody is not available', async () => {
      const mockPayload = { type: 'user.created', data: { id: 'user_123' } };

      const mockReq = {
        body: mockPayload,
        headers: {
          'svix-id': 'msg_test',
          'svix-timestamp': '1234567890',
          'svix-signature': 'v1,test_signature',
        },
      } as unknown as Request;

      const mockVerify = jest.fn().mockReturnValue(mockPayload);
      (Webhook as jest.Mock).mockImplementation(() => ({ verify: mockVerify }));

      const result = await controller.handleClerkWebhook(
        mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
      );

      expect(result).toEqual({ success: true });
      expect(mockVerify).toHaveBeenCalledWith(JSON.stringify(mockPayload), mockReq.headers);
    });

    it('should handle Webhook.verify throwing non-Error objects', async () => {
      const mockReq = { rawBody: '{}', body: {}, headers: {} } as unknown as Request;

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const mockVerify = jest.fn().mockImplementation(() => { throw 'String error message'; });
      (Webhook as jest.Mock).mockImplementation(() => ({ verify: mockVerify }));

      await expect(
        controller.handleClerkWebhook(
          mockReq as Parameters<typeof controller.handleClerkWebhook>[0],
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
