import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ServiceUnavailableException, ExecutionContext } from '@nestjs/common';
import { AiEnabledGuard } from './ai-enabled.guard';

describe('AiEnabledGuard', () => {
  let guard: AiEnabledGuard;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiEnabledGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'user_settings.defaults.ai_enabled': true,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<AiEnabledGuard>(AiEnabledGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('global kill switch', () => {
    it('should throw ServiceUnavailableException when global_kill_switch is true', () => {
      (configService.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'AI_GLOBAL_KILL_SWITCH') return 'true';
        return defaultValue;
      });

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user_123',
              ai_enabled: true,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ServiceUnavailableException);
      expect(() => guard.canActivate(mockExecutionContext)).toThrow('AI service is temporarily unavailable');
    });

    it('should not check user.ai_enabled if global_kill_switch is true (short circuit)', () => {
      (configService.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'AI_GLOBAL_KILL_SWITCH') return 'true';
        return defaultValue;
      });

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user_123',
              ai_enabled: false, // This should not be checked
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ServiceUnavailableException);
    });
  });

  describe('user ai_enabled check', () => {
    it('should allow access when user.ai_enabled is true and kill switch is off', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user_123',
              ai_enabled: true,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user.ai_enabled is false', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user_456',
              ai_enabled: false,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        'AI features are not enabled for your account'
      );
    });
  });

  describe('user context validation', () => {
    it('should throw ForbiddenException when user context is missing', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockExecutionContext)).toThrow('User context not found');
    });

    it('should throw ForbiddenException when user object is null', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockExecutionContext)).toThrow('User context not found');
    });
  });

  describe('integration scenarios', () => {
    it('should return true for valid user with AI enabled and no kill switch', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user_xyz',
              ai_enabled: true,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should prioritize kill switch over user ai_enabled status', () => {
      (configService.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'AI_GLOBAL_KILL_SWITCH') return 'true';
        return defaultValue;
      });

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'user_priority_test',
              ai_enabled: true,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ServiceUnavailableException);
    });
  });
});
