import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { PlaceCore } from "@kebi-app/shared";
import { IconButton } from "../components/icon-button";
import { PlaceCard } from "../components/place-card";
import { ScreenScaffold } from "../components/screen-scaffold";
import { TopBar } from "../components/top-bar";
import { TopPill } from "../components/top-pill";
import { makeSamplePlace } from "../lib/sample-place";
import { useSaveSheet } from "../components/save-sheet-context";
import { useTranslation } from "../i18n/context";

// TODO: replace with the real saved-places query — placeholder rows so the
// long-press context menu can be exercised in the library list.
const SAMPLE_PLACES: PlaceCore[] = [
  makeSamplePlace("Fuglen", ["cafe"]),
  makeSamplePlace("Afuri Ramen", ["restaurant"]),
  makeSamplePlace("Bar Trench", ["bar"]),
  makeSamplePlace("Nezu Shrine", ["shrine"]),
];

export default function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const saveSheet = useSaveSheet();
  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={
            <IconButton
              icon="back"
              label={t("common.back")}
              onPress={() => router.back()}
            />
          }
          right={
            <TopPill>
              <IconButton icon="search" label={t("common.search")} />
              <IconButton icon="share-in" label={t("nav.savePlace")} onPress={saveSheet.open} />
            </TopPill>
          }
        />
      }
    >
      <View className="flex-1 px-6 pt-2">
        <Text className="font-bold text-title text-text">{t("titles.library")}</Text>
        <ScrollView
          className="mt-4"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-2 pb-28"
        >
          {SAMPLE_PLACES.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              onPress={() => router.push("/place")}
            />
          ))}
        </ScrollView>
      </View>
    </ScreenScaffold>
  );
}
