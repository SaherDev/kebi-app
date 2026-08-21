import { Text, View } from 'react-native';
import { Skeleton } from './skeleton';

/**
 * The settings forms' loading and failed states (ADR-056): the field labels —
 * static text — stay, and only the controls they name are skeletons, in the
 * height of the input each will become so nothing reflows when values land.
 *
 * `frozen` is the failed read: the loop stops and the blocks dim, under the
 * screen's error row. Neither state draws an input or a save button — these
 * forms write their block whole, so an editable blank over a profile we failed
 * to read is one tap away from erasing it.
 */

/** Input heights (px) the skeletons stand in for: a field, and the gist box. */
const FIELD_HEIGHT = 48;
const TALL_FIELD_HEIGHT = 112;

interface FieldsSkeletonProps {
  /** One label per field, in order. The last one is treated as the tall box. */
  labels: string[];
  frozen?: boolean;
}

export function FieldsSkeleton({ labels, frozen = false }: FieldsSkeletonProps) {
  return (
    <View className="gap-6">
      {labels.map((label, i) => (
        <View key={label} className="gap-2">
          <Text className="ps-1 text-eyebrow font-semibold uppercase text-text-soft">{label}</Text>
          <Skeleton
            height={i === labels.length - 1 ? TALL_FIELD_HEIGHT : FIELD_HEIGHT}
            radius="large"
            frozen={frozen}
          />
        </View>
      ))}
    </View>
  );
}
