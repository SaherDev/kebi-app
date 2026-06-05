import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { type NativeSyntheticEvent, TextInput, type TextInputKeyPressEventData } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AUTH } from '../../auth/constants';
import { SHAKE } from '../../theme/motion';

/**
 * Six-box OTP entry (kebi-otp-email-mockup.html `.otp-inputs`): auto-advance on
 * input, backspace-to-previous, and paste/SMS-autofill distribution across the
 * boxes. Fires `onComplete` once all digits are filled (the screen auto-submits;
 * no verify button). On a wrong code the screen calls `shakeAndClear()`.
 *
 * Box states match the mockup: empty = surface, no border; focused = bg + text
 * border; filled = surface + surface-2 border.
 */
export interface OtpInputHandle {
  /** Wrong-code feedback: wiggle the row, clear all boxes, focus the first. */
  shakeAndClear: () => void;
  focus: () => void;
}

interface OtpInputProps {
  onComplete: (code: string) => void;
  /** Disable entry (while verifying, or during a too-many-tries cooldown). */
  disabled?: boolean;
  /** Focus the first box on mount (the verify screen wants this; the gallery doesn't). */
  autoFocus?: boolean;
}

const LENGTH = AUTH.otpLength;
const EMPTY = Array.from({ length: LENGTH }, () => '');

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { onComplete, disabled = false, autoFocus = true },
  ref,
) {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [focused, setFocused] = useState<number | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);
  const translateX = useSharedValue(0);

  const commit = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const handleChange = (index: number, text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length === 0) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    if (cleaned.length === 1) {
      const next = [...digits];
      next[index] = cleaned;
      if (index < LENGTH - 1) inputs.current[index + 1]?.focus();
      commit(next);
      return;
    }
    // Paste / SMS autofill: spread the digits across the boxes from the start.
    const next = Array.from({ length: LENGTH }, (_, i) => cleaned[i] ?? '');
    const landing = Math.min(cleaned.length, LENGTH) - 1;
    inputs.current[Math.min(landing + 1, LENGTH - 1)]?.focus();
    commit(next);
  };

  const handleKeyPress = (
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputs.current[index - 1]?.focus();
    }
  };

  useImperativeHandle(ref, () => ({
    shakeAndClear: () => {
      translateX.value = withSequence(
        ...SHAKE.offsets.map((offset) => withTiming(offset, { duration: SHAKE.stepMs })),
      );
      setDigits(EMPTY);
      inputs.current[0]?.focus();
    },
    focus: () => inputs.current[0]?.focus(),
  }));

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <Animated.View style={animatedStyle} className="flex-row justify-center gap-2">
      {digits.map((digit, index) => {
        const isFocused = focused === index;
        const tone = isFocused
          ? 'bg-bg border-text'
          : digit !== ''
            ? 'bg-surface border-surface-2'
            : 'bg-surface border-transparent';
        return (
          <TextInput
            key={index}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            value={digit}
            editable={!disabled}
            onChangeText={(text) => handleChange(index, text)}
            onKeyPress={(event) => handleKeyPress(index, event)}
            onFocus={() => setFocused(index)}
            onBlur={() => setFocused((current) => (current === index ? null : current))}
            keyboardType="number-pad"
            maxLength={index === 0 ? LENGTH : 1}
            textContentType="oneTimeCode"
            autoComplete={index === 0 ? 'sms-otp' : 'off'}
            autoFocus={autoFocus && index === 0}
            className={`h-14 w-11 rounded-card border-[1.5px] text-center text-[22px] font-bold text-text ${tone}`}
          />
        );
      })}
    </Animated.View>
  );
});
