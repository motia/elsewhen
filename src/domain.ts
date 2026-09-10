export type Activity = { title: string; time?: string; place?: string; cost?: string; category?: string; tags?: string[]; desc?: string; score?: number; sourceUrl?: string; img?: string };
export type Plan = { id: string; title: string; theme: string; summary: string; score: number; events: Activity[]; savedId?: string; date?: string; location?: string; savedAt?: string };
export type Preferences = Record<'focus' | 'movement' | 'novelty' | 'connection', { want: number; capacity: number }>;

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const localDate = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export const isDate = (value: string | null | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()));

const events: Activity[] = [
  { title: 'Board Game Social at Maven Café', img: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80', time: '7:00 – 9:00 PM', place: 'Maven Café · 0.8 mi', cost: '$10–20', category: 'games', tags: ['Connection', 'Low-key', 'Indoor'], desc: 'A relaxed evening of modern board games. Great for meeting new people or coming with friends.', score: 92 },
  { title: 'Sunset Run Club', img: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=500&q=80', time: '4:00 – 5:30 PM', place: 'Riverside Park · 1.2 mi', cost: 'Free', category: 'sports', tags: ['Movement', 'Outdoors', 'Social'], desc: 'A friendly, all-levels running group with a scenic route and good views.', score: 88 },
  { title: 'Friday Night at the Modern Art Museum', img: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=500&q=80', time: '7:00 – 10:00 PM', place: 'City Art Museum · 2.1 mi', cost: '$15', category: 'arts_culture', tags: ['Novelty', 'Low-key', 'Indoor'], desc: 'Explore new exhibits, with live music and extended hours every Friday.', score: 81 }
];

export const defaultPlans: Plan[] = [
  { id: 'curated-1', title: 'Easy Social Evening', theme: 'Connection', summary: 'A warm, low-pressure way to be around people without overloading the evening.', score: 92, events: [events[0]] },
  { id: 'curated-2', title: 'Move & Reset', theme: 'Movement', summary: 'Fresh air and an energy lift, with plenty of room to wind down afterward.', score: 88, events: [events[1]] },
  { id: 'curated-3', title: 'A Little Wonder', theme: 'Novelty', summary: 'A calm cultural outing for an evening that feels different from the usual.', score: 81, events: [events[2]] }
];
