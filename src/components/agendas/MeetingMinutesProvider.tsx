
import React, { createContext, useContext, useState } from 'react';
import { Institution } from '../../types';

type EngineType = 'school' | 'befaq' | 'qawmi_custom';

interface MeetingMinutesContextType {
    engine: EngineType;
    setEngine: (engine: EngineType) => void;
}

const MeetingMinutesContext = createContext<MeetingMinutesContextType | undefined>(undefined);

export const MeetingMinutesProvider: React.FC<{ children: React.ReactNode; institution: Institution }> = ({ children, institution }) => {
    const [engine, setEngine] = useState<EngineType>(() => {
        return (institution?.config_json?.meeting_engine as EngineType) || 'school';
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
