'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { NavBar, NavBarLogo, NavBarActions } from '@/components/NavBar';
import { ProfileMenu } from '@/components/profile-menu';
import { ChatInput } from '@/components/ChatInput';
import { HomeIdle } from '@/components/home/HomeIdle';
import { TasteProfileCelebration } from '@/components/home/TasteProfileCelebration';
import { ChipSelectionBoard } from '@/components/home/ChipSelectionBoard';
import { SavedProgressNudge } from '@/components/home/SavedProgressNudge';
import { UserBubble } from '@/components/home/UserBubble';
import { AssistantBubble } from '@/components/home/AssistantBubble';
import { RecallResultBubble } from '@/components/home/RecallResultBubble';
import { PlaceCard } from '@/components/PlaceCard';
import { ConsultError } from '@/components/home/ConsultError';
import { SaveError } from '@/components/home/SaveError';
import { ConsultResult } from '@/flows/consult/ConsultResult';
import { TASTE_CHIP_BANK } from '@/constants/home-suggestions';
import { Illustration } from '@/components/illustrations/Illustration';
import { KebiCard } from '@kebi-app/ui';
import { useHomeStore, type ThreadEntry } from '@/store/home-store';
import { ChatStream } from '@/components/chat/chat-stream';
import { ReasoningCard } from '@/components/chat/renderers/reasoning-step-renderer';

const LOADING_LINES = [
  'Sniffing out your taste…',
  'Consulting the forest spirits…',
  'Reading your food memories…',
  'Counting your saves…',
  'Building your taste map…',
  'Almost there — Kebi is thinking…',
];

