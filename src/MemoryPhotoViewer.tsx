import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Trash2, X } from 'lucide-react';
import { ReactionRow } from './ReactionRow';
import type { Milestone, ReactionKind } from './types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafId = useRef(0);
  const indexRef = useRef(0);

  function goTo(next: number) {
    const clamped = clamp(next, 0, photos.length - 1);
    slideRefs.current[clamped]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
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

  const updateSlideStyles = useCallback(() => {
    rafId.current = 0;
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + trackRect.width / 2;
    let closestIndex = indexRef.current;
    let closestDistance = Infinity;

    slideRefs.current.forEach((slide, i) => {
      if (!slide) return;
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.left + rect.width / 2;
      const rawDistance = (slideCenter - center) / (rect.width / 2);
      const distance = clamp(rawDistance, -1, 1);
      const abs = Math.abs(distance);
      const scale = 1 - abs * 0.12;
      const brightness = 1 - abs * 0.35;
      const blur = abs * 2;
      slide.style.transform = `scale(${scale})`;
      slide.style.filter = `brightness(${brightness}) blur(${blur}px)`;
      const centerDistance = Math.abs(slideCenter - center);
      if (centerDistance < closestDistance) {
        closestDistance = centerDistance;
        closestIndex = i;
      }
    });

    if (closestIndex !== indexRef.current) {
      indexRef.current = closestIndex;
      setIndex(closestIndex);
    }
  }, []);

  function onTrackScroll() {
    if (!rafId.current) rafId.current = window.requestAnimationFrame(updateSlideStyles);
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.currentTarget.scrollBy({ left: event.deltaY });
  }

  useEffect(() => {
    updateSlideStyles();
    window.addEventListener('resize', updateSlideStyles);
    return () => window.removeEventListener('resize', updateSlideStyles);
  }, [updateSlideStyles]);

  const currentPhoto = photos[index];

  if (!currentPhoto) return null;

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

        <div className="viewer-viewport">
          <div className="viewer-track" ref={trackRef} onScroll={onTrackScroll} onWheel={onWheel}>
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                className={`viewer-slide ${i === index ? 'is-current' : ''}`}
                onClick={() => {
                  if (i !== index) goTo(i);
                }}
              >
                <img src={photo.signedUrl} alt={item.title} draggable={false} />
              </div>
            ))}
          </div>
        </div>

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
