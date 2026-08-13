import { Injectable } from '@nestjs/common';
import { CALL_ME_MAX_LENGTH } from '@kebi-app/shared';
import type { AuthUser, ChatUserProfile, NormalizedIdentity } from '@kebi-app/shared';

/**
 * Builds the chat body's `user_profile` block (kebi ADR-154) from the stamped
 * about-me claim, falling back to the verified token's display name for
 * `call_me`. The fallback is the whole reason the about-me form need not write
 * back to the auth provider: a user who never opened it is still addressed by
 * the name their account already carries.
 *
 * Returns `null` when we know nothing — omitting the block entirely is valid and
 * says less than sending three nulls.
 */
@Injectable()
export class ChatUserProfileFactory {
  from(identity: NormalizedIdentity, user: AuthUser): ChatUserProfile | null {
    const aboutMe = user.about_me ?? null;
    const callMe = this.text(aboutMe?.call_me ?? identity.name, CALL_ME_MAX_LENGTH);
    const homeCountry = aboutMe?.home_country ?? null;
    const about = aboutMe?.about ?? null;
    if (callMe === null && homeCountry === null && about === null) return null;
    return { call_me: callMe, home_country: homeCountry, about };
  }

  /**
   * Trim to the contract's cap. The name is the user's account name rather than
   * something typed for kebi, so an over-long one is clamped instead of failing
   * the turn — losing the tail of a display name beats a 422 on every message.
   */
  private text(value: string | null | undefined, maxLength: number): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
  }
}
