import {
  Controller,
  Post,
  Req,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import type { Request } from "express";
import { Webhook } from "svix";
import { RateLimitService } from "../rate-limit/rate-limit.service";
import { UserIdentityService } from "../auth/user-identity.service";

// This webhook is intrinsically Clerk's, so the mapping it writes is always
// keyed under the 'clerk' provider regardless of the active auth.provider.
const CLERK_PROVIDER = "clerk";

interface ClerkWebhookEvent {
  type: string;
  data?: Record<string, unknown>;
}

@Controller("webhooks")
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private configService: ConfigService,
    private rateLimitService: RateLimitService,
    private userIdentity: UserIdentityService,
  ) {}

  @Post("clerk")
  // Public route (see auth.public_paths in config)
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ success: boolean }> {
    const event = this.verifySignature(req);

    if (event.type === "user.created") {
      const userId = event.data?.id as string | undefined;
      if (userId) await this.onUserCreated(userId);
    } else if (event.type === "session.created") {
      const userId = event.data?.user_id as string;
      if (userId) await this.backfillMissingMetadata(userId);
    } else if (event.type === "session.ended") {
      const userId = event.data?.user_id as string;
      if (userId) {
        this.rateLimitService.resetTurns(userId);
        this.logger.log(`Turns reset for user ${userId} on session.ended`);
      }
    } else {
      this.logger.debug(`Unhandled Clerk event: ${event.type}`);
    }

    return { success: true };
  }

  private verifySignature(req: RawBodyRequest<Request>): ClerkWebhookEvent {
    const webhookSecret = this.configService.get<string>(
      "CLERK_WEBHOOK_SECRET",
    );
    if (!webhookSecret) {
      this.logger.error("CLERK_WEBHOOK_SECRET not configured");
      throw new BadRequestException(
        "Webhook secret not configured. Set the CLERK_WEBHOOK_SECRET environment variable.",
      );
    }

    try {
      const rawBody = req.rawBody ?? JSON.stringify(req.body);
      const wh = new Webhook(webhookSecret);
      return wh.verify(
        rawBody,
        req.headers as Record<string, string>,
      ) as ClerkWebhookEvent;
    } catch (error) {
      this.logger.error(
        `Signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException("Webhook verification failed");
    }
  }

  private async onUserCreated(userId: string): Promise<void> {
    this.logger.log(`New user created: ${userId}`);
    await this.ensureUserMetadata(userId, true);
  }

  private async backfillMissingMetadata(userId: string): Promise<void> {
    await this.ensureUserMetadata(userId, false);
  }

  private async ensureUserMetadata(userId: string, force: boolean): Promise<void> {
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY");
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(userId);
    const meta = user.publicMetadata as Record<string, unknown>;
    // Nothing to do once every managed claim is present (now incl. internal_id).
    if (!force && meta.plan !== undefined && meta.internal_id !== undefined) return;
    const defaultPlan = this.configService.get<string>("rate_limits.default_plan", "homebody");
    const aiEnabled = this.configService.get<boolean>("ai.enabled_default", true);
    // The single DB hit per user: resolve-or-create the stable internal id and
    // stamp it into the signed token claim so the request path stays DB-free.
    const email = user.emailAddresses?.[0]?.emailAddress;
    const internalId = await this.userIdentity.resolve(CLERK_PROVIDER, {
      externalId: userId,
      email,
      claims: {},
    });
    await clerk.users.updateUser(userId, {
      publicMetadata: {
        ...meta,
        ai_enabled: meta.ai_enabled ?? aiEnabled,
        plan: meta.plan ?? defaultPlan,
        internal_id: meta.internal_id ?? internalId,
      },
    });
    this.logger.log(
      `Ensured metadata for user ${userId}: plan=${meta.plan ?? defaultPlan}, internal_id=${meta.internal_id ?? internalId}`,
    );
  }
}
