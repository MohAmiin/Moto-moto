import { Stack } from 'expo-router';

/** Tabs (Overview, Riders, Customers, Settings) with detail screens on top. Only admins reach this (root layout). */
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
