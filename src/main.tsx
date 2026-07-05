import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import {
  Camera,
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Download,
  Gift,
  Heart,
  ImagePlus,
  Images,
  LayoutGrid,
  ListTree,
  LoaderCircle,
  Lock,
  LogOut,
  MapPin,
  Music2,
  Pause,
  Plus,
  Send,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Unlock,
  UploadCloud,
  Volume2,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  addDays,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
  parseISO,
  setYear,
} from 'date-fns';
import type { MotionValue } from 'framer-motion';
import { supabase } from './supabaseClient';
import {
  addComment,
  loadRomanceData,
  profileFromSession,
  saveProfile,
  toggleReaction,
  uploadMemoryFile,
} from './romanceApi';
import { ReactionRow } from './ReactionRow';
import { MemoryPhotoViewer } from './MemoryPhotoViewer';
import type {
  LoveLetter,
  Milestone,
  Profile,
  ReactionKind,
  SpecialDate,
  ThemeName,
  ViewName,
} from './types';
import './styles.css';

const anniversary = new Date('2026-05-15T20:00:00+05:30');
const fallbackImage =
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=85';
const moodOptions = ['funny', 'soft', 'chaotic', 'first time', 'miss you'];
const profileColors = ['#e9517d', '#5bbfa5', '#f2a94a', '#6979d9', '#a65d9f'];

type PartnerId = 'deva' | 'aadi';

const partners: { id: PartnerId; name: string; color: string; email: string; authSecret: string }[] = [
  {
    id: 'deva',
    name: 'Deva',
    color: '#e9517d',
    email: import.meta.env.VITE_PARTNER_DEVA_EMAIL || '',
    authSecret: import.meta.env.VITE_PARTNER_DEVA_AUTH_SECRET || '',
  },
  {
    id: 'aadi',
    name: 'Aadi',
    color: '#5bbfa5',
    email: import.meta.env.VITE_PARTNER_AADI_EMAIL || '',
    authSecret: import.meta.env.VITE_PARTNER_AADI_AUTH_SECRET || '',
  },
];

type TriviaQuestion = {
  id: 'firstDate' | 'firstKiss' | 'anniversary';
  prompt: string;
  answer: string;
};

const triviaQuestions: TriviaQuestion[] = [
  { id: 'firstDate', prompt: 'When was our first date?', answer: import.meta.env.VITE_TRIVIA_FIRST_DATE || '' },
  { id: 'firstKiss', prompt: 'When did we first kiss?', answer: import.meta.env.VITE_TRIVIA_FIRST_KISS || '' },
  { id: 'anniversary', prompt: "What's our anniversary?", answer: import.meta.env.VITE_TRIVIA_ANNIVERSARY || '' },
];

const roastPool: string[] = [
  "Nice try, {name}, but our love story doesn't work that way.",
  "Wrong! Did you forget already, {name}? Rude.",
  "{name}, that's adorable, but also completely incorrect.",
  "Nope. Try harder, {name} — this is important history here.",
  "Close, {name}... if 'close' meant 'not even in the same year.'",
  "That's someone else's memory, {name}. Try ours.",
  "{name}, I'm judging you a little bit right now.",
  "Wrong date, {name}. Maybe write it down next time?",
  "Not quite, {name} — and yes, this is going in the relationship archives.",
  "{name}, that guess was bold. Boldly wrong, but bold.",
  "Access denied, {name}. Sentimental value insufficient.",
  "Try again, {name}. Our memories deserve better guesses than that.",
];

