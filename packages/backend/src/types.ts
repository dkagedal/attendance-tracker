export type Section = {
  id: string;
  name: string;
  emoji: string;
};

export type Band = {
  display_name: string;
  logo?: string;
  timezone?: string;
  sections?: Section[];
};

export type MemberCalendar = {
  secret: string;
  createdAt: unknown;
};

export type Member = {
  display_name: string;
  admin: boolean;
  section_id?: string;
};

export type BandEvent = {
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
};
