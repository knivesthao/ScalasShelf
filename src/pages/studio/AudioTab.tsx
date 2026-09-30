import { useState } from 'react';
import type { SceneDraft } from '@/lib/format';
import { deleteRecording, playableUrl, recordingSupported, saveRecording, useRecorder } from '@/lib/studioAudio';

interface AudioTabProps {
  projectId: string;
  draft: SceneDraft;
  onChange: (fn: (d: SceneDraft) => SceneDraft) => void;
}

export function AudioTab({ projectId, draft, onChange }: AudioTabProps) {
  const { recording, start, stop } = useRecorder();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorded = draft.bubbles.filter((b) => b.audio.en).length;

  function setAudio(bubbleId: string, ref: string | undefined) {
    onChange((d) => ({
      ...d,
      bubbles: d.bubbles.map((b) => (b.id === bubbleId ? { ...b, audio: { ...b.audio, en: ref } } : b)),
    }));
  }

  async function toggleRecord(bubbleId: string, previous?: string) {
    setError(null);
    try {
      if (recording && activeId === bubbleId) {
        const blob = await stop();
        setActiveId(null);
        setSavingId(bubbleId);
        const ref = await saveRecording(projectId, bubbleId, blob);
        if (previous) await deleteRecording(previous).catch(() => {});
        setAudio(bubbleId, ref);
      } else if (!recording) {
        await start();
        setActiveId(bubbleId);
      }
    } catch {
      setActiveId(null);
      setError('Could not record. Check that the app is allowed to use the microphone.');
    } finally {
      setSavingId(null);
    }
  }

  async function play(ref: string) {
    try {
      await new Audio(await playableUrl(ref)).play();
    } catch {
      setError('Could not play this recording.');
    }
  }

  async function remove(bubbleId: string, ref: string) {
    await deleteRecording(ref).catch(() => {});
    setAudio(bubbleId, undefined);
  }

  if (!recordingSupported()) {
    return <p className="studio-error">This browser can’t record audio. Try Chrome on Android, or the Scala’s Shelf app.</p>;
  }

  return (
    <div className="audio-tab">
      <p className="hint">
        Record each line clearly in a quiet room; a phone mic is fine. {recorded} of {draft.bubbles.length} lines recorded.
        Learners hear this when they tap ▶ on a bubble.
      </p>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {draft.bubbles.length === 0 && <p className="hint">Add lines in the Script tab first.</p>}
      {draft.bubbles.map((b, i) => {
        const isActive = recording && activeId === b.id;
        return (
          <div key={b.id} className={`audio-row${isActive ? ' is-recording' : ''}`}>
            <div className="audio-line">
              <span className="line-number">{i + 1}</span>
              <div>
                <strong>{b.speaker || (b.style === 'narration' ? 'Narrator' : '—')}</strong>
                <p lang="en">{b.text.en || <em className="hint">empty line</em>}</p>
              </div>
            </div>
            <div className="audio-actions">
              <button
                className={isActive ? 'record-btn is-recording' : 'record-btn'}
                onClick={() => toggleRecord(b.id, b.audio.en)}
                disabled={!b.text.en.trim() || savingId === b.id || (recording && !isActive)}
              >
                {isActive ? '■ Stop' : savingId === b.id ? 'Saving…' : b.audio.en ? '● Re-record' : '● Record'}
              </button>
              {b.audio.en && !isActive && (
                <>
                  <button className="ghost-btn" onClick={() => play(b.audio.en!)} aria-label={`Play line ${i + 1}`}>▶ Play</button>
                  <button className="icon-btn" onClick={() => remove(b.id, b.audio.en!)} aria-label={`Delete recording ${i + 1}`}>✕</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
