import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fileUrl } from './api';

// Voice recording for the Studio. The phone only records and uploads the raw
// clip (~20–50 KB per line) to the API (R2 in production, .data/ locally);
// cleanup and Opus encoding happen in the cloud packager at publish.
// bubble.audio.en holds the file key, e.g. "audio/<project>/<bubble>-<time>.webm".

export function recordingSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

export function useRecorder() {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  // Release the microphone if the creator leaves mid-recording.
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
    const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.start();
    recorder.current = rec;
    setRecording(true);
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob>((resolve) => {
        const rec = recorder.current;
        if (!rec) return resolve(new Blob());
        rec.onstop = () => {
          rec.stream.getTracks().forEach((t) => t.stop());
          recorder.current = null;
          setRecording(false);
          resolve(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }));
        };
        rec.stop();
      }),
    []
  );

  return { recording, start, stop };
}

/** Upload a recording; returns the file key stored in bubble.audio.en. */
export async function saveRecording(projectId: string, bubbleId: string, blob: Blob): Promise<string> {
  const { key } = await api.upload<{ key: string }>(
    `/studio/projects/${projectId}/audio?bubble=${encodeURIComponent(bubbleId)}`,
    blob.type ? blob : new Blob([blob], { type: 'audio/webm' })
  );
  return key;
}

export async function playableUrl(ref: string): Promise<string> {
  return ref.startsWith('audio/') ? fileUrl(ref) : ref;
}

export async function deleteRecording(ref: string): Promise<void> {
  if (ref.startsWith('audio/')) await api.delete(`/files/${ref}`);
}
