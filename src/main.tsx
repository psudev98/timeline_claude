import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera,
  CalendarHeart,
  Heart,
  ImagePlus,
  Lock,
  Plus,
  Send,
  Sparkles,
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
import './styles.css';

type Milestone = {
  id: string;
  date: string;
  title: string;
  description: string;
  imageUrl: string;
  addedBy: string;
};

type DraftMilestone = Omit<Milestone, 'id'>;

const anniversary = new Date('2026-05-15T20:00:00+05:30');
const localKey = 'romance.timeline.milestones.v1';

const starterMilestones: Milestone[] = [
  {
    id: 'first-photo',
    date: '2026-05-15',
    title: 'The First Photo Together',
    description: "You laughed because I blinked, and somehow that made it perfect.",
    imageUrl:
      'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=85',
    addedBy: 'Sudev',
  },
  {
    id: 'ice-cream',
    date: '2026-05-21',
    title: 'Our First Ice Cream Date',
    description: 'Two spoons, one terrible joke, and a memory that kept glowing after sunset.',
    imageUrl:
      'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=1200&q=85',
    addedBy: 'Her',
  },
  {
    id: 'rain-walk',
    date: '2026-05-29',
    title: 'Rain Walk',
    description: 'The umbrella was too small, which turned out to be the best possible problem.',
    imageUrl:
      'https://images.unsplash.com/photo-1501901609772-df0848060b33?auto=format&fit=crop&w=1200&q=85',
    addedBy: 'Sudev',
  },
  {
    id: 'midnight-note',
    date: '2026-06-03',
    title: 'The Midnight Note',
    description: 'A tiny message at exactly the right minute. Saved, reread, treasured.',
    imageUrl:
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=85',
    addedBy: 'Her',
  },
];

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

function readLocalMilestones() {
  const saved = localStorage.getItem(localKey);
  if (!saved) return starterMilestones;

  try {
    return JSON.parse(saved) as Milestone[];
  } catch {
    return starterMilestones;
  }
}

function App() {
  const now = useNow();
  const elapsed = getElapsedParts(now);
  const [milestones, setMilestones] = useState<Milestone[]>(readLocalMilestones);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start center', 'end center'],
  });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 24 });
  const lineHeight = useTransform(smoothProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    localStorage.setItem(localKey, JSON.stringify(milestones));
  }, [milestones]);

  useMotionValueEvent(smoothProgress, 'change', (latest) => {
    if (latest > 0.97) setBurst((value) => value + 1);
  });

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [milestones],
  );

  function addMilestone(draft: DraftMilestone) {
    setMilestones((items) => [
      ...items,
      {
        ...draft,
        id: crypto.randomUUID(),
      },
    ]);
    setBurst((value) => value + 1);
    setIsPanelOpen(false);
  }

  return (
    <main>
      <FloatingHearts keySeed={burst} />
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
        {sortedMilestones.map((item, index) => (
          <TimelineCard key={item.id} item={item} isEven={index % 2 === 0} />
        ))}
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
            onClose={() => setIsPanelOpen(false)}
            onSubmit={addMilestone}
          />
        )}
      </AnimatePresence>
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

function TimelineCard({ item, isEven }: { item: Milestone; isEven: boolean }) {
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
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (draft: DraftMilestone) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState<DraftMilestone>({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    imageUrl: '',
    addedBy: '',
  });
  const [preview, setPreview] = useState('');

  function handlePhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setPreview(result);
      setDraft((current) => ({ ...current, imageUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      addedBy: draft.addedBy.trim() || 'Us',
      imageUrl:
        draft.imageUrl ||
        'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=85',
    });
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

        {!unlocked ? (
          <form
            className="unlock"
            onSubmit={(event) => {
              event.preventDefault();
              if (password.trim().length >= 3) setUnlocked(true);
            }}
          >
            <Lock size={34} />
            <h2>Private Memory Drop</h2>
            <label>
              <span>Secret phrase</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="anything sweet works"
                autoFocus
              />
            </label>
            <button className="primary-button" type="submit">
              <Sparkles size={18} />
              Unlock
            </button>
          </form>
        ) : (
          <form className="memory-form" onSubmit={submit}>
            <div className="panel-heading">
              <Heart size={28} fill="currentColor" />
              <div>
                <h2>Add a Memory</h2>
                <p>Saved instantly in this demo. Connect Firebase for shared live updates.</p>
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
                  <ImagePlus size={30} />
                  <span>Drop in a photo</span>
                </>
              )}
            </label>
            <button className="primary-button" type="submit">
              <Send size={18} />
              Add memory
            </button>
          </form>
        )}
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
