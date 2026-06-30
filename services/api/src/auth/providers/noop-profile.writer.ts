import { Injectable } from '@nestjs/common';
import { ProfileWriter } from '../profile-writer.interface';

/**
 * No-op profile writer. Used for providers whose display name is managed
 * out-of-band, so the request path can always call `setName()` without knowing
 * which provider is active.
 */
@Injectable()
export class NoopProfileWriter implements ProfileWriter {
  async setName(): Promise<void> {
    // Intentionally does nothing — name is managed out-of-band for this provider.
  }
}
