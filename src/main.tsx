import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import {
  CalendarHeart,
  Heart,
  LoaderCircle,
  Lock,
  LogOut,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { supabase } from './supabaseClient';
import './styles.css';

type MilestoneRow = {
  id: string;
  date: string;
  title: string;
  description: string;
  image_url: string | null;
  photo_path: string | null;
  added_by: string;
  created_at?: string;
};

type Milestone = {
  id: string;
  date: string;
  title: string;
  description: string;
  imageUrl: string;
  photoPath: string | null;
  addedBy: string;
};

type DraftMilestone = {
  date: string;
  title: string;
  description: string;
  addedBy: string;
  photoFile: File | null;
};

const anniversary = new Date('2026-05-15T20:00:00+05:30');
const fallbackImage =
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=85';

function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function getElapsedParts(now: Date) {
  const elapsed = Math.max(0, now.getTime() - anniversary.getTime());
  const totalSeconds = Math.floor(elapsed / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

async function resolveImageUrl(row: MilestoneRow) {
  if (row.photo_path) {
    const { data } = await supabase.storage.from('photos').createSignedUrl(row.photo_path, 60 * 60);
    if (data?.signedUrl) return data.signedUrl;
  }

  return row.image_url || fallbackImage;
}

async function mapMilestone(row: MilestoneRow): Promise<Milestone> {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    description: row.description,
    imageUrl: await resolveImageUrl(row),
    photoPath: row.photo_path,
    addedBy: row.added_by,
  };
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return <LoadingScreen />;
  if (!session) return <AuthScreen />;

  return <TimelineApp session={session} />;
}

function TimelineApp({ session }: { session: Session }) {
  const now = useNow();
  const elapsed = getElapsedParts(now);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [burst, setBurst] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start center', 'end center'],
  });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 24 });
  const lineHeight = useTransform(smoothProgress, [0, 1], ['0%', '100%']);

  async function loadMilestones() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('milestones')
      .select('id,date,title,description,image_url,photo_path,added_by,created_at')
      .order('date', { ascending: true });

    if (error) {
      setStatus(`Could not load memories: ${error.message}`);
      setIsLoading(false);
      return;
    }

    const mapped = await Promise.all((data || []).map((row) => mapMilestone(row as MilestoneRow)));
    setMilestones(mapped);
    setIsLoading(false);
  }

  useEffect(() => {
    loadMilestones();

    const channel = supabase
      .channel('milestones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, () => {
        loadMilestones();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useMotionValueEvent(smoothProgress, 'change', (latest) => {
    if (latest > 0.97) setBurst((value) => value + 1);
  });

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [milestones],
  );

  async function addMilestone(draft: DraftMilestone) {
    setStatus('Uploading memory...');

    try {
      let imageUrl = '';
      let photoPath: string | null = null;

      if (draft.photoFile) {
        const extension = draft.photoFile.name.split('.').pop() || 'jpg';
        const safeName = `${crypto.randomUUID()}.${extension.toLowerCase()}`;
        photoPath = `${session.user.id}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(photoPath, draft.photoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data } = await supabase.storage.from('photos').getPublicUrl(photoPath);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from('milestones').insert({
        date: draft.date,
        title: draft.title.trim(),
        description: draft.description.trim(),
        image_url: imageUrl || fallbackImage,
        photo_path: photoPath,
        added_by: draft.addedBy.trim() || session.user.email || 'Us',
      });

      if (error) throw error;

      setBurst((value) => value + 1);
      setIsPanelOpen(false);
      setStatus('Memory added.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not add memory.');
    }
  }

  async function deleteMilestone(item: Milestone) {
    const confirmed = window.confirm(`Remove "${item.title}" from the timeline?`);
    if (!confirmed) return;

    setStatus('Removing memory...');

    try {
      if (item.photoPath) {
        const { error: storageError } = await supabase.storage.from('photos').remove([item.photoPath]);
        if (storageError) throw storageError;
      }

      const { error } = await supabase.from('milestones').delete().eq('id', item.id);
      if (error) throw error;

      setMilestones((items) => items.filter((current) => current.id !== item.id));
      setStatus('Memory removed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not remove memory.');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <main>
      <FloatingHearts keySeed={burst} />
      <button className="sign-out" onClick={signOut}>
        <LogOut size={17} />
        Sign out
      </button>

      <section className="hero">
        <div className="hero-media" aria-hidden="true" />
        <div className="hero-content">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="eyebrow"
          >
            Our story, live and still unfolding
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
          >
            Our Little Timeline
          </motion.h1>
          <motion.div
            className="counter"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.18 }}
            aria-label="Time since the anniversary"
          >
            <TimePill value={elapsed.days} label="days" />
            <TimePill value={elapsed.hours} label="hours" />
            <TimePill value={elapsed.minutes} label="mins" />
            <TimePill value={elapsed.seconds} label="secs" pulse />
          </motion.div>
        </div>
      </section>

      {status && <div className="status-pill">{status}</div>}

      <section className="memory-strip" aria-label="Pinned memories">
        {sortedMilestones.slice(0, 4).map((item) => (
          <motion.img
            key={item.id}
            src={item.imageUrl}
            alt=""
            whileHover={{ y: -8, rotate: 0, scale: 1.04 }}
            loading="lazy"
          />
        ))}
      </section>

      <section className="timeline-section" ref={timelineRef}>
        <div className="timeline-line">
          <motion.div className="timeline-line-fill" style={{ height: lineHeight }} />
        </div>
        {isLoading ? (
          <div className="empty-state">
            <LoaderCircle className="spin" size={26} />
            Loading our memories...
          </div>
        ) : sortedMilestones.length ? (
          sortedMilestones.map((item, index) => (
            <TimelineCard
              key={item.id}
              item={item}
              isEven={index % 2 === 0}
              onDelete={() => deleteMilestone(item)}
            />
          ))
        ) : (
          <div className="empty-state">
            <Heart size={28} fill="currentColor" />
            Add your first shared memory.
          </div>
        )}
      </section>

      <motion.button
        className="fab"
        whileHover={{ scale: 1.08, rotate: -4 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsPanelOpen(true)}
        aria-label="Add a memory"
      >
        <Plus size={24} />
      </motion.button>

      <AnimatePresence>
        {isPanelOpen && (
          <ContributorPanel
            defaultName={session.user.email || ''}
            onClose={() => setIsPanelOpen(false)}
            onSubmit={addMilestone}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-page">
      <LoaderCircle className="spin" size={34} />
    </main>
  );
}

function AuthScreen() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email: userId.trim(),
      password,
    });

    setLoading(false);
    if (error) setMessage(error.message);
  }

  return (
    <main className="auth-page">
      <motion.form
        className="auth-card"
        onSubmit={signIn}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 130, damping: 18 }}
      >
        <div className="auth-mark">
          <Lock size={32} />
        </div>
        <p className="eyebrow auth-eyebrow">Private timeline</p>
        <h1>Our Little Timeline</h1>
        <label>
          <span>User ID</span>
          <input
            required
            type="email"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="your private password"
            autoComplete="current-password"
          />
        </label>
        {message && <p className="form-message">{message}</p>}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
          Sign in
        </button>
      </motion.form>
    </main>
  );
}

function TimePill({ value, label, pulse = false }: { value: number; label: string; pulse?: boolean }) {
  return (
    <motion.div
      className="time-pill"
      animate={pulse ? { scale: [1, 1.04, 1] } : undefined}
      transition={pulse ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <span>{String(value).padStart(2, '0')}</span>
      <small>{label}</small>
    </motion.div>
  );
}

function TimelineCard({
  item,
  isEven,
  onDelete,
}: {
  item: Milestone;
  isEven: boolean;
  onDelete: () => void;
}) {
  const rotate = isEven ? -1.6 : 1.6;

  return (
    <motion.article
      className={`timeline-card ${isEven ? 'left' : 'right'}`}
      initial={{ opacity: 0, x: isEven ? -70 : 70, y: 18, scale: 0.92 }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ amount: 0.26, once: false }}
      transition={{ type: 'spring', stiffness: 100, damping: 14, mass: 0.75 }}
    >
      <div className="node" aria-hidden="true">
        <Heart size={15} fill="currentColor" />
      </div>
      <motion.div className="photo-frame" whileHover={{ scale: 1.045, rotate: 0 }} style={{ rotate }}>
        <img src={item.imageUrl} alt={item.title} loading="lazy" />
        <button className="delete-photo" onClick={onDelete} aria-label={`Remove ${item.title}`}>
          <Trash2 size={18} />
        </button>
        <div className="tape tape-a" />
        <div className="tape tape-b" />
      </motion.div>
      <div className="card-copy">
        <span className="date-badge">
          <CalendarHeart size={16} />
          {format(parseISO(item.date), 'MMM d, yyyy')}
        </span>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        <span className="added-by">Added by {item.addedBy}</span>
      </div>
    </motion.article>
  );
}

function ContributorPanel({
  defaultName,
  onClose,
  onSubmit,
}: {
  defaultName: string;
  onClose: () => void;
  onSubmit: (draft: DraftMilestone) => void;
}) {
  const [draft, setDraft] = useState<DraftMilestone>({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    addedBy: defaultName,
    photoFile: null,
  });
  const [preview, setPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePhoto(file?: File) {
    if (!file) return;
    setDraft((current) => ({ ...current, photoFile: file }));

    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    await onSubmit(draft);
    setIsSubmitting(false);
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.aside
        className="panel"
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      >
        <button className="icon-button close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <form className="memory-form" onSubmit={submit}>
          <div className="panel-heading">
            <Heart size={28} fill="currentColor" />
            <div>
              <h2>Add a Memory</h2>
              <p>Uploads are saved to your shared Supabase timeline.</p>
            </div>
          </div>

          <label>
            <span>Date</span>
            <input
              required
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </label>
          <label>
            <span>Milestone title</span>
            <input
              required
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Our first..."
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              required
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Write the tiny detail you never want to lose."
            />
          </label>
          <label>
            <span>Added by</span>
            <input
              value={draft.addedBy}
              onChange={(event) => setDraft({ ...draft, addedBy: event.target.value })}
              placeholder="Your name"
            />
          </label>
          <label className="upload-zone">
            <input type="file" accept="image/*" onChange={(event) => handlePhoto(event.target.files?.[0])} />
            {preview ? (
              <img src={preview} alt="Selected memory preview" />
            ) : (
              <>
                <UploadCloud size={30} />
                <span>Choose a photo</span>
              </>
            )}
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
            Add memory
          </button>
        </form>
      </motion.aside>
    </motion.div>
  );
}

function FloatingHearts({ keySeed }: { keySeed: number }) {
  return (
    <div className="floating-hearts" aria-hidden="true">
      <AnimatePresence>
        {Array.from({ length: 9 }).map((_, index) => (
          <motion.span
            key={`${keySeed}-${index}`}
            initial={{ opacity: 0, y: 30, scale: 0.4, x: 0 }}
            animate={{
              opacity: [0, 0.9, 0],
              y: -170 - index * 6,
              x: Math.sin(index) * 80,
              scale: [0.4, 1, 0.7],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, delay: index * 0.05, ease: 'easeOut' }}
          >
            ♥
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
