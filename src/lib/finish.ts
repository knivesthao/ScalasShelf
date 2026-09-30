// Scala Finish: the server writes the rest of the story and saves it, as a background
// job (api/src/services/finish.ts). The phone starts it, checks on it every couple of
// seconds, then loads the updated book.

import { api } from './api';
import { studioStore, type ProjectData, type SceneData } from './studioStore';

const POLL_MS = 2000;
/** The server gives up on a job after 3 minutes; stop a little later than that. */
const GIVE_UP_MS = 4 * 60 * 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scalaFinish(projectId: string): Promise<{ project: ProjectData; scenes: SceneData[]; first_new_scene: number }> {
  const { job_id } = await api.post<{ job_id: string }>(`/studio/projects/${projectId}/finish`);
  const started = Date.now();
  for (;;) {
    await wait(POLL_MS);
    const job = await api.get<{ status: string; result: { first_new_scene: number } | null; error_message: string | null }>(`/studio/jobs/${job_id}`)
      // A dropped connection mid-wait isn't a failure: keep checking.
      .catch(() => null);
    if (job?.status === 'complete') {
      const book = await studioStore.get(projectId);
      return { ...book, first_new_scene: job.result?.first_new_scene ?? book.scenes.length };
    }
    if (job?.status === 'failed') throw new Error(job.error_message || 'Scala couldn’t finish the story this time. Try again.');
    if (Date.now() - started > GIVE_UP_MS) throw new Error('Scala is taking too long. Check back in a minute.');
  }
}
