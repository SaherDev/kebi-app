import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { StatusPill } from '../components/status-pill';
import { Button } from '../components/button';
import { Group } from '../components/group';
import { IconButton } from '../components/icon-button';
import { PlaceAvatar } from '../components/place-avatar';
import { PlaceCard } from '../components/place-card';
import { PlaceChip } from '../components/place-chip';
import { Mascot } from '../components/mascot';
import { KebiFab } from '../components/kebi-fab';
import { ReasoningBlock, type ReasoningBlockStep } from '../components/reasoning-block';
import { ActionSheet } from '../components/action-sheet';
import { usePlaceMenuItems } from '../components/use-place-menu-items';
import { useToast } from '../components/toast-context';
import { triggerHaptic } from '../lib/haptics';
import { makeSamplePlace } from '../lib/sample-place';
import type { PlaceTag, ReasoningStepStatus } from '@kebi-app/shared';

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

// Context-menu demo: a PlaceCard to long-press (lift + blur) and a ••• button
// that opens the place action sheet. Both share the place action set via
// usePlaceMenuItems. Demo labels are dev-only, not i18n copy.
const CTX_MENU_PLACE = makeSamplePlace('Fuglen', ['cafe']);

function ContextMenuDemo() {
  const [open, setOpen] = useState(false);
  const items = usePlaceMenuItems(CTX_MENU_PLACE);
  return (
    <View className="gap-3">
      <PlaceCard place={CTX_MENU_PLACE} />
      <Text className="text-small text-text-muted">↑ long-press the card to lift the menu</Text>
      <View className="flex-row items-center justify-between rounded-large bg-surface px-3.5 py-1.5">
        <Text className="text-body font-medium text-text">place ••• action sheet</Text>
        <IconButton icon="ellipsis" label="more" variant="pill" onPress={() => setOpen(true)} />
      </View>
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        header={{ emoji: '☕', eyebrow: 'this place', title: 'Fuglen' }}
        items={items}
        closeLabel="close"
      />
    </View>
  );
}

// One labelled mascot tile for the Mascot section — the bird at a real usage
// size with its px/context caption. `breathe` wraps it in the animate-breathe
// loop so the keyframe can be eyeballed.
function MascotTile({ size, label, breathe }: { size: number; label: string; breathe?: boolean }) {
  return (
    <View className="items-center gap-1">
      <View className={breathe ? 'animate-breathe' : undefined}>
        <Mascot size={size} />
      </View>
      <Text className="text-eyebrow text-text-soft">{label}</Text>
    </View>
  );
}

// Reasoning-block demos: a finished turn (all done, with a duration tally) and a
// live turn (one done step + one active step still streaming → shimmer skeleton).
const DONE_STEPS: ReasoningBlockStep[] = [
  { id: 's1', status: 'done', title: 'parsed your intent', summary: 'drinks, somewhere lively, not a quiet wine spot' },
  { id: 's2', status: 'done', title: 'searched your stash', summary: '2 bars you liked from past nights out' },
  { id: 's3', status: 'done', title: 'found nearby spots', summary: '7 more in shibuya/shimokitazawa, busy on a friday night' },
  { id: 's4', status: 'done', title: 'ranked 9 candidates', summary: 'leaning on energy first, then walking distance' },
];

const RUNNING_STEPS: ReasoningBlockStep[] = [
  { id: 'r1', status: 'done', title: 'picked up the context', summary: "post-club food, late night, near where you'll be coming from shibuya" },
  { id: 'r2', status: 'active', title: 'scanning late-night spots', summary: null },
];

// The actual halal-dinner turn, captured frame-by-frame with each frame's real
// offset (ms from the first frame). This is the reference the chat-screen reducer
// follows: drop `debug` frames, upsert reasoning steps by `id`, flip `done` on the
// done frame. The gaps between user steps are the hidden "thinking" the agent did
// between tool calls — so the panel sits on its done steps for ~5s before "got it".
type ReplayFrame =
  | { at: number; vis: 'user' | 'debug'; id: string; title: string; summary: string | null; status: ReasoningStepStatus }
  | { at: number; done: true };

const REAL_STREAM: ReplayFrame[] = [
  { at: 0, vis: 'user', id: 'agent.location#0', title: 'found your location', summary: null, status: 'active' },
  { at: 1715, vis: 'user', id: 'agent.location#0', title: 'found your location', summary: 'around Izumi 2, Suginami, Japan', status: 'done' },
  { at: 1721, vis: 'debug', id: 'agent.tool_decision#0', title: 'thinking', summary: null, status: 'active' },
  { at: 3261, vis: 'debug', id: 'agent.tool_decision#0', title: 'thinking', summary: 'thinking…', status: 'done' },
  { at: 3264, vis: 'user', id: 'find_saved#0', title: 'searched your saved spots', summary: null, status: 'active' },
  { at: 3291, vis: 'user', id: 'find_saved#0', title: 'searched your saved spots', summary: 'nothing saved matched that', status: 'done' },
  { at: 3293, vis: 'debug', id: 'agent.tool_decision#1', title: 'thinking', summary: null, status: 'active' },
  { at: 6443, vis: 'debug', id: 'agent.tool_decision#1', title: 'thinking', summary: 'thinking…', status: 'done' },
  { at: 6447, vis: 'user', id: 'discover_places#1', title: 'searched nearby', summary: null, status: 'active' },
  { at: 6447, vis: 'debug', id: 'discover_places#1.start', title: '', summary: null, status: 'active' },
  { at: 6447, vis: 'debug', id: 'discover_places#1.start', title: '', summary: 'checking nearby', status: 'done' },
  { at: 6996, vis: 'user', id: 'discover_places#1', title: 'searched nearby', summary: "5 spots — Wagyu Steak & Hamburger, Wagyu, +3 more (5 didn't fit)", status: 'done' },
  { at: 6999, vis: 'debug', id: 'agent.tool_decision#2', title: 'thinking', summary: null, status: 'active' },
  { at: 11796, vis: 'debug', id: 'agent.tool_decision#2', title: 'thinking', summary: 'drafting the reply…', status: 'done' },
  { at: 11800, done: true },
];

