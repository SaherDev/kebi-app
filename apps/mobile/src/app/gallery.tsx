import { ScrollView, View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { StatusPill } from '../components/status-pill';
import { Button } from '../components/button';
import { Group } from '../components/group';
import { PlaceAvatar } from '../components/place-avatar';
import { PlaceChip } from '../components/place-chip';
import { useToast } from '../components/toast-context';
import type { PlaceTag } from '@kebi-app/shared';

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

// Demo row for the Group section — PlaceAvatar + name + trailing status pill,
// mirroring the mockup's group rows.
function GalleryRow({ emoji, name, pill }: { emoji: string; name: string; pill: React.ReactNode }) {
  return (
    <View className="flex-row items-center py-2">
      <PlaceAvatar emoji={emoji} size="card" />
      <Text className="ms-3 flex-1 text-body text-text">{name}</Text>
      {pill}
    </View>
  );
}

// Bold span inside toast text — inherits the toast's text colour (nested Text).
function B({ children }: { children: React.ReactNode }) {
  return <Text className="font-semibold">{children}</Text>;
}

// Sample PlaceCore.tags covering all 9 TagTypes, to demo PlaceChip mapping
// tag.type → variant (atmosphere = emoji vibe; everything else = feature) and
// tag.value → label (snake_case → spaced).
const DEMO_TAGS: PlaceTag[] = [
  { type: 'atmosphere', value: 'intimate', source: 'llm' },
  { type: 'atmosphere', value: 'romantic', source: 'llm' },
  { type: 'atmosphere', value: 'hidden_gem', source: 'llm' },
  { type: 'feature', value: 'private_room', source: 'google' },
  { type: 'feature', value: 'dog_friendly', source: 'google' },
  { type: 'feature', value: 'open_late', source: 'google' },
  { type: 'cuisine', value: 'Japanese', source: 'llm' },
  { type: 'dietary', value: 'vegan', source: 'llm' },
  { type: 'service', value: 'reservable', source: 'google' },
  { type: 'price', value: 'moderate', source: 'google' },
  { type: 'accessibility', value: 'wheelchair_entrance', source: 'google' },
  { type: 'time', value: 'late_night', source: 'llm' },
  { type: 'season', value: 'summer', source: 'llm' },
];

export default function GalleryScreen() {
  const { toggleColorScheme, colorScheme } = useColorScheme();
  const toast = useToast();
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

        <Section title="Place avatar">
          <View className="flex-row items-center gap-3">
            <PlaceAvatar categories={['cafe']} size="card" />
            <PlaceAvatar categories={['bar']} size="card" />
            <PlaceAvatar categories={['restaurant']} size="row" />
            {/* empty categories → 📍 fallback */}
            <PlaceAvatar categories={[]} size="row" />
            {/* per-place override */}
            <PlaceAvatar emoji="🍣" size="row" />
          </View>
        </Section>

        <Section title="Chips — atmosphere (from place.tags)">
          <View className="flex-row flex-wrap items-center gap-2">
            {DEMO_TAGS.filter((t) => t.type === 'atmosphere').map((t) => (
              <PlaceChip key={String(t.value)} tag={t} />
            ))}
          </View>
        </Section>

        <Section title="Chips — feature + other types (from place.tags)">
          <View className="flex-row flex-wrap items-center gap-2">
            {DEMO_TAGS.filter((t) => t.type !== 'atmosphere').map((t) => (
              <PlaceChip key={String(t.value)} tag={t} />
            ))}
          </View>
        </Section>

        <Section title="Toast">
          <View className="flex-row flex-wrap items-center gap-2">
            <Button
              variant="primary"
              label="save"
              onPress={() =>
                toast.show({
                  tone: 'success',
                  icon: 'check',
                  text: (
                    <>
                      saved <B>Saint Jardim</B> to your stash
                    </>
                  ),
                })
              }
            />
            <Button
              variant="outlined"
              label="copy"
              onPress={() => toast.show({ tone: 'neutral', icon: 'copy', text: 'link copied' })}
            />
            <Button
              variant="outlined"
              label="approve"
              onPress={() =>
                toast.show({
                  emoji: '🌟',
                  text: (
                    <>
                      approved <B>Saint Jardim</B>
                    </>
                  ),
                  action: { label: 'undo', onPress: () => undefined },
                })
              }
            />
            <Button
              variant="outlined"
              label="been"
              onPress={() =>
                toast.show({
                  tone: 'success',
                  icon: 'eye',
                  text: (
                    <>
                      marked <B>Kamachiku</B> as been
                    </>
                  ),
                  action: { label: 'undo', onPress: () => undefined },
                })
              }
            />
            <Button
              variant="danger"
              label="remove"
              onPress={() =>
                toast.show({
                  tone: 'danger',
                  icon: 'trash',
                  text: (
                    <>
                      <B>Bar Trench</B> removed
                    </>
                  ),
                  action: { label: 'undo', onPress: () => undefined },
                })
              }
            />
            <Button
              variant="outlined"
              label="error"
              onPress={() =>
                toast.show({
                  tone: 'danger',
                  icon: 'alert',
                  text: "couldn't save that one",
                  action: { label: 'retry', onPress: () => undefined },
                })
              }
            />
            <Button
              variant="outlined"
              label="stack ×3"
              onPress={() => {
                toast.show({ tone: 'success', icon: 'check', text: 'saved' });
                toast.show({ tone: 'neutral', icon: 'copy', text: 'link copied' });
                toast.show({
                  emoji: '🌟',
                  text: 'approved',
                  action: { label: 'undo', onPress: () => undefined },
                });
              }}
            />
          </View>
        </Section>
      </ScrollView>
    </ScreenScaffold>
  );
}
