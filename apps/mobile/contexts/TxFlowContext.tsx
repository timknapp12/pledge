/**
 * Global transaction-flow overlay for multi-step operations
 * (wallet sign → confirm → DB save). Mounted outside the Stack so
 * Expo Router's iOS Phantom callback nav reset can't unmount it.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { TxFlowOverlay, type TxFlowStep } from '@/components/common/TxFlowOverlay';

export type { TxFlowStep };

interface TxFlowState {
  visible: boolean;
  title?: string;
  step: TxFlowStep;
}

interface BeginFlowOptions {
  title?: string;
  step?: TxFlowStep;
}

interface TxFlowContextValue {
  beginFlow: (opts?: BeginFlowOptions) => void;
  setStep: (step: TxFlowStep) => void;
  endFlow: (delayMs?: number) => void;
}

const TxFlowContext = createContext<TxFlowContextValue | null>(null);

export const useTxFlow = (): TxFlowContextValue => {
  const ctx = useContext(TxFlowContext);
  if (!ctx) throw new Error('useTxFlow must be used inside TxFlowProvider');
  return ctx;
};

export const TxFlowProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<TxFlowState>({
    visible: false,
    step: 'wallet',
  });
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndTimer = () => {
    if (endTimer.current) {
      clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  };

  const beginFlow = useCallback((opts?: BeginFlowOptions) => {
    clearEndTimer();
    setState({
      visible: true,
      title: opts?.title,
      step: opts?.step ?? 'wallet',
    });
  }, []);

  const setStep = useCallback((step: TxFlowStep) => {
    setState((prev) => (prev.visible ? { ...prev, step } : prev));
  }, []);

  const endFlow = useCallback((delayMs = 0) => {
    clearEndTimer();
    const hide = () => setState((prev) => ({ ...prev, visible: false }));
    if (delayMs > 0) {
      endTimer.current = setTimeout(hide, delayMs);
    } else {
      hide();
    }
  }, []);

  return (
    <TxFlowContext.Provider value={{ beginFlow, setStep, endFlow }}>
      {children}
      <TxFlowOverlay
        visible={state.visible}
        title={state.title}
        step={state.step}
      />
    </TxFlowContext.Provider>
  );
};
