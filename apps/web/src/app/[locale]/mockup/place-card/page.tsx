'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Star, Phone, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { PlaceAvatar } from '@/components/PlaceAvatar';
import { cn } from '@kebi-app/ui';

// ── Fake data ────────────────────────────────────────────────────────────────

const PLACE_ENRICHED = {
  place_id: 'pl_nara_eatery',
  place_name: 'Nara Eatery',
  subcategory: 'restaurant',
  tags: ['ramen', 'late_night', 'date_night'],
  attributes: {
    cuisine: 'japanese',
    price_hint: '$$',
    ambiance: 'casual',
    dietary: ['vegetarian'],
    good_for: ['date_night', 'groups'],
    location_context: { neighborhood: 'Ari', city: 'Bangkok', country: 'TH' },
  },
  provider_id: 'google:ChIJN1t_tDeuEmsRUsoyG83frY4',
  geo_fresh: true,
  lat: 13.778,
  address: '123 Ari Soi 4, Bangkok 10400',
  enriched: true,
  hours: { monday: '11:00–22:00', timezone: 'Asia/Bangkok' },
  rating: 4.6,
  phone: '+66 2 123 4567',
  photo_url: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&h=400&fit=crop',
  popularity: 0.82,
};

const PLACE_NO_PHOTO = {
  ...PLACE_ENRICHED,
  place_id: 'pl_bankara',
  place_name: 'Bankara Ramen',
  photo_url: null,
  provider_id: null,
  enriched: false,
  geo_fresh: false,
  lat: null,
  address: null,
};

const PLACE_TIER1_ONLY = {
  ...PLACE_ENRICHED,
  place_id: 'pl_cold',
  place_name: 'Sushi Sora Bangkok',
  photo_url: null,
  provider_id: 'google:ChIJtest123',
  enriched: false,
  geo_fresh: false,
  lat: null,
  address: null,
  attributes: {
    cuisine: 'omakase',
    price_hint: '$$$',
    ambiance: 'upscale',
    dietary: [],
    good_for: ['special_occasion'],
    location_context: { neighborhood: 'Sukhumvit', city: 'Bangkok', country: 'TH' },
  },
};

// ── Price dots ────────────────────────────────────────────────────────────────

function PriceDots({ hint }: { hint: string | null }) {
  if (!hint) return null;
  const count = hint.length; // "$" = 1, "$$" = 2, "$$$" = 3
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'text-[10px] font-bold',
            i < count ? 'text-white/90' : 'text-white/30',
          )}
        >
          $
        </span>
      ))}
    </div>
  );
}

// ── Tag pill ──────────────────────────────────────────────────────────────────

function TagPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
      {label}
    </span>
  );
}

// ── Rating stars ──────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn('h-3 w-3', i < full ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30')}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Map button ────────────────────────────────────────────────────────────────

function MapButton({ providerId, placeName }: { providerId: string; placeName: string }) {
  const rawId = providerId.includes(':')
    ? providerId.split(':').slice(1).join(':')
    : providerId;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}&query_place_id=${encodeURIComponent(rawId)}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <MapPin className="h-3.5 w-3.5" />
      Open in Maps
    </a>
  );
}

// ── PlaceCard ─────────────────────────────────────────────────────────────────

interface MockPlace {
  place_id: string;
  place_name: string;
  subcategory: string | null;
  tags: string[];
  attributes: {
    cuisine: string | null;
    price_hint: string | null;
    ambiance: string | null;
    dietary: string[];
    good_for: string[];
    location_context: { neighborhood: string | null; city: string | null; country: string | null } | null;
  };
  provider_id: string | null;
  geo_fresh: boolean;
  lat: number | null;
  address: string | null;
  enriched: boolean;
  hours: { monday?: string | null; timezone?: string } | null;
  rating: number | null;
  phone: string | null;
  photo_url: string | null;
  popularity: number | null;
}

