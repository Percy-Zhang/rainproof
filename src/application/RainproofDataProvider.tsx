import { createContext, type PropsWithChildren, useContext } from 'react';

import { useRainproofData, type RainproofDataState } from './useRainproofData';

const RainproofDataContext = createContext<RainproofDataState | null>(null);

export function RainproofDataProvider({ children }: PropsWithChildren) {
  const value = useRainproofData();

  return (
    <RainproofDataContext.Provider value={value}>
      {children}
    </RainproofDataContext.Provider>
  );
}

export function useRainproofDataContext(): RainproofDataState {
  const context = useContext(RainproofDataContext);

  if (!context) {
    throw new Error('useRainproofDataContext must be used inside RainproofDataProvider.');
  }

  return context;
}
