import { useEffect, useRef, useState } from 'react';
import type { HomeChip } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getHome, type HomeQuery } from '../api/home';
import { getDeviceCity, getDeviceLocation } from '../lib/location';
import { getWeather, type Weather } from '../lib/weather';
import { FALLBACK_CHIP_KEYS } from '../lib/home-config';
import { useTranslation } from '../i18n/context';

/**
 * Home greeting + chips (api-contract.md §GET /v1/home). The expensive,
 * taste-dependent surface — kept independent of the cheap recall/stash reads
 * (one screen, three lifecycles) and fetched on **mount only** (not focus) so a
 * return to home doesn't re-run the generation. The client supplies the local
 * context the server can't know: a fresh GPS fix (prompts on first open) is
 * reverse-geocoded to a city and turned into a weather hint, with the device's
 * local time. Every context lookup is best-effort — a missing one is just an
 * omitted query param.
 *
 * The endpoint fails open server-side, so a 200 always carries a usable greeting
 * + chips; this hook adds a **transport** fallback (offline/timeout): a null
 * greeting (the hero stays blank) and generic chips so the screen is never empty.
 * `city`/`weather` are surfaced for the header line so location is fetched once.
 */
export interface UseHome {
  greeting: string | null;
  chips: HomeChip[];
  city: string | null;
  weather: Weather | null;
  loading: boolean;
}

/** Naive local ISO (no offset/Z) — matches the contract's `local_time` example. */
function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function useHome(): UseHome {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;
  const { t } = useTranslation();

  const [greeting, setGreeting] = useState<string | null>(null);
  const [chips, setChips] = useState<HomeChip[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loc = await getDeviceLocation();
      const [resolvedCity, resolvedWeather] = loc
        ? await Promise.all([getDeviceCity(loc), getWeather(loc.lat, loc.lng)])
        : [null, null];
      if (cancelled) return;
      setCity(resolvedCity);
      setWeather(resolvedWeather);

      const query: HomeQuery = {
        ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
        ...(resolvedCity ? { city: resolvedCity } : {}),
        local_time: localIso(new Date()),
        ...(resolvedWeather ? { weather: resolvedWeather.condition } : {}),
      };

      try {
        const res = await getHome(clientRef.current, query);
        if (cancelled) return;
        setGreeting(res.greeting);
        setChips(res.chips);
      } catch {
        if (cancelled) return;
        // Transport failure — keep the screen usable with generic chips.
        setGreeting(null);
        setChips(FALLBACK_CHIP_KEYS.map((key) => ({ text: t(key) })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount-only: the greeting is expensive and cached upstream; re-running it on
    // every render/focus would defeat that. `t` is stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { greeting, chips, city, weather, loading };
}
