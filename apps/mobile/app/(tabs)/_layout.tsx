import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/components';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="two" />
      <Tabs.Screen name="three" />
    </Tabs>
  );
}
