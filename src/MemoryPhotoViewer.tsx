import React, { useEffect, useRef, useState } from 'react';
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
  const [dragging, setDragging] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const [popped, setPopped] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const startX = useRef(0);

  function goTo(next: number) {
    setIndex(clamp(next, 0, photos.length - 1));
  }

  useEffect(() => {
    if (photos.length <= 1) onClose();
    else if (index > photos.length - 1) setIndex(photos.length - 1);
  }, [photos.length]);

  useEffect(() => {
    setDetailsVisible(false);
    const timer = window.setTimeout(() => setDetailsVisible(true), 440);
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

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    startX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragPx(event.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    const threshold = window.innerWidth * 0.12;
    if (dragPx <= -threshold) goTo(index + 1);
    else if (dragPx >= threshold) goTo(index - 1);
    setDragging(false);
    setDragPx(0);
  }

  const dragOffsetVw = dragging ? (dragPx / window.innerWidth) * 100 : 0;
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

        <div
          className="viewer-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="viewer-track"
            style={{
              transform: `translateX(calc(${-index * 88}vw + ${dragOffsetVw}vw))`,
              transition: dragging ? 'none' : 'transform 320ms cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          >
            {photos.map((photo, i) => {
              const distance = clamp(i - index - dragOffsetVw / 88, -1, 1);
              const dist = Math.abs(distance);
              const scale = 1 - dist * 0.12;
              const brightness = 1 - dist * 0.35;
              const blur = dist * 2;
              return (
                <div
                  key={photo.id}
                  className={`viewer-slide ${i === index ? 'is-current' : ''}`}
                  style={{
                    transform: `scale(${scale})`,
                    filter: `brightness(${brightness}) blur(${blur}px)`,
                    transition: dragging
                      ? 'none'
                      : 'transform 320ms cubic-bezier(0.25, 1, 0.5, 1), filter 320ms cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                  onClick={() => {
                    if (i !== index) goTo(i);
                  }}
                >
                  <img src={photo.signedUrl} alt={item.title} draggable={false} />
                </div>
              );
            })}
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
          <span className="viewer-added-by">Added by {item.addedBy}</span>
          <ReactionRow reactions={item.reactions} userId={userId} onReact={onReact} />
        </div>
      </motion.div>
    </motion.div>
  );
}