function KebiLoadingScreen() {
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLineIdx((i) => (i + 1) % LOADING_LINES.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-dvh flex-col items-center bg-background px-8 animate-fade-in">
      {/* Illustration sits in top portion */}
      <div className="flex flex-1 items-end justify-center pb-10">
        <Illustration
          id="knowing"
          className="h-52 w-52 [animation:bounce_1.6s_ease-in-out_infinite]"
        />
      </div>

      {/* Text + dots anchored at center-bottom */}
      <div className="flex flex-1 flex-col items-center gap-3 pt-10">
        <p
          key={lineIdx}
          className="animate-fade-in text-center text-base font-medium text-foreground"
        >
          {LOADING_LINES[lineIdx]}
        </p>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ReasoningThreadEntry({ steps }: { steps: import('@kebi-app/shared').SseReasoningStep[] }) {
  return <ReasoningCard steps={steps} isStreaming={false} />;
}

// Strip LLM-generated markdown lists/headings — keep only the intro sentence.
function extractIntro(message: string): string {
  const lines = message.split('\n');
  const intro: string[] = [];
  for (const line of lines) {
    if (/^#{1,6}\s|^\d+\.\s|^[-*]\s|^!\[/.test(line)) break;
    intro.push(line);
  }
  return intro.join('\n').trim();
}

function timestampFromId(id: string): number {
  const parsed = Number.parseInt(id.split('-')[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function ThreadEntryView({ entry }: { entry: ThreadEntry }) {
  if (entry.role === 'user') {
    return <UserBubble content={entry.content} timestamp={timestampFromId(entry.id)} />;
  }
  if (entry.type === 'clarification' || entry.type === 'assistant') {
    return <AssistantBubble message={entry.message} type={entry.type} timestamp={timestampFromId(entry.id)} />;
  }
  if (entry.type === 'consult') {
    const intro = extractIntro(entry.message);
    return (
      <div className="flex flex-col gap-4">
        {intro && <AssistantBubble message={intro} type="assistant" timestamp={timestampFromId(entry.id)} />}
        <ConsultResult result={entry.data} />
      </div>
    );
  }
  if (entry.type === 'save') {
    if (!entry.item.place) return null;
    const badge = entry.item.status === 'duplicate'
      ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Duplicate</span>
      : <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Saved</span>;
    return <PlaceCard place={entry.item.place} badge={badge} />;
  }
  if (entry.type === 'recall') {
    const intro = extractIntro(entry.message);
    return (
      <div className="flex flex-col gap-3">
        {intro && <AssistantBubble message={intro} type="assistant" timestamp={timestampFromId(entry.id)} />}
        <RecallResultBubble message={entry.message} data={entry.data} />
      </div>
    );
  }
  if (entry.type === 'reasoning') {
    return <ReasoningThreadEntry steps={entry.steps} />;
  }
  if (entry.type === 'error') {
    return null;
  }
  return null;
}


export default function HomePage() {
  const { userId, getToken } = useAuth();
  const { user } = useUser();
  const t = useTranslations();
  const store = useHomeStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    store.hydrate();
    store.init({ userId: userId ?? null, getToken: async () => (await getToken()) ?? '' });
  }, []); // intentional: run once on mount

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [store.thread.length, store.activeFlowId]);

  const placeholderKey = 'chat.placeholder';

  const hasThread = store.thread.length > 0;

  if (!store.hydrated) return null;

  if (store.contextLoading) {
    return <KebiLoadingScreen />;
  }

  return (
    <div className="flex h-dvh flex-col bg-background animate-fade-in">
      <NavBar>
        <NavBarLogo />
        <NavBarActions>
          <ProfileMenu />
        </NavBarActions>
      </NavBar>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sticky clear button — sits above the scroll area */}
        {hasThread && (
          <div className="absolute top-3 start-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-4 pointer-events-none">
            <button
              onClick={() => { stopStreamRef.current?.(); store.clearThread(); }}
              className="pointer-events-auto p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
              aria-label="Clear conversation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable message area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className={`mx-auto w-full max-w-2xl px-4 flex flex-col gap-4 ${hasThread ? 'pt-10 pb-6' : 'py-6'}`}>

            {/* Warming nudge */}
            {store.signalTier === 'warming' && (
              <SavedProgressNudge
                count={store.savedPlacesCountFromContext ?? store.savedPlaceCount}
                tier={store.signalTier}
              />
            )}

            {/* Chip selection — always shown when in this phase, regardless of thread */}
            {store.phase === 'chip-selection' && (
              <ChipSelectionBoard
                chips={store.chips}
                onConfirm={(chips) => void store.confirmChips(chips)}
                onSkip={() => store.reset()}
              />
            )}

            {/* Empty state — only when no thread and no active flow */}
            {store.phase !== 'chip-selection' && !hasThread && !store.activeFlowId && (() => {
              if (store.phase === 'taste-profile') {
                return <TasteProfileCelebration chips={TASTE_CHIP_BANK} onStartExploring={store.confirmTasteProfile} />;
              }
              return (
                <HomeIdle
                  onSuggestionClick={store.submit}
                  firstName={user?.firstName}
                  savedCount={store.savedPlacesCountFromContext ?? store.savedPlaceCount}
                  chips={store.chips.length > 0 ? store.chips : undefined}
                />
              );
            })()}

            {/* Thread + stream — hidden while the user is picking chips */}
            {store.phase !== 'chip-selection' && (
              <>
                {store.thread.map((entry) => {
                  if (entry.role === 'assistant' && entry.type === 'error') {
                    const retry = () => store.submit(store.query ?? '', { isRetry: true });
                    const message = 'message' in entry && entry.message ? entry.message : entry.category;
                    if (entry.flowId === 'save') {
                      return (
                        <SaveError
                          key={entry.id}
                          error={{ message, category: entry.category as 'offline' | 'timeout' | 'server' | 'generic' }}
                          onTryAgain={retry}
                        />
                      );
                    }
                    return (
                      <ConsultError
                        key={entry.id}
                        error={{ message, category: entry.category, ...('rateLimitInfo' in entry && entry.rateLimitInfo ? { rateLimitInfo: entry.rateLimitInfo } : {}) }}
                        onTryAgain={retry}
                      />
                    );
                  }
                  return <ThreadEntryView key={entry.id} entry={entry} />;
                })}

                {/* Active SSE stream */}
                <ChatStream
                  streamingMessage={store.streamingMessage}
                  signalTier={store.signalTier}
                  onComplete={() => store.clearStream()}
                  onStop={() => store.clearStream()}
                  stopRef={stopStreamRef}
                />
              </>
            )}

          </div>
        </div>

      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 md:pb-6">
        <div className="mx-auto w-full max-w-2xl">
          <KebiCard elevation="floating" className="overflow-hidden">
            <div className="p-2">
              <ChatInput
                onSubmit={store.submit}
                onStop={() => { stopStreamRef.current?.(); store.clearStream(); }}
                isStreaming={store.streamingMessage !== null}
                disabled={store.phase === 'chip-selection'}
                placeholder={t(placeholderKey as Parameters<typeof t>[0])}
              />
            </div>
          </KebiCard>
        </div>
      </div>
    </div>
  );
}
