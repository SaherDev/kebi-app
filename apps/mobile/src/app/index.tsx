import { useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { HomeLocationLine } from '../components/home-location-line';
import { HomeHero } from '../components/home-hero';
import { QuickPrompts } from '../components/quick-prompts';
import { IntentList } from '../components/intent-list';
import { StashSection } from '../components/stash-section';
import { useHome } from '../components/use-home';
import { useIntents } from '../components/use-intents';
import { useStash } from '../components/use-stash';
import { useChat } from '../components/chat-context';
import { useChatTranscript } from '../components/chat-transcript-context';
import { useSavedPlaces } from '../components/saved-places-context';
import { useSaveSheet } from '../components/save-sheet-context';
import { useTranslation } from '../i18n/context';

/**
 * Home (kebi-home-mockup): three independent surfaces — the greeting + quick
 * prompts (useHome), the "what you wanted" recall (useIntents), and the "your
 * stash" preview (useStash). Each fetches on its own; one failing or loading
 * never blocks the others. Tapping a chip or a recall row opens the chat with
 * that text already sent (`useChat().open(seed)`). The location line shows the
 * city/weather useHome already resolved (location fetched once).
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const saveSheet = useSaveSheet();
  const chat = useChat();
  const home = useHome();
  const intents = useIntents();
  const stash = useStash();

  // The chat and save sheet are overlays, not routes — home keeps its router
  // focus the whole time, so `useFocusEffect` in the data hooks never re-fires
  // after them. Bridge the two activities to an explicit refetch instead.
  const { turns } = useChatTranscript();
  const { items: savedItems } = useSavedPlaces();
  const { refetch: refetchIntents } = intents;
  const { refetch: refetchStash } = stash;

  // A completed chat turn may have recorded a new "what you wanted" intent.
  const doneTurns = turns.filter((t) => t.role === 'kebi' && t.status === 'done').length;
  const doneTurnsRef = useRef(doneTurns);
  useEffect(() => {
    if (doneTurns !== doneTurnsRef.current) {
      doneTurnsRef.current = doneTurns;
      refetchIntents();
    }
  }, [doneTurns, refetchIntents]);

  // A save from the global save sheet should appear in the stash (mirrors library.tsx).
  const savedCountRef = useRef(savedItems.length);
  useEffect(() => {
    if (savedItems.length !== savedCountRef.current) {
      savedCountRef.current = savedItems.length;
      refetchStash();
    }
  }, [savedItems.length, refetchStash]);

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<HomeLocationLine city={home.city} weather={home.weather} />}
          right={
            <TopPill>
              <IconButton icon="share-in" label={t('nav.savePlace')} onPress={saveSheet.open} />
              <IconButton icon="book" label={t('nav.library')} onPress={() => router.push('/library')} />
              <IconButton icon="gear" label={t('nav.settings')} onPress={() => router.push('/settings')} />
            </TopPill>
          }
        />
      }
    >
      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-28 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <HomeHero greeting={home.greeting} />
        <QuickPrompts chips={home.chips} onSelect={chat.open} />
        <IntentList intents={intents.intents} onSelect={chat.open} />
        <StashSection views={stash.views} total={stash.total} />
      </ScrollView>
    </ScreenScaffold>
  );
}
