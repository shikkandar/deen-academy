import { Stack } from 'expo-router/stack';

// Keep the book list under any chapter page, so back (button or Android gesture) returns through it.
export const unstable_settings = { initialRouteName: 'index' };

export default function HadithLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
