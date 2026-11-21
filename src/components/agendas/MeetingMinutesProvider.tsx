
import React, { createContext, useContext, useState } from 'react';
import { Institution } from '../../types';

type EngineType = 'standard' | 'board' | 'general';

const normalizeEngine = (raw?: string | null): EngineType => {
    if (raw === 'board' || raw === 'befaq') return 'board';
    if (raw === 'general' || raw === 'qawmi_custom') return 'general';
    return 'standard';
};

interface MeetingMinutesContextType {
    engine: EngineType;
    setEngine: (engine: EngineType) => void;
}

const MeetingMinutesContext = createContext<MeetingMinutesContextType | undefined>(undefined);

export const MeetingMinutesProvider: React.FC<{ children: React.ReactNode; institution: Institution }> = ({ children, institution }) => {
    const [engine, setEngine] = useState<EngineType>(() => {
        return normalizeEngine(institution?.config_json?.meeting_engine);
    });

    return (
        <MeetingMinutesContext.Provider value={{ engine, setEngine }}>
            {children}
        </MeetingMinutesContext.Provider>
    );
};

export const useMeetingMinutesEngine = () => {
    const context = useContext(MeetingMinutesContext);
    if (!context) throw new Error('useMeetingMinutesEngine must be used within MeetingMinutesProvider');
    return context;
};