// Replays REAL_STREAM at real wall-clock timing through the same reducer the chat
// screen will use; "replay" restarts. durationMs uses wall-clock (~11.8s) — what
// the user actually waited — not the sum of the visible steps' latencies.
function RealStreamDemo() {
  const [runId, setRunId] = useState(0);
  const [steps, setSteps] = useState<ReasoningBlockStep[]>([]);
  const [done, setDone] = useState(false);
  const [durationMs, setDurationMs] = useState<number | undefined>(undefined);

  useEffect(() => {
    setSteps([]);
    setDone(false);
    setDurationMs(undefined);
    const timers = REAL_STREAM.map((f) =>
      setTimeout(() => {
        if ('done' in f) {
          setDone(true);
          setDurationMs(f.at);
          return;
        }
        if (f.vis === 'debug') return; // reducer drops debug frames
        setSteps((prev) => {
          const step: ReasoningBlockStep = {
            id: f.id,
            status: f.status,
            title: f.title || undefined,
            summary: f.summary,
          };
          const i = prev.findIndex((s) => s.id === f.id);
          if (i === -1) return [...prev, step];
          const next = prev.slice();
          next[i] = step;
          return next;
        });
      }, f.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [runId]);

  return (
    <View className="gap-3">
      <ReasoningBlock steps={steps} done={done} durationMs={durationMs} />
      <Button variant="outlined" label="replay" onPress={() => setRunId((r) => r + 1)} />
    </View>
  );
}

// Real long/raw summaries from a live stream (the halal-dinner turn) — verifies
// the narration clamp holds: a model-list line and a multi-paragraph draft.
const LONG_STEPS: ReasoningBlockStep[] = [
  { id: 'l1', status: 'done', title: 'found your location', summary: 'around Izumi 2, Suginami, Japan.' },
  {
    id: 'l2',
    status: 'done',
    title: 'searched nearby',
    summary:
      'Found 5 options: Wagyu Steak & Hamburger (Halal Vegan Gluten free) Shibuya, Wagyu Hamburger Steak & Ramen Shinjuku Kabukicho, HALAL RAMEN & WAGYU SAMURAI SOUL, HALAL AND VEGAN RAMEN DATTEBAYO Asakusa, Wagyu & Vegan Hamburger Ginza (5 didn’t fit your requirements).',
  },
  {
    id: 'l3',
    status: 'done',
    title: 'ranked the options',
    summary:
      'Wagyu Steak & Hamburger in Shibuya — halal, vegan, and vegetarian options, serves all day.\n\nWagyu Hamburger Steak & Ramen in Shinjuku — halal and vegetarian, lunch and dinner.\n\nHALAL RAMEN & WAGYU SAMURAI SOUL in Asakusa — halal and vegetarian, family-friendly.',
  },
];

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
              onPress={() => {
                triggerHaptic('theme-toggle');
                toggleColorScheme();
              }}
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
      <ScrollView className="flex-1 px-6 pt-2" contentContainerClassName="pb-24">
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

        <Section title="Mascot — design-system sizes (last tile breathes)">
          {/* Real usage sizes per the mockup: §17 mascot (96 hero / 56 home /
              36 header / 24 card / 18 chat-title) + §09 AI-button mascot (42px,
              inside the 64px FAB). The breathing tile eyeballs the breathe
              keyframe at FAB size. */}
          <View className="flex-row flex-wrap items-end gap-5">
            <MascotTile size={96} label="96 · hero" />
            <MascotTile size={56} label="56 · home" />
            <MascotTile size={42} label="42 · FAB" />
            <MascotTile size={36} label="36 · header" />
            <MascotTile size={24} label="24 · card" />
            <MascotTile size={18} label="18 · chat" />
            <MascotTile size={42} label="42 · breathe" breathe />
          </View>
        </Section>

        <Section title="Context menu — long-press + overflow">
          <ContextMenuDemo />
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

        <Section title="Reasoning block — real stream (replay, real timing)">
          <RealStreamDemo />
        </Section>

        <Section title="Reasoning block — running">
          <ReasoningBlock steps={RUNNING_STEPS} />
        </Section>

        <Section title="Reasoning block — done (tap to collapse)">
          <ReasoningBlock steps={DONE_STEPS} done durationMs={1800} />
        </Section>

        <Section title="Reasoning block — long/raw detail (clamped to 2 lines)">
          <ReasoningBlock steps={LONG_STEPS} done durationMs={7100} />
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
      {/* Real FAB, tappable here (fires a toast instead of routing to chat) so
          its press feedback can be felt in isolation. */}
      <KebiFab onPress={() => toast.show({ emoji: '🐤', text: 'kebi tapped' })} />
    </ScreenScaffold>
  );
}
