import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ClerkMiddleware } from './clerk.middleware';
import * as clerkBackend from '@clerk/backend';

// Mock the @clerk/backend module
jest.mock('@clerk/backend');

describe('ClerkMiddleware', () => {
  let middleware: ClerkMiddleware;
  let mockVerifyToken: jest.Mock;

  beforeEach(async () => {
    // Setup mock
    mockVerifyToken = clerkBackend.verifyToken as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkMiddleware,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'CLERK_SECRET_KEY': 'sk_test_mock_secret',
                'ai.enabled_default': true,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    middleware = module.get<ClerkMiddleware>(ClerkMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('public routes', () => {
    it('should skip verification for routes marked with @Public() decorator', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const handler = () => {};
      Reflect.defineMetadata('isPublic', true, handler);

      const req = {
        originalUrl: '/health',
        headers: {},
        route: {
          stack: [
            {
              handle: handler,
            },
          ],
        },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });
  });

  describe('authorization header validation', () => {
    it('should throw UnauthorizedException when Authorization header is missing', async () => {
      const req = {
        headers: {},
        method: 'GET',
        path: '/test',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await expect(middleware.use(req, res, next)).rejects.toThrow(UnauthorizedException);
      await expect(middleware.use(req, res, next)).rejects.toThrow('Missing or invalid Authorization header');
    });

    it('should throw UnauthorizedException when Authorization header does not start with Bearer', async () => {
      const req = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
        method: 'GET',
        path: '/test',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await expect(middleware.use(req, res, next)).rejects.toThrow(UnauthorizedException);
      await expect(middleware.use(req, res, next)).rejects.toThrow('Missing or invalid Authorization header');
    });
  });

  describe('token verification', () => {
    it('should extract token and verify it with Clerk SDK', async () => {
      const mockToken = 'eyJhbGc...valid.token';
      mockVerifyToken.mockResolvedValue({
        sub: 'user_123',
        public_metadata: { ai_enabled: true },
      });

      const req = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(mockVerifyToken).toHaveBeenCalledWith(mockToken, {
        secretKey: 'sk_test_mock_secret',
      });
      expect(next).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token verification fails', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      const req = {
        headers: {
          authorization: 'Bearer invalid.token',
        },
        method: 'GET',
        path: '/test',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await expect(middleware.use(req, res, next)).rejects.toThrow(UnauthorizedException);
      await expect(middleware.use(req, res, next)).rejects.toThrow('Invalid or expired token');
    });

    it('should throw UnauthorizedException when token does not contain user ID', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: null,
        public_metadata: {},
      });

      const req = {
        headers: {
          authorization: 'Bearer some.token',
        },
        method: 'GET',
        path: '/test',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      try {
        await middleware.use(req, res, next);
        fail('Should have thrown UnauthorizedException');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        // The error is caught and rethrown with 'Invalid or expired token' message
        expect((error as any).message).toContain('Invalid or expired token');
      }
    });
  });

  describe('user attachment', () => {
    it('should attach verified user info to request', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'user_123',
        public_metadata: { ai_enabled: false },
      });

      const req = {
        headers: {
          authorization: 'Bearer valid.token',
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('user_123');
      expect(req.user?.ai_enabled).toBe(false);
    });

    it('should use default ai_enabled from config when public_metadata is missing', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'user_456',
        public_metadata: {},
      });

      const req = {
        headers: {
          authorization: 'Bearer valid.token',
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(req.user?.ai_enabled).toBe(true); // default from config
    });

    it('should use default ai_enabled from config when public_metadata.ai_enabled is null', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'user_789',
        public_metadata: { ai_enabled: null },
      });

      const req = {
        headers: {
          authorization: 'Bearer valid.token',
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(req.user?.ai_enabled).toBe(true); // default from config
    });
  });

  describe('error handling', () => {
    it('should throw error if CLERK_SECRET_KEY is not configured', async () => {
      // Mock ConfigService to return undefined for secret key
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'CLERK_SECRET_KEY') return undefined;
          return defaultValue;
        }),
      };
      const middlewareWithBadConfig = new ClerkMiddleware(mockConfigService as any);

      const req = {
        headers: {
          authorization: 'Bearer some.token',
        },
        method: 'GET',
        path: '/test',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        route: { stack: [{ handle: () => {} }] },
      } as any;
      const res = {} as any;
      const next = jest.fn();

      await expect(middlewareWithBadConfig.use(req, res, next)).rejects.toThrow(UnauthorizedException);
    });
  });
});
