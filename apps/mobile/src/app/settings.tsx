import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { ScreenTitle } from '../components/screen-title';
import { Button } from '../components/button';
import { useTranslation } from '../i18n/context';
import { useAuth } from '../auth/auth-context';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useAuth();
  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
          right={
            <TopPill>
              <IconButton icon="ellipsis" label={t('common.more')} />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title={t('titles.settings')} />
      {/* Sign out — the gate redirects to /login once the session clears. */}
      <View className="mt-6 flex-row">
        <Button variant="outlined" label={t('auth.signOut')} onPress={() => void signOut()} />
      </View>
    </ScreenScaffold>
  );
}
