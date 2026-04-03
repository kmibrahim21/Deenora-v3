import React, { createContext, useContext, ReactNode } from 'react';
import { Institution } from '../../types';

interface ResultEngineContextType {
  engine: 'school' | 'befaq' | 'qawmi_custom';
  config: Institution['config_json'];
}

const ResultEngineContext = createContext<ResultEngineContextType>({ 
  engine: 'school',
  config: {
    modules: {
      attendance: true,
      results: true,
      admit_card: true,
      seat_plan: true,
      accounting: true
    },
    result_engine: 'school',
    result_system: 'grading',
    attendance_type: 'daily',
    fee_structure: 'monthly',
    ui_mode: 'madrasah'
  }
});

export const ResultEngineProvider = ({ institution, children }: { institution: Institution, children: ReactNode }) => {
  const engine = institution.config_json.result_engine || 'school';
  const config = institution.config_json;
  
  return (
    <ResultEngineContext.Provider value={{ engine, config }}>
      {children}
    </ResultEngineContext.Provider>
  );
};

export const useResultEngine = () => useContext(ResultEngineContext);
