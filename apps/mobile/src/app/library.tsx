import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { IconButton } from "../components/icon-button";
import { PlaceCard } from "../components/place-card";
import { ScreenScaffold } from "../components/screen-scaffold";
import { TopBar } from "../components/top-bar";
import { TopPill } from "../components/top-pill";
import { useSaveSheet } from "../components/save-sheet-context";
import { useSavedPlaces } from "../components/saved-places-context";
import { useTranslation } from "../i18n/context";

export default function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const saveSheet = useSaveSheet();
  const { items } = useSavedPlaces();
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
        {items.length === 0 ? (
          <View className="flex-1 items-center justify-center pb-28">
            <Text className="text-center text-body text-text-soft">{t("library.empty")}</Text>
          </View>
        ) : (
          <ScrollView
            className="mt-4"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-2 pb-28"
          >
            {items.map((item) => (
              <PlaceCard
                key={item.key}
                place={item.place}
                onPress={() => router.push("/place")}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </ScreenScaffold>
  );
}
