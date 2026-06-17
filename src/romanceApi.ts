import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type {
  Comment,
  LoveLetter,
  MediaItem,
  Milestone,
  Profile,
  Reaction,
  ReactionKind,
  SpecialDate,
} from './types';

const fallbackImage =
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=85';

type MilestoneRow = {
  id: string;
  user_id: string | null;
  date: string;
  title: string;
  description: string;
  image_url: string | null;
  photo_path: string | null;
  added_by: string;
  is_favorite: boolean;
  mood_tags: string[] | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  song_url: string | null;
  voice_path: string | null;
  unlock_phrase: string | null;
  unlock_at: string | null;
};

async function signedUrl(path: string | null) {
  if (!path) return '';
  const { data } = await supabase.storage.from('photos').createSignedUrl(path, 60 * 60);
  return data?.signedUrl || '';
}

function isOptionalSetupError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const data = error as { message?: string; code?: string };
  const message = (data.message || '').toLowerCase();
  return data.code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

export function profileFromSession(session: Session): Profile {
  return {
    name:
      session.user.user_metadata.display_name ||
      session.user.email?.split('@')[0] ||
      'My love',
    color: session.user.user_metadata.profile_color || '#e9517d',
  };
}

export async function saveProfile(profile: Profile) {
  const { error } = await supabase.auth.updateUser({
    data: { display_name: profile.name, profile_color: profile.color },
  });
  if (error) throw error;
}

export async function uploadMemoryFile(userId: string, file: File, folder: string) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) {
    throw new Error(
      `Photo upload failed: ${error.message}. Check that the photos bucket exists and authenticated Storage insert/select policies are enabled.`,
    );
  }
  return path;
}

export async function loadRomanceData() {
  const [
    milestonesResult,
    mediaResult,
    reactionsResult,
    commentsResult,
    lettersResult,
    datesResult,
  ] = await Promise.all([
    supabase.from('milestones').select('*').order('date', { ascending: true }),
    supabase.from('milestone_media').select('*').order('sort_order'),
    supabase.from('reactions').select('*'),
    supabase.from('comments').select('*').order('created_at'),
    supabase.from('love_letters').select('*').order('created_at', { ascending: false }),
    supabase.from('special_dates').select('*').order('event_date'),
  ]);

  const firstError = [
    milestonesResult.error,
    mediaResult.error && !isOptionalSetupError(mediaResult.error) ? mediaResult.error : null,
    reactionsResult.error && !isOptionalSetupError(reactionsResult.error) ? reactionsResult.error : null,
    commentsResult.error && !isOptionalSetupError(commentsResult.error) ? commentsResult.error : null,
    lettersResult.error && !isOptionalSetupError(lettersResult.error) ? lettersResult.error : null,
    datesResult.error && !isOptionalSetupError(datesResult.error) ? datesResult.error : null,
  ].find(Boolean);
  if (firstError) throw firstError;

  const media: MediaItem[] = await Promise.all(
    (!mediaResult.error ? mediaResult.data || [] : []).map(async (row) => ({
      id: row.id,
      milestoneId: row.milestone_id,
      storagePath: row.storage_path,
      mediaType: row.media_type,
      sortOrder: row.sort_order,
      signedUrl: await signedUrl(row.storage_path),
    })),
  );

  const reactions: Reaction[] = (!reactionsResult.error ? reactionsResult.data || [] : []).map((row) => ({
    id: row.id,
    milestoneId: row.milestone_id,
    userId: row.user_id,
    reaction: row.reaction,
  }));

  const comments: Comment[] = (!commentsResult.error ? commentsResult.data || [] : []).map((row) => ({
    id: row.id,
    milestoneId: row.milestone_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorColor: row.author_color,
    body: row.body,
    createdAt: row.created_at,
  }));

  const milestones: Milestone[] = await Promise.all(
    ((milestonesResult.data || []) as MilestoneRow[]).map(async (row) => {
      const rowMedia = media.filter((item) => item.milestoneId === row.id);
      const legacyUrl = (await signedUrl(row.photo_path)) || row.image_url || fallbackImage;
      return {
        id: row.id,
        userId: row.user_id,
        date: row.date,
        title: row.title,
        description: row.description,
        imageUrl: rowMedia.find((item) => item.mediaType === 'image')?.signedUrl || legacyUrl,
        photoPath: row.photo_path,
        addedBy: row.added_by,
        isFavorite: row.is_favorite || false,
        moodTags: row.mood_tags || [],
        locationName: row.location_name || '',
        latitude: row.latitude,
        longitude: row.longitude,
        songUrl: row.song_url || '',
        voicePath: row.voice_path,
        voiceUrl: await signedUrl(row.voice_path),
        unlockPhrase: row.unlock_phrase || '',
        unlockAt: row.unlock_at,
        media: rowMedia,
        reactions: reactions.filter((item) => item.milestoneId === row.id),
        comments: comments.filter((item) => item.milestoneId === row.id),
      };
    }),
  );

  const letters: LoveLetter[] = (!lettersResult.error ? lettersResult.data || [] : []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    unlockAt: row.unlock_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));

  const specialDates: SpecialDate[] = (!datesResult.error ? datesResult.data || [] : []).map((row) => ({
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    kind: row.kind,
    recurringYearly: row.recurring_yearly,
  }));

  return { milestones, letters, specialDates };
}

export async function toggleReaction(
  milestoneId: string,
  userId: string,
  reaction: ReactionKind,
  active: boolean,
) {
  if (active) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('milestone_id', milestoneId)
      .eq('user_id', userId)
      .eq('reaction', reaction);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('reactions')
    .insert({ milestone_id: milestoneId, user_id: userId, reaction });
  if (error) throw error;
}

export async function addComment(
  milestoneId: string,
  userId: string,
  profile: Profile,
  body: string,
) {
  const { error } = await supabase.from('comments').insert({
    milestone_id: milestoneId,
    user_id: userId,
    author_name: profile.name,
    author_color: profile.color,
    body: body.trim(),
  });
  if (error) throw error;
}
