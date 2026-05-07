'use client';

import { useState } from 'react';
import {
  MapPin, Star, Phone, Clock, ChevronDown, ChevronUp,
  Utensils, Ticket, ShoppingBag, Wrench, BedDouble,
  Music2, Camera, Youtube, Link2, PenLine, Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PlaceObject } from '@kebi-app/shared';
import { cn } from '@kebi-app/ui';

// ── Letter avatar ─────────────────────────────────────────────────────────────

function LetterAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/70">
      <span className="text-xl font-semibold text-muted-foreground/70 select-none">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

// ── Place-type icon ───────────────────────────────────────────────────────────

const PLACE_TYPE_ICON: Record<string, React.ElementType> = {
  food_and_drink: Utensils,
  things_to_do: Ticket,
  shopping: ShoppingBag,
  services: Wrench,
  accommodation: BedDouble,
};

// ── Source icon ───────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, React.ElementType> = {
  tiktok: Music2,
  instagram: Camera,
  youtube: Youtube,
  link: Link2,
  manual: PenLine,
  consult: Sparkles,
};

// ── Null-string guard ─────────────────────────────────────────────────────────

function val(v: string | null | undefined): string | null {
  if (!v || v === 'null' || v === 'undefined') return null;
  return v;
}

// ── Price display ─────────────────────────────────────────────────────────────

function priceLabel(hint: string | null | undefined): string | null {
  if (!hint) return null;
  switch (hint.toLowerCase()) {
    case 'cheap': return '$';
    case 'moderate': return '$$';
    case 'expensive': return '$$$';
    default: return hint; // already formatted
  }
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

// ── PlaceCard ─────────────────────────────────────────────────────────────────

export interface PlaceCardProps {
  place: PlaceObject;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (next: boolean) => void;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PlaceCard({
  place,
  expanded: controlledExpanded,
  defaultExpanded = false,
  onToggle,
  badge,
  action,
  className,
}: PlaceCardProps) {
  const t = useTranslations('placeCard');
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  function toggle() {
    const next = !expanded;
    if (!isControlled) setInternalExpanded(next);
    onToggle?.(next);
  }

  const showTier3 = place.enriched;

  const mapsUrl = place.provider_id
    ? (() => {
        const rawId = place.provider_id.includes(':')
          ? place.provider_id.split(':').slice(1).join(':')
          : place.provider_id;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.place_name)}&query_place_id=${encodeURIComponent(rawId)}`;
      })()
    : null;

  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date().getDay()
  ] as keyof typeof place.hours;
  const todayHours = place.hours?.[todayKey] ?? null;

  // Metadata chips: type · price · neighborhood
  const metaParts = [
    val(place.subcategory) ?? val(place.attributes.cuisine),
    priceLabel(val(place.attributes.price_hint)),
    val(place.attributes.location_context?.neighborhood) ?? val(place.attributes.location_context?.city),
  ].filter(Boolean) as string[];

  return (
    <article className={cn('overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm', className)}>
      {/* ── Collapsed header ─────────────────────────────────────────────── */}
      <button
        className="flex w-full items-start gap-3 px-4 py-4 text-start focus:outline-none"
        onClick={toggle}
        aria-expanded={expanded}
      >
        <LetterAvatar name={place.place_name} />

        <div className="flex-1 min-w-0 pt-0.5">
          {/* Name */}
          <h3 className="text-base font-bold text-foreground leading-tight">{place.place_name}</h3>

          {/* Badges */}
          {badge && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {badge}
            </div>
          )}

          {/* Metadata row + icons */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {place.place_type && (() => {
              const Icon = PLACE_TYPE_ICON[place.place_type];
              return Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" /> : null;
            })()}
            {metaParts.length > 0 && (
              <p className="text-sm text-muted-foreground">{metaParts.join(' · ')}</p>
            )}
            {place.source && (() => {
              const Icon = SOURCE_ICON[place.source];
              return Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" /> : null;
            })()}
          </div>
        </div>

        <div className="shrink-0 pt-1">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground/60" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground/60" />}
        </div>
      </button>

      {/* ── Expanded body ────────────────────────────────────────────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-border/30 px-4 py-4">

{/* Tags */}
            {place.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {place.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Address */}
            {val(place.address) && (
              <p className="text-sm text-muted-foreground">{val(place.address)}</p>
            )}

            {/* Phone — always shown if available */}
            {val(place.phone) && (
              <a href={`tel:${val(place.phone)}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-fit">
                <Phone className="h-3.5 w-3.5" />
                <span>{val(place.phone)}</span>
              </a>
            )}

            {/* Attributes */}
            {(val(place.attributes.ambiance) || place.attributes.dietary.length > 0 || place.attributes.good_for.length > 0) && (
              <div className="flex flex-col gap-1 text-sm">
                {val(place.attributes.ambiance) && (
                  <p className="text-muted-foreground">Vibe <span className="font-medium text-foreground">{val(place.attributes.ambiance)}</span></p>
                )}
                {place.attributes.dietary.length > 0 && (
                  <p className="text-muted-foreground">Dietary <span className="font-medium text-foreground">{place.attributes.dietary.join(', ')}</span></p>
                )}
                {place.attributes.good_for.length > 0 && (
                  <p className="text-muted-foreground">Good for <span className="font-medium text-foreground">{place.attributes.good_for.join(', ')}</span></p>
                )}
              </div>
            )}

            {/* Tier 3 enrichment */}
            {showTier3 && (
              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
                {place.rating != null && <RatingStars rating={place.rating} />}
                {todayHours && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{todayHours}</span>
                  </div>
                )}
{place.popularity != null && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Popularity</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(place.popularity * 100)}%` }} />
                    </div>
                    <span>{Math.round(place.popularity * 100)}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Map + action */}
            {(mapsUrl || action) && (
              <div className="flex flex-wrap items-center gap-2">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {t('openMap')}
                  </a>
                )}
                {action}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
