import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, View, Text } from 'react-native';
import { useUnstableNativeVariable } from 'nativewind';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '../icon';
import { SHAKE } from '../../theme/motion';
import { AUTH } from '../../auth/constants';
import type { AuthChannel } from '../../auth/detect-channel';

/**
 * The login smart input (kebi-login-email-mockup.html `.input-wrap`): one field
 * for an email OR a phone number, with a live meta hint that appears below a 1px
 * hairline once the value reads as one or the other. The hint icon + copy swap
 * with `channel`; the parent owns detection (detectChannel) and i18n.
 *
 * On an invalid submit the parent calls `shake()` via the ref — a quick wiggle
 * plus a red border held for AUTH.invalidShakeMs, no toast (kebi-auth-flow.md
 * §Errors). Placeholder color reads the themed `--text-muted` variable so no hex
 * lives here.
 */
export interface SmartInputHandle {
  /** Play the invalid-submit feedback: shake + transient red border. */
  shake: () => void;
}

interface SmartInputProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Detected channel (from the parent) — drives the meta hint. */
  channel: AuthChannel;
  /** Placeholder — pass an already-translated string. */
  placeholder: string;
  /** Meta-hint copy for each detected channel — already translated. */
  emailHint: string;
  phoneHint: string;
  onSubmitEditing?: () => void;
  /** Fired when the field gains focus (the screen scrolls the CTA into view). */
  onFocus?: () => void;
}

export const SmartInput = forwardRef<SmartInputHandle, SmartInputProps>(function SmartInput(
  { value, onChangeText, channel, placeholder, emailHint, phoneHint, onSubmitEditing, onFocus },
  ref,
) {
  const mutedColor = useUnstableNativeVariable('--text-muted') ?? undefined;
  const [errored, setErrored] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateX = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    shake: () => {
      translateX.value = withSequence(
        ...SHAKE.offsets.map((offset) => withTiming(offset, { duration: SHAKE.stepMs })),
      );
      setErrored(true);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setErrored(false), AUTH.invalidShakeMs);
    },
  }));

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const showHint = channel === 'email' || channel === 'phone';

  return (
    <Animated.View
      style={animatedStyle}
      className={`rounded-card border-[1.5px] bg-surface px-4 pb-3 pt-3.5 ${
        errored ? 'border-danger' : 'border-transparent'
      }`}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={mutedColor}
        autoCapitalize="none"
        autoCorrect={false}
        // One stable keyboard for the combined email/phone field — switching
        // keyboardType on detection mid-typing is jarring. Digits/+ are reachable
        // via the email keyboard's number layer; detection only drives the hint.
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="go"
        // 15px (body size) but WITHOUT the body token's lineHeight — a lineHeight
        // on a single-line iOS TextInput clips the glyphs vertically.
        className="p-0 text-[15px] text-text"
      />
      {showHint && (
        <View className="mt-2 flex-row items-center gap-1.5 border-t border-surface-2 pt-2">
          <Icon name={channel === 'email' ? 'mail' : 'phone'} size={11} className="text-text-muted" />
          <Text className="text-small text-text-muted">
            {channel === 'email' ? emailHint : phoneHint}
          </Text>
        </View>
      )}
    </Animated.View>
  );
});