function pickRandomQuestion(excludeId?: TriviaQuestion['id']): TriviaQuestion {
  const candidates = excludeId ? triviaQuestions.filter((q) => q.id !== excludeId) : triviaQuestions;
  const pool = candidates.length > 0 ? candidates : triviaQuestions;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRoastLine(name: string): string {
  const line = roastPool[Math.floor(Math.random() * roastPool.length)];
  return line.replace(/\{name\}/g, name);
}

type DraftMemory = {
  date: string;
  title: string;
  description: string;
  addedBy: string;
  photos: File[];
  voice: File | null;
  moods: string[];
  locationName: string;
  latitude: string;
  longitude: string;
  songUrl: string;
  unlockPhrase: string;
  unlockAt: string;
};

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function elapsedParts(now: Date) {
  const total = Math.max(0, Math.floor((now.getTime() - anniversary.getTime()) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function readableError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const data = error as { message?: string; details?: string; hint?: string; code?: string };
    return [data.message, data.details, data.hint, data.code && `Code: ${data.code}`]
      .filter(Boolean)
      .join(' ');
  }
  return fallback;
}

function shouldRetryBasicMilestone(error: unknown) {
  const message = readableError(error, '').toLowerCase();
  return (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('mood_tags') ||
    message.includes('voice_path') ||
    message.includes('unlock_phrase') ||
    message.includes('location_name') ||
    message.includes('song_url')
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <CenteredLoader />;
  if (!session) return <AuthScreen />;
  return <RomanceApp session={session} />;
}

function RomanceApp({ session }: { session: Session }) {
  const now = useNow();
  const elapsed = elapsedParts(now);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [letters, setLetters] = useState<LoveLetter[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [profile, setProfile] = useState<Profile>(() => profileFromSession(session));
  const [view, setView] = useState<ViewName>('timeline');
  const [theme, setTheme] = useState<ThemeName>(
    () => (localStorage.getItem('romance.theme') as ThemeName) || 'blush',
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [musicOn, setMusicOn] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const firstLoad = useRef(true);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start center', 'end center'],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 24 });
  const lineHeight = useTransform(progress, [0, 1], ['0%', '100%']);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await loadRomanceData();
      setMilestones(data.milestones);
      setLetters(data.letters);
      setSpecialDates(data.specialDates);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load your shared space.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('romance-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, (payload) => {
        refresh(true);
        if (!firstLoad.current && payload.eventType === 'INSERT') {
          setToast('A new memory just arrived');
          setBurst((value) => value + 1);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestone_media' }, () =>
        refresh(true),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () =>
        refresh(true),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () =>
        refresh(true),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_letters' }, () =>
        refresh(true),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_dates' }, () =>
        refresh(true),
      )
      .subscribe();
    firstLoad.current = false;
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('romance.theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (musicOn) audioRef.current.play().catch(() => setMusicOn(false));
    else audioRef.current.pause();
  }, [musicOn]);

  useMotionValueEvent(progress, 'change', (latest) => {
    if (latest > 0.98) setBurst((value) => value + 1);
  });

  const sorted = useMemo(
    () => [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [milestones],
  );
  const favorites = sorted.filter((item) => item.isFavorite);
  const thisDay = sorted.filter((item) => {
    const date = parseISO(item.date);
    return date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
  });
  const playlist = sorted.map((item) => item.songUrl).filter(Boolean);
  const nextEvents = useMemo(() => buildCountdowns(specialDates, now), [specialDates, now]);
  const isSpecialDay =
    isSameDay(now, anniversary) ||
    specialDates.some((event) => {
      const date = parseISO(event.eventDate);
      return event.recurringYearly
        ? date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
        : isSameDay(date, now);
    });
  const views: ViewName[] = ['timeline', 'calendar', 'polaroids', 'letters'];

  function switchView(nextView: ViewName) {
    setView(nextView);
    setTabIndex(views.indexOf(nextView));
  }

  async function addMemory(draft: DraftMemory) {
    setStatus('Saving your memory...');
    try {
      const photoPaths = await Promise.all(
        draft.photos.map((file) => uploadMemoryFile(session.user.id, file, 'photos')),
      );
      const voicePath = draft.voice
        ? await uploadMemoryFile(session.user.id, draft.voice, 'voice')
        : null;
      const firstPath = photoPaths[0] || null;
      let imageUrl = fallbackImage;
      if (firstPath) {
        const { data } = supabase.storage.from('photos').getPublicUrl(firstPath);
        imageUrl = data.publicUrl;
      }

      const richPayload = {
        user_id: session.user.id,
        date: draft.date,
        title: draft.title.trim(),
        description: draft.description.trim(),
        image_url: imageUrl,
        photo_path: firstPath,
        added_by: draft.addedBy.trim() || profile.name,
        mood_tags: draft.moods,
        location_name: draft.locationName.trim() || null,
        latitude: draft.latitude ? Number(draft.latitude) : null,
        longitude: draft.longitude ? Number(draft.longitude) : null,
        song_url: draft.songUrl.trim() || null,
        voice_path: voicePath,
        unlock_phrase: draft.unlockPhrase.trim() || null,
        unlock_at: draft.unlockAt ? new Date(draft.unlockAt).toISOString() : null,
      };

      let insertResult = await supabase
        .from('milestones')
        .insert(richPayload)
        .select('id')
        .single();

      if (insertResult.error && shouldRetryBasicMilestone(insertResult.error)) {
        insertResult = await supabase
          .from('milestones')
          .insert({
            date: richPayload.date,
            title: richPayload.title,
            description: richPayload.description,
            image_url: richPayload.image_url,
            photo_path: richPayload.photo_path,
            added_by: richPayload.added_by,
          })
          .select('id')
          .single();
      }

      const { data, error } = insertResult;
      if (error) throw error;

      let mediaFailure = '';
      if (photoPaths.length) {
        const { error: mediaError } = await supabase.from('milestone_media').insert(
          photoPaths.map((path, index) => ({
            milestone_id: data.id,
            storage_path: path,
            media_type: 'image',
            sort_order: index,
          })),
        );
        if (mediaError) {
          console.error('milestone_media insert failed', mediaError);
          mediaFailure = readableError(
            mediaError,
            'Run supabase-romance-upgrade.sql.',
          );
        }
      }

      setAddOpen(false);
      setBurst((value) => value + 1);
      if (mediaFailure && photoPaths.length > 1) {
        setStatus(
          `Only the cover photo was saved — the other ${photoPaths.length - 1} photo(s) could not be linked: ${mediaFailure}`,
        );
      } else if (mediaFailure) {
        setStatus(`Memory saved, but the album table is not ready yet: ${mediaFailure}`);
      } else {
        setStatus('');
        setToast('Memory added to your story');
      }
      await refresh(true);
    } catch (error) {
      setStatus(readableError(error, 'Could not add memory.'));
    }
  }

  async function deleteMemory(item: Milestone) {
    if (!window.confirm(`Remove "${item.title}" and its uploaded files?`)) return;
    setStatus('Removing memory...');
    try {
      const paths = new Set(
        [
          item.photoPath,
          item.voicePath,
          ...item.media.map((media) => media.storagePath),
        ].filter(Boolean) as string[],
      );
      if (paths.size) {
        const { error: fileError } = await supabase.storage.from('photos').remove([...paths]);
        if (fileError) throw fileError;
      }
      const { error } = await supabase.from('milestones').delete().eq('id', item.id);
      if (error) throw error;
      setMilestones((items) => items.filter((candidate) => candidate.id !== item.id));
      setToast('Memory removed');
      setStatus('');
    } catch (error) {
      setStatus(readableError(error, 'Could not remove memory.'));
    }
  }

  async function deletePhoto(item: Milestone, mediaId: string, storagePath: string) {
    if (!window.confirm('Remove this photo from the album?')) return;
    try {
      const { error: storageError } = await supabase.storage.from('photos').remove([storagePath]);
      if (storageError) throw storageError;
      const { error: mediaError } = await supabase
        .from('milestone_media')
        .delete()
        .eq('id', mediaId);
      if (mediaError) throw mediaError;
      if (item.photoPath === storagePath) {
        const { error: legacyError } = await supabase
          .from('milestones')
          .update({ photo_path: null, image_url: fallbackImage })
          .eq('id', item.id);
        if (legacyError) throw legacyError;
      }
      setToast('Photo removed from the album');
      await refresh(true);
    } catch (error) {
      setStatus(readableError(error, 'Could not remove photo.'));
    }
  }

  async function toggleFavorite(item: Milestone) {
    const { error } = await supabase
      .from('milestones')
      .update({ is_favorite: !item.isFavorite })
      .eq('id', item.id);
    if (error) setStatus(error.message);
    else refresh(true);
  }

  async function react(item: Milestone, kind: ReactionKind) {
    const active = item.reactions.some(
      (reaction) => reaction.userId === session.user.id && reaction.reaction === kind,
    );
    try {
      await toggleReaction(item.id, session.user.id, kind, active);
      await refresh(true);
    } catch (error) {
      setStatus(readableError(error, 'Could not save reaction.'));
    }
  }

  async function comment(item: Milestone, body: string) {
    try {
      await addComment(item.id, session.user.id, profile, body);
      await refresh(true);
    } catch (error) {
      setStatus(readableError(error, 'Could not add reply.'));
    }
  }

  async function updateProfile(next: Profile) {
    try {
      await saveProfile(next);
      setProfile(next);
      setSettingsOpen(false);
      setToast('Your profile has a new glow');
    } catch (error) {
      setStatus(readableError(error, 'Could not update profile.'));
    }
  }

  async function addLetter(input: { title: string; body: string; unlockAt: string }) {
    const { error } = await supabase.from('love_letters').insert({
      title: input.title.trim(),
      body: input.body.trim(),
      unlock_at: input.unlockAt ? new Date(input.unlockAt).toISOString() : null,
      created_by: session.user.id,
    });
    if (error) setStatus(error.message);
    else {
      setLetterOpen(false);
      setToast('Letter tucked safely away');
      refresh(true);
    }
  }

  async function addSpecialDate(input: {
    title: string;
    eventDate: string;
    kind: string;
    recurring: boolean;
  }) {
    const { error } = await supabase.from('special_dates').insert({
      title: input.title.trim(),
      event_date: input.eventDate,
      kind: input.kind,
      recurring_yearly: input.recurring,
      created_by: session.user.id,
    });
    if (error) setStatus(error.message);
    else {
      setToast('Countdown added');
      refresh(true);
    }
  }

  return (
    <main className={`app-shell theme-${theme}`}>
      <FloatingHearts keySeed={burst} celebration={isSpecialDay} />
      <AnimatePresence>
        {toast && (
          <motion.div
            className="live-toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Sparkles size={17} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {playlist[0] && <audio ref={audioRef} src={playlist[0]} loop preload="none" />}

      <header className="topbar">
        <button className="profile-chip" onClick={() => setSettingsOpen(true)}>
          <span style={{ background: profile.color }}>{profile.name.slice(0, 1).toUpperCase()}</span>
          {profile.name}
        </button>
        <nav className="view-tabs" aria-label="Views" style={{ '--active-tab': tabIndex } as React.CSSProperties}>
          <span className="tab-indicator" aria-hidden="true" />
          <ViewButton active={view === 'timeline'} label="Timeline" onClick={() => switchView('timeline')}>
            <ListTree size={18} />
          </ViewButton>
          <ViewButton active={view === 'calendar'} label="Calendar" onClick={() => switchView('calendar')}>
            <CalendarDays size={18} />
          </ViewButton>
          <ViewButton active={view === 'polaroids'} label="Wall" onClick={() => switchView('polaroids')}>
            <LayoutGrid size={18} />
          </ViewButton>
          <ViewButton active={view === 'letters'} label="Letters" onClick={() => switchView('letters')}>
            <Gift size={18} />
          </ViewButton>
        </nav>
        <div className="top-actions">
          {playlist[0] && (
            <button className="icon-button dark" onClick={() => setMusicOn((value) => !value)} title="Music mode">
              {musicOn ? <Pause size={18} /> : <Music2 size={18} />}
            </button>
          )}
          <button className="icon-button dark" onClick={() => window.print()} title="Export keepsake">
            <Download size={18} />
          </button>
          <button className="icon-button dark" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings2 size={18} />
          </button>
          <button className="icon-button dark" onClick={() => supabase.auth.signOut()} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-media" aria-hidden="true" />
        <div className="hero-content">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Our story, live and still unfolding
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            Our Little Timeline
          </motion.h1>
          <div className="counter">
            <TimePill value={elapsed.days} label="days" />
            <TimePill value={elapsed.hours} label="hours" />
            <TimePill value={elapsed.minutes} label="mins" />
            <TimePill value={elapsed.seconds} label="secs" pulse />
          </div>
        </div>
      </section>

      <AnimatePresence>
        {status && (
          <motion.div
            className="status-pill"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>

      <CountdownBand dates={nextEvents} onAdd={addSpecialDate} />

      {thisDay.length > 0 && (
        <motion.section
          className="feature-band"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.3, once: false }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div>
            <span className="section-kicker">This day again</span>
            <h2>A memory found its way back</h2>
          </div>
          <MiniMemory item={thisDay[0]} />
        </motion.section>
      )}

      {favorites.length > 0 && (
        <motion.section
          className="favorites-band"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.3, once: false }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">Pinned close</span>
              <h2>Favorite memories</h2>
            </div>
            <Star fill="currentColor" />
          </div>
          <div className="favorites-row">
            {favorites.slice(0, 4).map((item, index) => (
              <MiniMemory key={item.id} item={item} index={index} />
            ))}
          </div>
        </motion.section>
      )}

      {loading ? (
        <CenteredLoader compact />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="view-motion-shell"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {view === 'timeline' && (
              <TimelineView
                items={sorted}
                session={session}
                lineHeight={lineHeight}
                lineProgress={progress}
                timelineRef={timelineRef}
                onDelete={deleteMemory}
                onDeletePhoto={deletePhoto}
                onFavorite={toggleFavorite}
                onReact={react}
                onComment={comment}
              />
            )}
            {view === 'calendar' && <CalendarView items={sorted} />}
            {view === 'polaroids' && <PolaroidWall items={sorted} />}
            {view === 'letters' && (
              <LettersView letters={letters} onAdd={() => setLetterOpen(true)} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <motion.button
        className="fab"
        whileHover={{ scale: 1.08, rotate: -4 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setAddOpen(true)}
        aria-label="Add a memory"
      >
        <Plus size={24} />
      </motion.button>

      <AnimatePresence>
        {addOpen && (
          <MemoryComposer
            profile={profile}
            onClose={() => setAddOpen(false)}
            onSubmit={addMemory}
          />
        )}
        {settingsOpen && (
          <SettingsPanel
            profile={profile}
            theme={theme}
            onTheme={setTheme}
            onSave={updateProfile}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {letterOpen && (
          <LetterComposer onClose={() => setLetterOpen(false)} onSubmit={addLetter} />
        )}
      </AnimatePresence>
    </main>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}

function TimePill({ value, label, pulse = false }: { value: number; label: string; pulse?: boolean }) {
  return (
    <motion.div
      className="time-pill"
      animate={pulse ? { scale: [1, 1.04, 1] } : undefined}
      transition={pulse ? { duration: 1, repeat: Infinity } : undefined}
    >
      <span>{String(value).padStart(2, '0')}</span>
      <small>{label}</small>
    </motion.div>
  );
}

function TimelineView({
  items,
  session,
  lineHeight,
  lineProgress,
  timelineRef,
  onDelete,
  onDeletePhoto,
  onFavorite,
  onReact,
  onComment,
}: {
  items: Milestone[];
  session: Session;
  lineHeight: MotionValue<string>;
  lineProgress: MotionValue<number>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  onDelete: (item: Milestone) => void;
  onDeletePhoto: (item: Milestone, mediaId: string, storagePath: string) => void;
  onFavorite: (item: Milestone) => void;
  onReact: (item: Milestone, kind: ReactionKind) => void;
  onComment: (item: Milestone, body: string) => void;
}) {
  const [selected, setSelected] = useState<Milestone | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const viewerItem = viewerId ? items.find((candidate) => candidate.id === viewerId) ?? null : null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [passedIds, setPassedIds] = useState<Set<string>>(() => new Set());
  const [stringRipple, setStringRipple] = useState(false);
  const [swayBoost, setSwayBoost] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const passedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (prefersReducedMotion) return;
    let frame = 0;
    let boostTimer = 0;

    function measure() {
      frame = 0;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-memory-id]'));
      const center = window.innerHeight / 2;
      let nextActive: string | null = null;
      let closest = Number.POSITIVE_INFINITY;
      const nextPassed = new Set<string>();

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const id = card.dataset.memoryId || null;
        if (!id) return;
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < closest) {
          closest = distance;
          nextActive = id;
        }
        if (rect.bottom < 0) nextPassed.add(id);
      });

      setActiveId((current) => (current === nextActive ? current : nextActive));

      const prevPassed = passedIdsRef.current;
      let changed = prevPassed.size !== nextPassed.size;
      if (!changed) {
        for (const id of nextPassed) {
          if (!prevPassed.has(id)) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        passedIdsRef.current = nextPassed;
        setPassedIds(nextPassed);
      }
    }

    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(measure);
      setSwayBoost(true);
      window.clearTimeout(boostTimer);
      boostTimer = window.setTimeout(() => setSwayBoost(false), 600);
    }

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(boostTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items, prefersReducedMotion]);

  function triggerStringRipple() {
    if (prefersReducedMotion) return;
    setStringRipple(false);
    window.requestAnimationFrame(() => {
      setStringRipple(true);
      window.setTimeout(() => setStringRipple(false), 440);
    });
  }

  function openItem(item: Milestone) {
    const imageCount = item.media.filter((media) => media.mediaType === 'image').length;
    if (imageCount > 1) setViewerId(item.id);
    else setSelected(item);
  }

  return (
    <section className="polaroid-timeline-section" ref={timelineRef}>
      <div
        className={`twine-track ${stringRipple ? 'string-ripple' : ''} ${swayBoost ? 'sway-boost' : ''}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 1200" preserveAspectRatio="none">
          <line className="twine-base" x1="12" y1="0" x2="12" y2="1200" />
          <motion.line
            className="twine-draw"
            x1="12"
            y1="0"
            x2="12"
            y2="1200"
            style={{ pathLength: lineProgress }}
          />
        </svg>
        <motion.div className="heart-progress" style={{ top: lineHeight }}>
          <Heart size={18} fill="currentColor" />
        </motion.div>
      </div>
      <div className="polaroid-intro">
        <span className="section-kicker">Pinned to the string</span>
        <h2>Couple Memories Timeline</h2>
        <p>Scroll down and each Polaroid drops into place like it was clipped there by hand.</p>
      </div>
      {items.length ? (
        items.map((item, index) => (
          <TimelineCard
            key={item.id}
            item={item}
            isEven={index % 2 === 0}
            userId={session.user.id}
            isActive={activeId === item.id}
            isPassed={passedIds.has(item.id)}
            onDelete={() => onDelete(item)}
            onDeletePhoto={(mediaId, storagePath) => onDeletePhoto(item, mediaId, storagePath)}
            onFavorite={() => onFavorite(item)}
            onReact={(kind) => onReact(item, kind)}
            onComment={(body) => onComment(item, body)}
            onOpen={() => openItem(item)}
            onLanded={triggerStringRipple}
          />
        ))
      ) : (
        <div className="empty-polaroid-line">
          <div className="empty-polaroid">
            <Heart size={28} fill="currentColor" />
            <strong>Add your first shared memory.</strong>
            <span>The string is waiting for its first photo.</span>
          </div>
        </div>
      )}
      <AnimatePresence>
        {selected && (
          <MemoryLightbox
            item={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewerItem && (
          <MemoryPhotoViewer
            item={viewerItem}
            userId={session.user.id}
            onClose={() => setViewerId(null)}
            onReact={(kind) => onReact(viewerItem, kind)}
            onDeletePhoto={(mediaId, storagePath) => onDeletePhoto(viewerItem, mediaId, storagePath)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function TimelineCard({
  item,
  isEven,
  userId,
  isActive,
  isPassed,
  onDelete,
  onDeletePhoto,
  onFavorite,
  onReact,
  onComment,
  onOpen,
  onLanded,
}: {
  item: Milestone;
  isEven: boolean;
  userId: string;
  isActive: boolean;
  isPassed: boolean;
  onDelete: () => void;
  onDeletePhoto: (mediaId: string, storagePath: string) => void;
  onFavorite: () => void;
  onReact: (kind: ReactionKind) => void;
  onComment: (body: string) => void;
  onOpen: () => void;
  onLanded: () => void;
}) {
  const [reply, setReply] = useState('');
  const [phrase, setPhrase] = useState('');
  const [unlocked, setUnlocked] = useState(!item.unlockPhrase);
  const [landed, setLanded] = useState(false);
  const [exiting, setExiting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const tiltFrame = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const images = item.media.filter((media) => media.mediaType === 'image');
  const isStack = images.length > 1;
  const singleImage = images.length ? images[0].signedUrl : item.imageUrl;
  const timeLocked = item.unlockAt ? new Date(item.unlockAt) > new Date() : false;
  const hidden = timeLocked || (!unlocked && !!item.unlockPhrase);

  function tryUnlock() {
    if (phrase.trim().toLowerCase() === item.unlockPhrase.toLowerCase()) setUnlocked(true);
  }

  const restRotation = isEven ? -3 : 4;

  function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (prefersReducedMotion) {
      onDelete();
      return;
    }
    setExiting(true);
    window.setTimeout(onDelete, 450);
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    if (tiltFrame.current) window.cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = window.requestAnimationFrame(() => {
      cardRef.current?.style.setProperty('--tilt-x', `${(-y * 8).toFixed(2)}deg`);
      cardRef.current?.style.setProperty('--tilt-y', `${(x * 10).toFixed(2)}deg`);
    });
  }

  function resetTilt() {
    if (tiltFrame.current) window.cancelAnimationFrame(tiltFrame.current);
    cardRef.current?.style.setProperty('--tilt-x', '0deg');
    cardRef.current?.style.setProperty('--tilt-y', '0deg');
  }

  return (
    <motion.article
      className={`pinned-memory ${isEven ? 'memory-left' : 'memory-right'} ${landed ? 'has-landed' : ''} ${isActive ? 'is-active' : ''} ${isPassed ? 'is-passed' : ''} ${exiting ? 'is-exiting' : ''}`}
      data-memory-id={item.id}
      initial={{ opacity: 0, y: -80, rotate: isEven ? -8 : 8, scale: 0.92 }}
      whileInView={{ opacity: 1, y: 0, rotate: restRotation, scale: 1 }}
      viewport={{ amount: 0.36, once: false }}
      transition={{ type: 'spring', stiffness: 130, damping: 11, bounce: 0.52 }}
      onViewportEnter={() => {
        setLanded(true);
        onLanded();
      }}
    >
      <motion.div
        className="peg"
        initial={{ scale: 0.75, y: -8, opacity: 0 }}
        whileInView={{ scale: [0.8, 1.16, 1], y: 0, opacity: 1 }}
        viewport={{ amount: 0.4, once: false }}
        transition={{ duration: 0.38, delay: 0.16 }}
      >
        <span />
      </motion.div>
      <div className="string-connector" aria-hidden="true" />

      <motion.div
        ref={cardRef}
        className="polaroid-card"
        layoutId={`memory-card-${item.id}`}
        whileHover={{ scale: 1.03, rotate: restRotation * 0.65, y: -4 }}
        whileTap={{ scale: 0.96, rotate: restRotation * 0.3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        onClick={onOpen}
        onMouseMove={handleMouseMove}
        onMouseLeave={resetTilt}
      >
        <div className="polaroid-actions" onClick={(event) => event.stopPropagation()}>
          <button className="delete-photo" onClick={handleDelete} aria-label={`Remove ${item.title}`}>
            <Trash2 size={17} />
          </button>
          <button
            className={`favorite-photo ${item.isFavorite ? 'active' : ''}`}
            onClick={onFavorite}
            aria-label="Pin favorite"
          >
            <Star size={17} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="polaroid-image">
          {hidden ? (
            <div className="secret-memory">
              <Lock size={30} />
              <strong>{timeLocked ? 'A future memory' : 'A tiny secret'}</strong>
              {timeLocked ? (
                <span>Opens {format(new Date(item.unlockAt!), 'MMM d, yyyy')}</span>
              ) : (
                <div className="secret-input" onClick={(event) => event.stopPropagation()}>
                  <input
                    value={phrase}
                    onChange={(event) => setPhrase(event.target.value)}
                    placeholder="Secret phrase"
                  />
                  <button onClick={tryUnlock} aria-label="Unlock memory">
                    <Unlock size={17} />
                  </button>
                </div>
              )}
            </div>
          ) : isStack ? (
            <PhotoStack
              images={images.map((media) => media.signedUrl)}
              alt={item.title}
              count={images.length}
              date={format(parseISO(item.date), 'MMM d')}
              place={item.locationName}
            />
          ) : (
            <img src={singleImage} alt={item.title} loading="lazy" />
          )}
        </div>
        <div className="polaroid-caption">
          <span>{format(parseISO(item.date), 'MMM d, yyyy')}</span>
          <strong>{item.title}</strong>
        </div>
      </motion.div>

      <div className="memory-details">
        <p>{item.description}</p>
        {item.moodTags.length > 0 && (
          <div className="mood-row">
            {item.moodTags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
        {item.locationName && (
          <span className="location-line">
            <MapPin size={15} />
            {item.locationName}
          </span>
        )}
        {item.voiceUrl && (
          <audio className="voice-note" controls preload="none" src={item.voiceUrl}>
          </audio>
        )}
        {item.songUrl && (
          <a className="song-link" href={item.songUrl} target="_blank" rel="noreferrer">
            <Music2 size={15} />
            Our song for this moment
          </a>
        )}
        <span className="added-by">Added by {item.addedBy}</span>

        <ReactionRow reactions={item.reactions} userId={userId} onReact={onReact} />

        <div className="comments">
          {item.comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <span style={{ background: comment.authorColor }}>
                {comment.authorName.slice(0, 1).toUpperCase()}
              </span>
              <p><strong>{comment.authorName}</strong>{comment.body}</p>
            </div>
          ))}
          <form
            className="reply-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!reply.trim()) return;
              onComment(reply);
              setReply('');
            }}
          >
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Leave a tiny reply"
            />
            <button type="submit" aria-label="Send reply">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </motion.article>
  );
}

function PhotoStack({
  images,
  alt,
  count,
  date,
  place,
}: {
  images: string[];
  alt: string;
  count: number;
  date: string;
  place: string;
}) {
  const layers = images.slice(0, 3);
  return (
    <div className="photo-stack">
      {layers.map((src, indexFromFront) => (
        <div
          key={src}
          className={`stack-layer depth-${indexFromFront}`}
          style={{ zIndex: layers.length - indexFromFront }}
        >
          <img src={src} alt={indexFromFront === 0 ? alt : ''} loading="lazy" />
        </div>
      ))}
      <span className="photo-count-badge">
        <Images size={13} />
        {count}
      </span>
      <div className="stack-overlay">
        <span className="stack-overlay-date">{date}</span>
        {place && (
          <span className="stack-overlay-place">
            <MapPin size={12} />
            {place}
          </span>
        )}
      </div>
    </div>
  );
}

function MemoryLightbox({ item, onClose }: { item: Milestone; onClose: () => void }) {
  const image = item.media.find((media) => media.mediaType === 'image')?.signedUrl || item.imageUrl;

  return (
    <motion.div
      className="lightbox-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.article
        className="lightbox-polaroid"
        layoutId={`memory-card-${item.id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="lightbox-close" onClick={onClose} aria-label="Close memory">
          <X size={22} />
        </button>
        <img src={image} alt={item.title} />
        <div className="lightbox-copy">
          <span>{format(parseISO(item.date), 'MMMM d, yyyy')}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          {item.moodTags.length > 0 && (
            <div className="mood-row">
              {item.moodTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
          {item.locationName && (
            <span className="location-line">
              <MapPin size={15} />
              {item.locationName}
            </span>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}

function CalendarView({ items }: { items: Milestone[] }) {
  const [month, setMonth] = useState(new Date());
  const days = Array.from({ length: getDaysInMonth(month) }, (_, index) => index + 1);
  const monthItems = items.filter((item) => isSameMonth(parseISO(item.date), month));

  return (
    <section className="alternate-view calendar-view">
      <div className="view-heading">
        <div>
          <span className="section-kicker">By the month</span>
          <h2>{format(month, 'MMMM yyyy')}</h2>
        </div>
        <div className="pager">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft />
          </button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const memories = monthItems.filter((item) => parseISO(item.date).getDate() === day);
          return (
            <div className={`calendar-day ${memories.length ? 'has-memory' : ''}`} key={day}>
              <strong>{day}</strong>
              {memories.slice(0, 2).map((item) => (
                <span key={item.id}>{item.title}</span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PolaroidWall({ items }: { items: Milestone[] }) {
  return (
    <section className="alternate-view">
      <div className="view-heading">
        <div>
          <span className="section-kicker">Move them around</span>
          <h2>Polaroid wall</h2>
        </div>
        <Images />
      </div>
      <div className="polaroid-wall">
        {items.map((item, index) => (
          <motion.figure
            key={item.id}
            drag
            dragConstraints={{ left: -80, right: 80, top: -60, bottom: 60 }}
            whileDrag={{ scale: 1.06, zIndex: 9 }}
            style={{ rotate: `${(index % 5) * 1.4 - 3}deg` }}
          >
            <img src={item.imageUrl} alt={item.title} />
            <figcaption>{item.title}</figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

function LettersView({
  letters,
  onAdd,
}: {
  letters: LoveLetter[];
  onAdd: () => void;
}) {
  const now = new Date();
  return (
    <section className="alternate-view">
      <div className="view-heading">
        <div>
          <span className="section-kicker">For another day</span>
          <h2>Love letter drawer</h2>
        </div>
        <button className="secondary-button" onClick={onAdd}>
          <Plus size={17} />
          New letter
        </button>
      </div>
      <div className="letter-grid">
        {letters.map((letter, index) => {
          const locked = letter.unlockAt ? new Date(letter.unlockAt) > now : false;
          return (
            <motion.article
              className={`letter ${locked ? 'locked' : ''}`}
              key={letter.id}
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ amount: 0.4, once: false }}
              transition={{ duration: 0.32, delay: index * 0.04, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {locked ? <Lock /> : <Heart fill="currentColor" />}
              <h3>{letter.title}</h3>
              {locked ? (
                <p>Opens {format(new Date(letter.unlockAt!), 'MMM d, yyyy, h:mm a')}</p>
              ) : (
                <p>{letter.body}</p>
              )}
            </motion.article>
          );
        })}
        {!letters.length && <EmptyState text="Write something for the future." />}
      </div>
    </section>
  );
}

function CountdownBand({
  dates,
  onAdd,
}: {
  dates: Array<SpecialDate & { daysAway: number; displayDate: Date }>;
  onAdd: (input: {
    title: string;
    eventDate: string;
    kind: string;
    recurring: boolean;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [kind, setKind] = useState('date');
  const [recurring, setRecurring] = useState(false);

  return (
    <section className="countdown-band">
      <div className="countdown-list">
        {dates.slice(0, 3).map((event) => (
          <div key={event.id}>
            <span>{event.daysAway}</span>
            <p><strong>days</strong>{event.title}</p>
          </div>
        ))}
        {!dates.length && <p className="quiet-copy">Add a birthday, trip, or next date.</p>}
      </div>
      <button className="secondary-button" onClick={() => setOpen((value) => !value)}>
        <CalendarHeart size={17} />
        Countdown
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            className="inline-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
            onSubmit={(event) => {
              event.preventDefault();
              onAdd({ title, eventDate, kind, recurring });
              setTitle('');
              setOpen(false);
            }}
          >
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Next adventure" />
            <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="date">Date</option>
              <option value="birthday">Birthday</option>
              <option value="trip">Trip</option>
              <option value="anniversary">Anniversary</option>
            </select>
            <label className="check-label">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              Yearly
            </label>
            <button type="submit"><Plus size={17} /></button>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  );
}

function MemoryComposer({
  profile,
  onClose,
  onSubmit,
}: {
  profile: Profile;
  onClose: () => void;
  onSubmit: (draft: DraftMemory) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftMemory>({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    addedBy: profile.name,
    photos: [],
    voice: null,
    moods: [],
    locationName: '',
    latitude: '',
    longitude: '',
    songUrl: '',
    unlockPhrase: '',
    unlockAt: '',
  });
  const [previews, setPreviews] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFanStack, setShowFanStack] = useState(false);
  const [poppedMood, setPoppedMood] = useState<string | null>(null);

  function choosePhotos(files: FileList | null) {
    const selected = Array.from(files || []).slice(0, 8);
    setDraft((current) => ({ ...current, photos: selected }));
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
    setShowFanStack(selected.length > 1);
    window.setTimeout(() => setShowFanStack(false), 2600);
  }

  function toggleMood(mood: string) {
    setDraft((current) => ({
      ...current,
      moods: current.moods.includes(mood)
        ? current.moods.filter((item) => item !== mood)
        : [...current.moods, mood],
    }));
    setPoppedMood(mood);
    window.setTimeout(() => setPoppedMood((current) => (current === mood ? null : current)), 260);
  }

  return (
    <Modal title="Add a memory" subtitle="A photo, a caption, and the little details." onClose={onClose}>
      <AnimatePresence>
        {showFanStack && (
          <motion.div className="upload-fan-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {previews.slice(0, 5).map((preview, index) => (
              <motion.div
                className="fan-thumb"
                key={preview}
                initial={{ scale: 0, y: 16, rotate: 0 }}
                animate={{
                  scale: 1,
                  y: 0,
                  x: (index - 2) * 10,
                  rotate: (index - 2) * 5,
                }}
                exit={{ scale: 0, y: -20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 190, damping: 14, delay: index * 0.08 }}
              >
                <svg viewBox="0 0 40 40" className="progress-ring" aria-hidden="true">
                  <circle cx="20" cy="20" r="17" />
                </svg>
                <img src={preview} alt="" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <form
        className="memory-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onSubmit(draft);
          setSubmitting(false);
        }}
      >
        <label className="upload-zone compact-upload">
          <input type="file" accept="image/*" multiple onChange={(e) => choosePhotos(e.target.files)} />
          {previews.length ? (
            <div className="preview-grid">
              {previews.map((preview) => <img src={preview} alt="" key={preview} />)}
            </div>
          ) : (
            <>
              <ImagePlus size={30} />
              <span>Choose up to 8 photos</span>
            </>
          )}
        </label>
        <div className="form-grid">
          <label><span>Date</span><input required type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
          <label><span>Added by</span><input value={draft.addedBy} onChange={(e) => setDraft({ ...draft, addedBy: e.target.value })} /></label>
        </div>
        <label><span>Title</span><input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Our first..." /></label>
        <label><span>Note</span><textarea required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="The detail you never want to lose." /></label>
        <div className="mood-picker">
          {moodOptions.map((mood) => (
            <button
              type="button"
              key={mood}
              className={`${draft.moods.includes(mood) ? 'active' : ''} ${poppedMood === mood ? 'pop' : ''}`}
              onClick={() => toggleMood(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
        <button className="text-button" type="button" onClick={() => setAdvanced((value) => !value)}>
          <Settings2 size={16} />
          {advanced ? 'Fewer details' : 'Add voice, place, song, or secret'}
        </button>
        <AnimatePresence initial={false}>
          {advanced && (
            <motion.div
              className="advanced-fields"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <label className="file-row">
                <span><Volume2 size={16} /> Voice note</span>
                <input type="file" accept="audio/*" capture onChange={(e) => setDraft({ ...draft, voice: e.target.files?.[0] || null })} />
              </label>
              <label><span>Song URL</span><input type="url" value={draft.songUrl} onChange={(e) => setDraft({ ...draft, songUrl: e.target.value })} placeholder="https://..." /></label>
              <label><span>Place</span><input value={draft.locationName} onChange={(e) => setDraft({ ...draft, locationName: e.target.value })} placeholder="Where it happened" /></label>
              <div className="form-grid">
                <label><span>Latitude</span><input type="number" step="any" value={draft.latitude} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })} /></label>
                <label><span>Longitude</span><input type="number" step="any" value={draft.longitude} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })} /></label>
              </div>
              <label><span>Secret phrase</span><input value={draft.unlockPhrase} onChange={(e) => setDraft({ ...draft, unlockPhrase: e.target.value })} placeholder="Optional phrase to reveal it" /></label>
              <label><span>Unlock later</span><input type="datetime-local" value={draft.unlockAt} onChange={(e) => setDraft({ ...draft, unlockAt: e.target.value })} /></label>
            </motion.div>
          )}
        </AnimatePresence>
        <button className="primary-button" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />}
          Add to our story
        </button>
      </form>
    </Modal>
  );
}

function SettingsPanel({
  profile,
  theme,
  onTheme,
  onSave,
  onClose,
}: {
  profile: Profile;
  theme: ThemeName;
  onTheme: (theme: ThemeName) => void;
  onSave: (profile: Profile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const themes: Array<{ id: ThemeName; label: string }> = [
    { id: 'blush', label: 'Blush' },
    { id: 'moonlight', label: 'Moonlight' },
    { id: 'golden-hour', label: 'Golden hour' },
    { id: 'rainy-day', label: 'Rainy day' },
  ];
  return (
    <Modal title="Your little corner" subtitle="A name, a color, and the mood of the timeline." onClose={onClose}>
      <form className="memory-form" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
        <label><span>Display name</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <div className="color-picker">
          {profileColors.map((color) => (
            <button type="button" key={color} className={draft.color === color ? 'active' : ''} style={{ background: color }} onClick={() => setDraft({ ...draft, color })} aria-label={`Use ${color}`} />
          ))}
        </div>
        <div className="theme-picker">
          {themes.map((option) => (
            <button type="button" key={option.id} className={theme === option.id ? 'active' : ''} onClick={() => onTheme(option.id)}>
              <span className={`theme-swatch ${option.id}`} />
              {option.label}
            </button>
          ))}
        </div>
        <button className="primary-button"><Sparkles size={18} />Save profile</button>
      </form>
    </Modal>
  );
}

function LetterComposer({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; body: string; unlockAt: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [unlockAt, setUnlockAt] = useState('');
  return (
    <Modal title="Tuck away a letter" subtitle="Let it open now, or save it for a future moment." onClose={onClose}>
      <form className="memory-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ title, body, unlockAt }); }}>
        <label><span>Title</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Open when..." /></label>
        <label><span>Letter</span><textarea required value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <label><span>Unlock date</span><input type="datetime-local" value={unlockAt} onChange={(e) => setUnlockAt(e.target.value)} /></label>
        <button className="primary-button"><Gift size={18} />Keep this letter</button>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside className="panel" initial={{ y: 34, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0 }}>
        <button className="icon-button close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="panel-heading">
          <Heart size={27} fill="currentColor" />
          <div><h2>{title}</h2><p>{subtitle}</p></div>
        </div>
        {children}
      </motion.aside>
    </motion.div>
  );
}

function MiniMemory({ item, index = 0 }: { item: Milestone; index?: number }) {
  return (
    <motion.article
      className="mini-memory"
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ amount: 0.4, once: false }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <img src={item.imageUrl} alt="" />
      <div><span>{format(parseISO(item.date), 'MMM d')}</span><strong>{item.title}</strong></div>
    </motion.article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><Heart size={23} fill="currentColor" />{text}</div>;
}

function CenteredLoader({ compact = false }: { compact?: boolean }) {
  return <main className={compact ? 'loading-block' : 'auth-page'}><LoaderCircle className="spin" size={34} /></main>;
}

function AuthScreen() {
  const [selectedPartner, setSelectedPartner] = useState<PartnerId | null>(null);
  const [answerDate, setAnswerDate] = useState('');
  const [activeQuestion, setActiveQuestion] = useState<TriviaQuestion>(() => pickRandomQuestion());
  const [message, setMessage] = useState('');
  const [leadMessage, setLeadMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(0);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [brokenAvatars, setBrokenAvatars] = useState<Set<PartnerId>>(() => new Set());
  const [uploadingId, setUploadingId] = useState<PartnerId | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const prefersReducedMotion = useReducedMotion();
  const partner = partners.find((candidate) => candidate.id === selectedPartner) ?? null;

  function triggerShake() {
    setShake(false);
    window.requestAnimationFrame(() => {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
    });
  }

  function choosePartner(id: PartnerId) {
    setSelectedPartner(id);
    setBurst((value) => value + 1);
    setActiveQuestion(pickRandomQuestion());
    setAnswerDate('');
    setMessage('');
    setLeadMessage('');
  }

  function goBack() {
    setSelectedPartner(null);
    setAnswerDate('');
    setMessage('');
    setLeadMessage('');
  }

  function avatarUrl(id: PartnerId) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(id);
    return `${data.publicUrl}?v=${avatarVersion}`;
  }

  async function handleAvatarUpload(id: PartnerId, file: File | undefined) {
    if (!file) return;
    setUploadingId(id);
    setAvatarError('');
    const { error } = await supabase.storage.from('avatars').upload(id, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type,
    });
    setUploadingId(null);
    if (error) {
      setAvatarError(`Could not upload photo: ${error.message}`);
      return;
    }
    setBrokenAvatars((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setAvatarVersion((value) => value + 1);
  }

  return (
    <main className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <FloatingHearts keySeed={burst} celebration={false} />
        <AnimatePresence mode="wait">
          {!partner ? (
            <motion.div
              key="picker"
              className="auth-step-picker"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="auth-mark"><Lock size={32} /></div>
              <p className="eyebrow auth-eyebrow">Private timeline</p>
              <h1>Our Little Timeline</h1>
              <p className="auth-prompt">Who's stealing a peek?</p>
              <div className="partner-picker">
                {partners.map((candidate) => (
                  <motion.div
                    key={candidate.id}
                    className="partner-card"
                    style={{ '--partner-color': candidate.color } as React.CSSProperties}
                    role="button"
                    tabIndex={0}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -4 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    onClick={() => choosePartner(candidate.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        choosePartner(candidate.id);
                      }
                    }}
                  >
                    <div className="partner-avatar">
                      {brokenAvatars.has(candidate.id) ? (
                        <span className="partner-card-icon"><Heart size={22} fill="currentColor" /></span>
                      ) : (
                        <img
                          className="partner-avatar-img"
                          src={avatarUrl(candidate.id)}
                          alt={candidate.name}
                          onError={() =>
                            setBrokenAvatars((current) => new Set(current).add(candidate.id))
                          }
                        />
                      )}
                      <label
                        className="avatar-upload-button"
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Upload a photo for ${candidate.name}`}
                      >
                        {uploadingId === candidate.id ? (
                          <LoaderCircle className="spin" size={14} />
                        ) : (
                          <Camera size={14} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => handleAvatarUpload(candidate.id, event.target.files?.[0])}
                        />
                      </label>
                    </div>
                    <span className="partner-card-name">{candidate.name}</span>
                  </motion.div>
                ))}
              </div>
              {avatarError && <p className="form-message">{avatarError}</p>}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className={`partner-form ${shake ? 'auth-form-shake' : ''}`}
              style={{ '--partner-color': partner.color } as React.CSSProperties}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
              onSubmit={async (event) => {
                event.preventDefault();
                if (!partner.email) {
                  setLeadMessage('');
                  setMessage(
                    `No login email is configured for ${partner.name} yet (missing VITE_PARTNER_${partner.id.toUpperCase()}_EMAIL).`,
                  );
                  triggerShake();
                  return;
                }
                if (!activeQuestion.answer || !partner.authSecret) {
                  setLeadMessage('This one still needs setup —');
                  setMessage(
                    `This trivia question isn't fully wired up yet (missing the answer or ${partner.name}'s hidden password in the env vars). Ask whoever manages the .env file to fill it in.`,
                  );
                  triggerShake();
                  return;
                }
                if (answerDate !== activeQuestion.answer) {
                  setMessage('');
                  setLeadMessage(pickRoastLine(partner.name));
                  setActiveQuestion((current) => pickRandomQuestion(current.id));
                  setAnswerDate('');
                  triggerShake();
                  return;
                }
                setLoading(true);
                const { error } = await supabase.auth.signInWithPassword({
                  email: partner.email,
                  password: partner.authSecret,
                });
                setLoading(false);
                if (error) {
                  setLeadMessage('One more snag —');
                  setMessage(error.message);
                  triggerShake();
                } else {
                  setLeadMessage('');
                  setMessage('');
                }
              }}
            >
              <button type="button" className="auth-step-back" onClick={goBack}>
                <ChevronLeft size={16} /> not you?
              </button>
              <div className="auth-mark"><CalendarHeart size={32} /></div>
              <p className="eyebrow auth-eyebrow">Private timeline</p>
              <h1 className="auth-greeting">Hey, {partner.name}</h1>
              <label>
                <span>{activeQuestion.prompt}</span>
                <input
                  required
                  type="date"
                  value={answerDate}
                  onChange={(e) => setAnswerDate(e.target.value)}
                />
              </label>
              {(leadMessage || message) && (
                <p className="form-message">
                  {leadMessage && <span className="form-message-lead">{leadMessage}</span>}
                  {message}
                </p>
              )}
              <button className="primary-button" disabled={loading}>
                {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                Sign in
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

function FloatingHearts({ keySeed, celebration }: { keySeed: number; celebration: boolean }) {
  const count = celebration ? 22 : 9;
  return (
    <div className="floating-hearts" aria-hidden="true">
      <AnimatePresence>
        {Array.from({ length: count }).map((_, index) => (
          <motion.span
            key={`${keySeed}-${index}`}
            initial={{ opacity: 0, y: 30, scale: 0.4, x: 0 }}
            animate={{
              opacity: [0, 0.9, 0],
              y: -170 - index * 5,
              x: Math.sin(index) * 110,
              scale: [0.4, 1, 0.7],
            }}
            transition={{ duration: 2.5, delay: index * 0.04 }}
          >
            {index % 3 === 0 ? '✦' : '♥'}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function buildCountdowns(dates: SpecialDate[], now: Date) {
  let monthlyDate = new Date(now.getFullYear(), now.getMonth(), anniversary.getDate());
  if (monthlyDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    monthlyDate = new Date(now.getFullYear(), now.getMonth() + 1, anniversary.getDate());
  }
  let yearlyDate = new Date(
    now.getFullYear(),
    anniversary.getMonth(),
    anniversary.getDate(),
  );
  if (yearlyDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    yearlyDate = new Date(
      now.getFullYear() + 1,
      anniversary.getMonth(),
      anniversary.getDate(),
    );
  }
  const automaticDates: SpecialDate[] = [
    {
      id: 'automatic-monthly-anniversary',
      title: 'Our monthly anniversary',
      eventDate: format(monthlyDate, 'yyyy-MM-dd'),
      kind: 'anniversary',
      recurringYearly: false,
    },
    {
      id: 'automatic-yearly-anniversary',
      title: 'Our anniversary',
      eventDate: format(yearlyDate, 'yyyy-MM-dd'),
      kind: 'anniversary',
      recurringYearly: false,
    },
  ];

  return [...automaticDates, ...dates]
    .map((event) => {
      let displayDate = parseISO(event.eventDate);
      if (event.recurringYearly) {
        displayDate = setYear(displayDate, now.getFullYear());
        if (displayDate < now) displayDate = setYear(displayDate, now.getFullYear() + 1);
      }
      return {
        ...event,
        displayDate,
        daysAway: Math.max(0, differenceInCalendarDays(displayDate, now)),
      };
    })
    .filter((event) => event.displayDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => a.daysAway - b.daysAway);
}

createRoot(document.getElementById('root')!).render(<App />);
