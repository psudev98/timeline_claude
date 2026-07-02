import { useState } from 'react';
import type { ReactNode } from 'react';
import { Heart, Laugh, Sparkles, Star } from 'lucide-react';
import type { Reaction, ReactionKind } from './types';

export const reactionOptions: Array<{ kind: ReactionKind; label: string; icon: ReactNode }> = [
  { kind: 'heart', label: 'Heart', icon: <Heart size={16} /> },
  { kind: 'sparkle', label: 'Sparkle', icon: <Sparkles size={16} /> },
  { kind: 'smile', label: 'Made me smile', icon: <Laugh size={16} /> },
  { kind: 'favorite', label: 'Favorite', icon: <Star size={16} /> },
];

export function ReactionRow({
  reactions,
  userId,
  onReact,
}: {
  reactions: Reaction[];
  userId: string;
  onReact: (kind: ReactionKind) => void;
}) {
  const [reactionBurst, setReactionBurst] = useState<ReactionKind | null>(null);

  function reactWithBurst(kind: ReactionKind) {
    setReactionBurst(kind);
    window.setTimeout(() => setReactionBurst(null), 700);
    onReact(kind);
  }

  return (
    <div className="reaction-row">
      {reactionOptions.map((option) => {
        const active = reactions.some(
          (reaction) => reaction.userId === userId && reaction.reaction === option.kind,
        );
        const count = reactions.filter((reaction) => reaction.reaction === option.kind).length;
        return (
          <button
            key={option.kind}
            className={`${active ? 'active' : ''} ${reactionBurst === option.kind ? `burst-${option.kind}` : ''}`}
            onClick={() => reactWithBurst(option.kind)}
            title={option.label}
          >
            {option.icon}
            {count > 0 && <span>{count}</span>}
            {reactionBurst === option.kind && (
              <span className={`reaction-particles particles-${option.kind}`}>
                {Array.from({ length: option.kind === 'heart' ? 5 : 6 }).map((_, index) => (
                  <i key={index} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
