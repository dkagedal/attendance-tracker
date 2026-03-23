export type Band = {
  display_name: string;
};

export type BandEvent = {
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
};
