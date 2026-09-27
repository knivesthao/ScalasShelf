import { newId, type QuizItem } from '@/lib/format';

interface QuizTabProps {
  quiz: QuizItem[];
  onChange: (quiz: QuizItem[]) => void;
}

export function QuizTab({ quiz, onChange }: QuizTabProps) {
  function updateItem(id: string, fields: Partial<QuizItem>) {
    onChange(quiz.map((q) => (q.id === id ? { ...q, ...fields } : q)));
  }

  function setOption(item: QuizItem, index: number, value: string) {
    updateItem(item.id, { options: item.options.map((o, i) => (i === index ? value : o)) });
  }

  function removeOption(item: QuizItem, index: number) {
    const options = item.options.filter((_, i) => i !== index);
    const answer = item.answer === index ? 0 : item.answer > index ? item.answer - 1 : item.answer;
    updateItem(item.id, { options, answer });
  }

  function addQuestion() {
    onChange([...quiz, { id: newId('q'), type: 'meaning', prompt: '', options: ['', ''], answer: 0 }]);
  }

  return (
    <div className="quiz-tab">
      <h2>End-of-episode check</h2>
      <p className="hint">3–5 quick questions after the last scene, to check readers understood the story.</p>

      {quiz.map((item, i) => (
        <fieldset key={item.id} className="quiz-card">
          <legend>
            Question {i + 1} · {item.type === 'meaning' ? 'What does it mean?' : 'Fill the blank'}
          </legend>
          <label className="inspector-field">
            {item.type === 'meaning' ? 'Word' : 'Sentence (use ____ for the blank)'}
            <input lang="en" value={item.prompt} onChange={(e) => updateItem(item.id, { prompt: e.target.value })} />
          </label>
          {item.options.map((opt, j) => (
            <div key={j} className="quiz-option">
              <input
                type="radio"
                name={`answer-${item.id}`}
                checked={item.answer === j}
                onChange={() => updateItem(item.id, { answer: j })}
                aria-label={`Option ${j + 1} is correct`}
              />
              <input lang="en" value={opt} onChange={(e) => setOption(item, j, e.target.value)} aria-label={`Option ${j + 1}`} />
              {item.options.length > 2 && (
                <button className="icon-btn" onClick={() => removeOption(item, j)} aria-label={`Remove option ${j + 1}`}>✕</button>
              )}
            </div>
          ))}
          <div className="inspector-row">
            {item.options.length < 4 && (
              <button className="ghost-btn" onClick={() => updateItem(item.id, { options: [...item.options, ''] })}>
                + Option
              </button>
            )}
            <button className="ghost-btn ghost-btn--danger" onClick={() => onChange(quiz.filter((q) => q.id !== item.id))}>
              Delete question
            </button>
          </div>
        </fieldset>
      ))}
      <button className="ghost-btn" onClick={addQuestion}>+ Add question</button>
    </div>
  );
}
