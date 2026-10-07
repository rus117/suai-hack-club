export type Track = 'ml' | 'vibe' | 'all';
export type Resource = { title: string; url: string; language: 'RU' | 'EN'; format: string; task: string };
export type Material = {
  slug: string; track: Track; title: string; hours: [number, number]; description: string;
  prerequisite: string; outcome: string;
  sections: { title: string; paragraphs: string[]; code?: string; source?: { title: string; url: string } }[];
  practice: { title: string; steps: string[]; done: string[]; stretch: string };
  questions: { question: string; answer: string }[];
  resources: Resource[];
};
export const hoursLabel = (hours: [number, number]) => `${hours[0]}–${hours[1]} ч`;
