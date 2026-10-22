import { Stack } from 'expo-router/stack';

// Keep the surah list under any surah page, so back (button or Android gesture) returns to it.
export const unstable_settings = { initialRouteName: 'index' };

export default function QuranLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
