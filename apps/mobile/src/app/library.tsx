import { IconButton } from "../components/icon-button";
import { ScreenScaffold } from "../components/screen-scaffold";
import { ScreenTitle } from "../components/screen-title";
import { TopBar } from "../components/top-bar";
import { TopPill } from "../components/top-pill";
import { useRouter } from "expo-router";
import { useTranslation } from "../i18n/context";

export default function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
              <IconButton icon="share-in" label={t("nav.savePlace")} />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title={t("titles.library")} />
    </ScreenScaffold>
  );
}
