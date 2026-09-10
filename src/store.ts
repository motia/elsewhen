import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clone, defaultPlans, isDate, localDate, type Plan, type Preferences } from './domain';

type DayShaperState = {
  date: string;
  location: string;
  cities: string[];
  apiReady: boolean;
  plans: Plan[];
  selectedPlan: Plan;
  savedPlans: Plan[];
  preferences: Preferences;
  resultMode: 'loading' | 'options' | 'customize';
  setDate: (date: string) => void;
  setLocation: (location: string) => void;
  setCities: (cities: string[]) => void;
  setApiReady: (ready: boolean) => void;
  setPlans: (plans: Plan[]) => void;
  setSelectedPlan: (plan: Plan) => void;
  setSavedPlans: (plans: Plan[]) => void;
  setPreferences: (preferences: Preferences) => void;
  setResultMode: (mode: DayShaperState['resultMode']) => void;
};

const initialDate = localDate();
const stampPlan = (plan: Plan, date: string): Plan => ({ ...clone(plan), events: plan.events.map((event) => ({ ...event, time: `${new Intl.DateTimeFormat(navigator.language || 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T12:00:00`))} · ${event.time || 'Time flexible'}` })) });

export const useDayShaperStore = create<DayShaperState>()(persist((set) => ({
  date: initialDate,
  location: 'Ho Chi Minh City',
  cities: ['Ho Chi Minh City', 'Da Nang'],
  apiReady: false,
  plans: defaultPlans.map((plan) => stampPlan(plan, initialDate)),
  selectedPlan: clone(defaultPlans[0]),
  savedPlans: [],
  preferences: { focus: { want: 25, capacity: 72 }, movement: { want: 67, capacity: 76 }, novelty: { want: 23, capacity: 27 }, connection: { want: 68, capacity: 28 } },
  resultMode: 'options',
  setDate: (date) => { if (isDate(date)) set({ date }); },
  setLocation: (location) => set({ location }),
  setCities: (cities) => set({ cities }),
  setApiReady: (apiReady) => set({ apiReady }),
  setPlans: (plans) => set({ plans }),
  setSelectedPlan: (selectedPlan) => set({ selectedPlan }),
  setSavedPlans: (savedPlans) => set({ savedPlans }),
  setPreferences: (preferences) => set({ preferences }),
  setResultMode: (resultMode) => set({ resultMode })
}), {
  name: 'elsewhen-planning-state',
  partialize: ({ cities: _cities, apiReady: _apiReady, ...state }) => state
}));
