export type HackEvent = {
  id: 'start' | 'vibe'; number: string; title: string; eyebrow: string;
  date: string; day: string; month: string; deadline: string; deadlineLabel: string;
  description: string; tags: string[]; hasChallenge: boolean; steps: string[]; detail: string;
  open?: boolean;
};
export type Session = { csrf: string; admin: boolean; viaAccount?: boolean };
export type Leaderboard = { final: boolean; entries: { rank: number; name: string; score: number; submittedAt: string; attempts: number }[] };
export type Registration = {
  id: string; eventId: string; fullName: string; telegram: string; displayName: string;
  teamMode: string; teamName: string; experience: string; status: string; createdAt: string;
  submissions: number; publicScore: number | null; reportUrl: string | null;
};
