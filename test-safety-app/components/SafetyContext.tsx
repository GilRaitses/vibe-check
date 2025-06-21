import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SafetyData {
  blocks: Block[];
  updateBlockSafety: (blockId: number, bikeCount: number) => void;
}

interface Block {
  id: number;
  lat: number;
  lng: number;
  score: number;
  lastUpdated?: string;
}

const SafetyContext = createContext<SafetyData | undefined>(undefined);

export const useSafety = () => {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }
  return context;
};

interface SafetyProviderProps {
  children: ReactNode;
}

export const SafetyProvider: React.FC<SafetyProviderProps> = ({ children }) => {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 1, lat: 37.7749, lng: -122.4194, score: 8 },
    { id: 2, lat: 37.7755, lng: -122.4185, score: 5 },
    { id: 3, lat: 37.7760, lng: -122.4170, score: 2 },
  ]);

  const updateBlockSafety = (blockId: number, bikeCount: number) => {
    const newScore = Math.max(1, 10 - bikeCount); // 10 = safe, 1 = dangerous
    const now = new Date().toLocaleTimeString();
    
    setBlocks(prevBlocks => 
      prevBlocks.map(block => 
        block.id === blockId 
          ? { ...block, score: newScore, lastUpdated: now }
          : block
      )
    );
  };

  const value: SafetyData = {
    blocks,
    updateBlockSafety,
  };

  return (
    <SafetyContext.Provider value={value}>
      {children}
    </SafetyContext.Provider>
  );
}; 