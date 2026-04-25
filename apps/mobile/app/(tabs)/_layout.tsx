import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import { CustomTabBar } from '@/components';

export default function TabLayout() {
  const blurTargetRef = useRef<View | null>(null);

  return (
    <View style={styles.root}>
      <BlurTargetView ref={blurTargetRef} style={styles.target}>
        <Tabs
          screenOptions={{
            headerShown: false,
          }}
          tabBar={() => null}
        >
          <Tabs.Screen name='index' />
          <Tabs.Screen name='history' />
          <Tabs.Screen name='profile' />
        </Tabs>
      </BlurTargetView>
      <CustomTabBar blurTarget={blurTargetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  target: {
    flex: 1,
  },
});
