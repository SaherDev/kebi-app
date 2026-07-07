import { Injectable } from '@nestjs/common';
import { IdentityMetadataWriter } from '../identity-metadata.writer';

/**
 * No-op metadata writer. Used for providers that stamp token metadata
 * out-of-band (e.g. via a provider webhook), so the request path
 * can always call `stamp()` without knowing which provider is active.
 */
@Injectable()
export class NoopMetadataWriter implements IdentityMetadataWriter {
  async stamp(): Promise<void> {
    // Intentionally does nothing — out-of-band stamping handles this provider.
  }
}
