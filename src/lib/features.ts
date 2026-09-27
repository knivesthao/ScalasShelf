// Features that are built but switched off for now.

export const FEATURES = {
  /**
   * Scene art generation, panel layout and voice recording in the Studio.
   * Off until the rendering pipeline is ready; writers can still write whole books.
   */
  rendering: false,
  /**
   * Studio saves to the server; staff sign in by email link, and reviewers approve books
   * before they reach the library. When off, drafts are saved on the writer's device.
   */
  cloudStudio: true,
};

/**
 * The reader-only build (`npm run build:reader`, used for the Google Play app): the library
 * and reader only, with no Studio, sign-in or review pages in the bundle.
 */
export const READER_ONLY = import.meta.env.VITE_READER_ONLY === '1';
