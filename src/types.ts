export type ThemeName = 'blush' | 'moonlight' | 'golden-hour' | 'rainy-day';
export type ViewName = 'timeline' | 'calendar' | 'map' | 'polaroids' | 'letters';
export type ReactionKind = 'heart' | 'sparkle' | 'smile' | 'favorite';

export type Profile = {
  name: string;
  color: string;
};

export type MediaItem = {
  id: string;
  milestoneId: string;
  storagePath: string;
  mediaType: 'image' | 'audio';
  sortOrder: number;
  signedUrl: string;
};

export type Reaction = {
  id: string;
  milestoneId: string;
  userId: string;
  reaction: ReactionKind;
};

export type Comment = {
  id: string;
  milestoneId: string;
  userId: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: string;
};

export type Milestone = {
  id: string;
  userId: string | null;
  date: string;
  title: string;
  description: string;
  imageUrl: string;
  photoPath: string | null;
  addedBy: string;
  isFavorite: boolean;
  moodTags: string[];
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  songUrl: string;
  voicePath: string | null;
  voiceUrl: string;
  unlockPhrase: string;
  unlockAt: string | null;
  media: MediaItem[];
  reactions: Reaction[];
  comments: Comment[];
};

export type LoveLetter = {
  id: string;
  title: string;
  body: string;
  unlockAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type SpecialDate = {
  id: string;
  title: string;
  eventDate: string;
  kind: string;
  recurringYearly: boolean;
};
