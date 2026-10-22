import { Stack } from 'expo-router/stack';

// Keep the contents page under every book page, so back returns through it.
export const unstable_settings = { initialRouteName: 'index' };

export default function MuntakhabLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
