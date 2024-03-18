type Band = {
  display_name: string;
};

type BandEvent = {
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
};
