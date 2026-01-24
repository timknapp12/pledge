import { createContext, useContext } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface ScrollContextValue {
  isScrolling: SharedValue<boolean>;
  setScrolling: (value: boolean) => void;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const isScrolling = useSharedValue(false);

  const setScrolling = (value: boolean) => {
    isScrolling.value = value;
  };

  return (
    <ScrollContext.Provider value={{ isScrolling, setScrolling }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollContext() {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScrollContext must be used within a ScrollProvider');
  }
  return context;
}
