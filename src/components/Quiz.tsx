import { useState } from 'react';
import type { QuizItem } from '@/lib/format';

interface QuizProps {
  items: QuizItem[];
  onFinish?: (score: number, total: number) => void;
}

/** The end-of-episode check: one question at a time, with instant feedback. */
export function Quiz({ items, onFinish }: QuizProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!items.length) return null;

  if (done) {
    return (
      <div className="quiz quiz--done" role="status">
        <p className="quiz-score">{score} / {items.length}</p>
        <p>{score === items.length ? 'Perfect! Great reading.' : score >= items.length / 2 ? 'Good job! Read again to learn the rest.' : 'Keep practicing. Read the story again and try once more.'}</p>
        <button className="ghost-btn" onClick={() => { setIndex(0); setPicked(null); setScore(0); setDone(false); }}>Try again</button>
      </div>
    );
  }

  const item = items[index];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === item.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setPicked(null);
    } else {
      setDone(true);
      onFinish?.(score, items.length);
    }
  }

  return (
    <div className="quiz">
      <p className="quiz-progress">Question {index + 1} of {items.length}</p>
      <p className="quiz-prompt" lang="en">
        {item.type === 'meaning' ? <>What does <strong>“{item.prompt}”</strong> mean?</> : item.prompt}
      </p>
      <div className="quiz-options">
        {item.options.map((opt, i) => {
          const state = !answered ? '' : i === item.answer ? ' is-correct' : i === picked ? ' is-wrong' : '';
          return (
            <button key={i} className={`quiz-option-btn${state}`} onClick={() => choose(i)} disabled={answered && i !== picked && i !== item.answer} lang="en">
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="quiz-feedback">
          <span>{picked === item.answer ? '✓ Correct!' : `The answer is “${item.options[item.answer]}”.`}</span>
          <button className="buy-btn" onClick={next}>{index + 1 < items.length ? 'Next' : 'See score'}</button>
        </div>
      )}
    </div>
  );
}
