import { View, Text, Pressable } from 'react-native';
import { PRESS } from '../theme/motion';
import type { BillingCycle } from './plans-content';

/**
 * Monthly / yearly billing switch (kebi-plans-mockup.html `.billing-toggle`). A
 * pill track where the active cycle lifts to a `--text` fill; the yearly segment
 * carries a small "save 20%" badge. Presentational — pass already-translated
 * labels; the selected cycle and price-swap live with the caller.
 */
interface BillingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  monthlyLabel: string;
  yearlyLabel: string;
  saveLabel: string;
}

export function BillingToggle({
  value,
  onChange,
  monthlyLabel,
  yearlyLabel,
  saveLabel,
}: BillingToggleProps) {
  const monthlyActive = value === 'monthly';
  const yearlyActive = value === 'yearly';
  return (
    <View className="flex-row rounded-full bg-surface p-[3px]">
      <Pressable
        onPress={() => onChange('monthly')}
        accessibilityRole="button"
        accessibilityState={{ selected: monthlyActive }}
        accessibilityLabel={monthlyLabel}
        className={`flex-1 items-center justify-center rounded-full px-3 py-2 ${PRESS} ${
          monthlyActive ? 'bg-text' : 'bg-transparent'
        }`}
      >
        <Text
          className={`text-small font-medium ${monthlyActive ? 'text-bg' : 'text-text-muted'}`}
        >
          {monthlyLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('yearly')}
        accessibilityRole="button"
        accessibilityState={{ selected: yearlyActive }}
        accessibilityLabel={yearlyLabel}
        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2 ${PRESS} ${
          yearlyActive ? 'bg-text' : 'bg-transparent'
        }`}
      >
        <Text
          className={`text-small font-medium ${yearlyActive ? 'text-bg' : 'text-text-muted'}`}
        >
          {yearlyLabel}
        </Text>
        {/* The active chip sits on the --text fill — use the pre-composed chip
            token, not an opacity-on-var (which renders black). */}
        <View
          className={`rounded-full px-1.5 py-0.5 ${yearlyActive ? 'bg-on-fill-chip' : 'bg-surface-2'}`}
        >
          <Text
            className={`text-eyebrow font-semibold ${yearlyActive ? 'text-bg' : 'text-text-muted'}`}
          >
            {saveLabel}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
