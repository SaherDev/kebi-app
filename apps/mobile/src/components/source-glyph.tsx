import type { PlaceSource } from '@kebi-app/shared';
import { Icon } from './icon';
import { Mascot } from './mascot';
import { SOURCE_ICON } from './source-icon';

/**
 * The leading glyph on a saved place's source line. Social/maps/manual sources
 * use a monochrome {@link Icon} (tinted to match the line); a `kebi`-found place
 * shows the actual mascot, which keeps its own warm palette — it's our brand,
 * not a muted line icon. Centralised so the card and any other source-line
 * surface render it the same way.
 */
export function SourceGlyph({
  source,
  size = 13,
  className = 'text-text-muted',
}: {
  source: PlaceSource;
  size?: number;
  className?: string;
}) {
  if (source === 'kebi') {
    // The mascot reads better a touch larger than the line icons.
    return <Mascot size={size + 3} />;
  }
  return <Icon name={SOURCE_ICON[source]} size={size} className={className} />;
}
