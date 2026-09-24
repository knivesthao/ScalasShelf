// Features that are built but switched off for now.

export const FEATURES = {
  /**
   * Scene art generation, panel layout and voice recording in the Studio.
   * Off until the rendering pipeline is ready; writers can still write whole books.
   */
  rendering: false,
  /**
   * Studio saves to the server and publishes to the library. Off until sign-in exists,
   * so nobody can flood the database; drafts are saved on the writer's device instead.
   */
  cloudStudio: false,
};