interface PlaceCardProps {
  place: MockPlace;
  defaultExpanded?: boolean;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

function PlaceCard({ place, defaultExpanded = false, badge, action }: PlaceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showTier2 = place.geo_fresh || place.lat != null;
  const showTier3 = place.enriched;

  return (
    <motion.article
      layout
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Collapsed header — always visible */}
      <button
        className="relative h-40 w-full overflow-hidden bg-muted focus:outline-none"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {/* Photo or avatar */}
        {place.photo_url ? (
          <img
            src={place.photo_url}
            alt={place.place_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <PlaceAvatar name={place.place_name} size={128} />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Badge slot — top-end */}
        {badge && <div className="absolute end-3 top-3">{badge}</div>}

        {/* Bottom info row */}
        <div className="absolute bottom-0 start-0 end-0 flex items-end justify-between p-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-bold text-white leading-tight">{place.place_name}</h3>
            {(place.subcategory ?? place.attributes.cuisine) && (
              <p className="text-[11px] text-white/70">
                {place.subcategory ?? place.attributes.cuisine}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <PriceDots hint={place.attributes.price_hint} />
            <div className="rounded-full bg-black/30 p-1">
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-white/80" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-white/80" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 p-4">
              {/* Tags */}
              {place.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {place.tags.map((t) => <TagPill key={t} label={t} />)}
                </div>
              )}

              {/* Tier 1 attributes */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {place.attributes.cuisine && (
                  <p className="text-muted-foreground">Cuisine <span className="font-medium text-foreground">{place.attributes.cuisine}</span></p>
                )}
                {place.attributes.ambiance && (
                  <p className="text-muted-foreground">Vibe <span className="font-medium text-foreground">{place.attributes.ambiance}</span></p>
                )}
                {place.attributes.dietary.length > 0 && (
                  <p className="text-muted-foreground col-span-2">Dietary <span className="font-medium text-foreground">{place.attributes.dietary.join(', ')}</span></p>
                )}
                {place.attributes.good_for.length > 0 && (
                  <p className="text-muted-foreground col-span-2">Good for <span className="font-medium text-foreground">{place.attributes.good_for.join(', ')}</span></p>
                )}
                {place.attributes.location_context && (
                  <p className="text-muted-foreground col-span-2">
                    {[place.attributes.location_context.neighborhood, place.attributes.location_context.city]
                      .filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Tier 2 — address */}
              {showTier2 && place.address && (
                <p className="text-sm text-muted-foreground">{place.address}</p>
              )}

              {/* Tier 3 — enrichment */}
              {showTier3 && (
                <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
                  {place.rating != null && <RatingStars rating={place.rating} />}
                  {place.hours?.monday && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Mon {place.hours.monday}</span>
                    </div>
                  )}
                  {place.phone && (
                    <a
                      href={`tel:${place.phone}`}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{place.phone}</span>
                    </a>
                  )}
                  {place.popularity != null && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Popularity</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(place.popularity * 100)}%` }}
                        />
                      </div>
                      <span>{Math.round(place.popularity * 100)}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Map button + action slot */}
              <div className="flex flex-wrap items-center gap-2">
                {place.provider_id && (
                  <MapButton providerId={place.provider_id} placeName={place.place_name} />
                )}
                {action}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ── Badge examples ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: 'saved' | 'discovered' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
      source === 'saved'
        ? 'bg-accent text-accent-foreground'
        : 'bg-muted/80 text-muted-foreground',
    )}>
      {source === 'saved' ? 'From your saves' : 'Discovered'}
    </span>
  );
}

function MatchReasonBadge({ reason }: { reason: string }) {
  return (
    <span className="rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground">
      {reason}
    </span>
  );
}

function ConfidencePill({ pct, status }: { pct: number; status: string }) {
  const isReview = status === 'needs_review';
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
      isReview
        ? 'border border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
        : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    )}>
      {isReview ? `${pct}% — Confirm` : 'Saved ✓'}
    </span>
  );
}

// ── Action examples ───────────────────────────────────────────────────────────

function AcceptRejectActions() {
  const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(null);
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setDecision('accepted')}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          decision === 'accepted'
            ? 'bg-primary text-primary-foreground'
            : 'border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
        )}
      >
        {decision === 'accepted' ? '✓ Accepted' : 'Accept'}
      </button>
      <button
        onClick={() => setDecision('rejected')}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          decision === 'rejected'
            ? 'bg-destructive text-destructive-foreground'
            : 'border border-border bg-muted text-muted-foreground hover:bg-muted/80',
        )}
      >
        {decision === 'rejected' ? '✗ Rejected' : 'Reject'}
      </button>
    </div>
  );
}

function ConfirmButton() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <button
      onClick={() => setConfirmed(true)}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        confirmed
          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
          : 'border border-amber-500/50 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100',
      )}
    >
      {confirmed ? '✓ Confirmed' : 'Confirm'}
    </button>
  );
}

// ── Mockup page ───────────────────────────────────────────────────────────────

export default function PlaceCardMockupPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-sm space-y-10">

        <div>
          <h1 className="text-2xl font-bold text-foreground">PlaceCard Mockup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mobile-first. Single column list. Tap to expand.
          </p>
        </div>

        {/* ── Consult flow ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Consult result (3 PlaceCards — all the same component)
          </h2>
          {/* results[0] — expanded by default */}
          <PlaceCard
            place={PLACE_ENRICHED}
            defaultExpanded
            badge={<SourceBadge source="saved" />}
            action={<AcceptRejectActions />}
          />
          {/* results[1..2] — collapsed */}
          <PlaceCard
            place={PLACE_NO_PHOTO}
            badge={<SourceBadge source="discovered" />}
          />
          <PlaceCard
            place={PLACE_TIER1_ONLY}
            badge={<SourceBadge source="saved" />}
          />
        </section>

        {/* ── Recall flow ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recall — with match-reason badge
          </h2>
          <PlaceCard
            place={PLACE_ENRICHED}
            badge={<MatchReasonBadge reason="semantic + keyword" />}
          />
          <PlaceCard
            place={PLACE_NO_PHOTO}
            badge={<MatchReasonBadge reason="filter" />}
          />
        </section>

        {/* ── Save flow ────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Save — needs_review (Confirm button)
          </h2>
          <div className="text-xs text-muted-foreground px-1">1 still processing</div>
          <PlaceCard
            place={PLACE_ENRICHED}
            badge={<ConfidencePill pct={62} status="needs_review" />}
            action={<ConfirmButton />}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Save — auto-saved (status: saved, no action button)
          </h2>
          <PlaceCard
            place={PLACE_TIER1_ONLY}
            badge={<ConfidencePill pct={94} status="saved" />}
          />
        </section>

        {/* ── Map button ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Map button — provider_id present vs null
          </h2>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">With provider_id → map button</p>
            <PlaceCard place={PLACE_ENRICHED} defaultExpanded />
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">No provider_id → no map button</p>
            <PlaceCard place={PLACE_NO_PHOTO} defaultExpanded />
          </div>
        </section>

      </div>
    </div>
  );
}
