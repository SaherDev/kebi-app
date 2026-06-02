import { ScrollView, View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { StatusPill } from '../components/status-pill';
import { Button } from '../components/button';
import { Group } from '../components/group';

/**
 * Component gallery — a dev-only route (`/gallery`) for eyeballing the
 * design-system components in light and dark in the simulator. Add a Section
 * here whenever a new shared component lands so we can check it in isolation.
 * Demo labels are dev-only strings, not product copy (so not routed via i18n).
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-eyebrow font-semibold uppercase text-text-soft">{title}</Text>
      {children}
    </View>
  );
}

// Demo row for the Group section — emoji avatar + name + trailing status pill,
// mirroring the mockup's group rows. (A real PlaceRow/avatar component is
// separate, out of scope here.)
function GalleryRow({ emoji, name, pill }: { emoji: string; name: string; pill: React.ReactNode }) {
  return (
    <View className="flex-row items-center py-2">
      <View className="h-7 w-7 items-center justify-center rounded-small bg-surface-2">
        <Text className="text-[15px]">{emoji}</Text>
      </View>
      <Text className="ms-3 flex-1 text-body text-text">{name}</Text>
      {pill}
    </View>
  );
}

export default function GalleryScreen() {
  const { toggleColorScheme, colorScheme } = useColorScheme();
  return (
    <ScreenScaffold
      showFab={false}
      topBar={
        <TopBar
          left={<Text className="font-bold text-subtitle text-text">gallery</Text>}
          right={
            <Pressable
              onPress={toggleColorScheme}
              accessibilityRole="button"
              accessibilityLabel="toggle theme"
              className="rounded-full bg-surface px-3 py-2"
            >
              <Text className="text-small font-semibold text-text">{colorScheme}</Text>
            </Pressable>
          }
        />
      }
    >
      <ScrollView className="flex-1 px-6 pt-2" contentContainerClassName="pb-16">
        <Section title="Status pills">
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusPill variant="green">saved</StatusPill>
            <StatusPill variant="warm">new</StatusPill>
            <StatusPill variant="amber">approve?</StatusPill>
            <StatusPill variant="danger">closed</StatusPill>
          </View>
        </Section>

        <Section title="Buttons">
          {/* Content-width in a row, mirroring the mockup (not full-width). */}
          <View className="flex-row flex-wrap items-center gap-2">
            <Button variant="primary" label="good pick" />
            <Button variant="outlined" label="not it" />
            <Button variant="danger" label="do it" />
            <Button variant="primary" label="disabled" disabled />
          </View>
        </Section>

        <Section title="Group">
          <Group eyebrow="saved places">
            <GalleryRow emoji="🍜" name="Kamachiku" pill={<StatusPill variant="green">saved</StatusPill>} />
            <GalleryRow emoji="🍷" name="Saint Jardim" pill={<StatusPill variant="warm">new</StatusPill>} />
            <GalleryRow emoji="⛩️" name="Nezu Shrine" pill={<StatusPill variant="green">went</StatusPill>} />
          </Group>
        </Section>
      </ScrollView>
    </ScreenScaffold>
  );
}
