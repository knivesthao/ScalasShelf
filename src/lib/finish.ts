// Scala Finish: the server writes the rest of the story and saves it
// (api/src/services/finish.ts). The phone only asks, then shows the updated book.

import { api } from './api';
import type { ProjectData, SceneData } from './studioStore';

export function scalaFinish(projectId: string) {
  return api.post<{ project: ProjectData; scenes: SceneData[]; first_new_scene: number }>(`/studio/projects/${projectId}/finish`);
}
