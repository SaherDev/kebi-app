import { ATMOSPHERE_EMOJI, type AtmosphereTag, type PlaceTag } from '@kebi-app/shared';
import { Chip } from './chip';

/**
 * Renders one `PlaceCore` tag as a chip. The tag's `type` picks the variant
 * (`atmosphere` → emoji-prefixed vibe; anything else → outlined feature) and its
 * `value` becomes the label (snake_case → spaced). Atmosphere tags get their
 * vibe emoji from `ATMOSPHERE_EMOJI`. Keeps the base `Chip` presentational.
 */
interface PlaceChipProps {
  tag: PlaceTag;
}

/** `private_room` → `private room`; cuisine values (e.g. `Thai`) keep their case. */
function formatTagValue(value: string): string {
  return value.replace(/_/g, ' ');
}

export function PlaceChip({ tag }: PlaceChipProps) {
  const label = formatTagValue(String(tag.value));
  if (tag.type === 'atmosphere') {
    const emoji = ATMOSPHERE_EMOJI[tag.value as AtmosphereTag];
    return (
      <Chip variant="atmosphere" emoji={emoji}>
        {label}
      </Chip>
    );
  }
  return <Chip variant="feature">{label}</Chip>;
}
