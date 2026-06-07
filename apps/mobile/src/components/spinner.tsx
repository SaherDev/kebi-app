import { View } from 'react-native';

/**
 * Small indeterminate ring for in-button loading states — the save sheet
 * "saving" CTA and the login "sending" button (kebi-save-sheet-saving-mockup.html
 * `.sheet-cta-spinner`). Sits on a primary (`bg-text`) button: a faint
 * `--text-soft` track with one bright `--bg` arc, rotated by the NativeWind
 * `animate-spin` keyframe. Presentational; size is the px diameter.
 */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      style={{ width: size, height: size }}
      className="animate-spin rounded-full border-2 border-text-soft border-t-bg"
    />
  );
}
