import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { ReactionRow } from './ReactionRow';
import type { Milestone, ReactionKind } from './types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const SLIDE_SIZE = 220;
const ROTATION_STEP = 12;
const VERTICAL_STEP = 44;
const INACTIVE_SCALE = 0.72;
const CAROUSEL_TRANSITION: Transition = { type: 'spring', bounce: 0.16, duration: 0.85 };

export function MemoryPhotoViewer({
  item,
  userId,
  onClose,
  onReact,
  onDeletePhoto,
}: {
  item: Milestone;
  userId: string;
  onClose: () => void;
  onReact: (kind: ReactionKind) => void;
  onDeletePhoto: (mediaId: string, storagePath: string) => void;
}) {
  const photos = item.media.filter((media) => media.mediaType === 'image');
  const [index, setIndex] = useState(0);
  const [popped, setPopped] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const carouselTransition: Transition = prefersReducedMotion ? { duration: 0 } : CAROUSEL_TRANSITION;

  function goTo(next: number) {
    setIndex(clamp(next, 0, photos.length - 1));
  }

  useEffect(() => {
    if (photos.length <= 1) onClose();
    else if (index > photos.length - 1) setIndex(photos.length - 1);
  }, [photos.length]);

  useEffect(() => {
    setDetailsVisible(false);
    const timer = window.setTimeout(() => setDetailsVisible(true), 120);
    return () => window.clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    setPopped(true);
    const timer = window.setTimeout(() => setPopped(false), 260);
    return () => window.clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') goTo(index - 1);
      else if (event.key === 'ArrowRight') goTo(index + 1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, photos.length]);

  const currentPhoto = photos[index];

  if (!currentPhoto) return null;

  const isPreviousDisabled = index === 0;
  const isNextDisabled = index === photos.length - 1;

  return (
    <motion.div
      className="photo-viewer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.22 } }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className="photo-viewer-panel"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.22 } }}
        transition={{ duration: 0.25 }}
      >
        <button className="lightbox-close viewer-close" onClick={onClose} aria-label="Close photos">
          <X size={22} />
        </button>
        <button
          className="delete-photo viewer-delete"
          onClick={() => onDeletePhoto(currentPhoto.id, currentPhoto.storagePath)}
          aria-label="Remove this photo"
        >
          <Trash2 size={17} />
        </button>

        <div
          className="viewer-viewport"
          role="region"
          aria-roledescription="carousel"
          aria-label={`${item.title} photos`}
        >
          <motion.div
            className="viewer-track"
            animate={{ x: -(index * SLIDE_SIZE + SLIDE_SIZE / 2) }}
            transition={carouselTransition}
          >
            {photos.map((photo, i) => {
              const isActive = i === index;
              const distance = i - index;
              return (
                <motion.button
                  type="button"
                  key={photo.id}
                  className={`viewer-slide ${isActive ? 'is-current' : ''}`}
                  style={{ width: SLIDE_SIZE }}
                  animate={{
                    rotate: prefersReducedMotion ? 0 : distance * ROTATION_STEP,
                    scale: isActive ? 1 : INACTIVE_SCALE,
                    y: prefersReducedMotion ? 0 : distance * VERTICAL_STEP,
                  }}
                  transition={carouselTransition}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    if (!isActive) goTo(i);
                  }}
                >
                  <img src={photo.signedUrl} alt={item.title} draggable={false} />
                </motion.button>
              );
            })}
          </motion.div>
        </div>

        <div className="viewer-controls">
          <button
            type="button"
            className="viewer-nav"
            disabled={isPreviousDisabled}
            onClick={() => goTo(index - 1)}
            aria-label="Show previous photo"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="viewer-dots">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                className={`viewer-dot ${i === index ? 'active' : ''} ${i === index && popped ? 'popped' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            className="viewer-nav"
            disabled={isNextDisabled}
            onClick={() => goTo(index + 1)}
            aria-label="Show next photo"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className={`viewer-details ${detailsVisible ? 'is-visible' : ''}`}>
          <span className="viewer-date">{format(parseISO(item.date), 'MMMM d, yyyy')}</span>
          <h3>{item.title}</h3>
          {item.description && <p className="viewer-caption">{item.description}</p>}
          <span className="viewer-added-by">Added by {item.addedBy}</span>
          <ReactionRow reactions={item.reactions} userId={userId} onReact={onReact} />
        </div>
      </motion.div>
    </motion.div>
  );
}
