/**
 * Starter structure for the game goal. Everything is editable; it exists so the
 * screens begin with a useful shape rather than blank pages.
 */
export interface SeedPhase {
  key: string;
  title: string;
  description: string;
  /** Title of the seeded game milestone this phase leads to. */
  milestoneTitle: string | null;
  tasks: { key: string; title: string; dependsOn?: string[] }[];
}

export const SEED_ROADMAP: readonly SeedPhase[] = [
  {
    key: 'foundations',
    title: 'Foundations',
    description: 'Learn one engine well enough to finish small things.',
    milestoneTitle: 'Engine fundamentals and small practice projects',
    tasks: [
      { key: 'engine', title: 'Choose an engine and record why' },
      {
        key: 'tutorial',
        title: 'Finish the engine’s official beginner tutorial',
        dependsOn: ['engine'],
      },
      { key: 'git', title: 'Learn version control basics (commit, branch, revert)' },
      { key: 'practice', title: 'Finish three small practice projects', dependsOn: ['tutorial'] },
    ],
  },
  {
    key: 'prototype',
    title: 'Prototype',
    description: 'Find a core loop that is fun in grey boxes.',
    milestoneTitle: null,
    tasks: [
      { key: 'concept', title: 'Write a one-page concept (hook, loop, scope)' },
      {
        key: 'greybox',
        title: 'Build a grey-box prototype of the core loop',
        dependsOn: ['practice', 'concept'],
      },
      {
        key: 'playtest1',
        title: 'Playtest the prototype with three people',
        dependsOn: ['greybox'],
      },
      { key: 'decide', title: 'Decide: continue, pivot or shelve', dependsOn: ['playtest1'] },
    ],
  },
  {
    key: 'production',
    title: 'Production',
    description: 'Turn the prototype into a complete game.',
    milestoneTitle: 'First complete playable version',
    tasks: [
      { key: 'slice', title: 'Vertical slice: one finished level', dependsOn: ['decide'] },
      { key: 'content', title: 'Core content complete', dependsOn: ['slice'] },
      { key: 'saves', title: 'Save and load system' },
      { key: 'options', title: 'Settings and accessibility options' },
      { key: 'playable', title: 'First complete playable build', dependsOn: ['content', 'saves'] },
    ],
  },
  {
    key: 'store',
    title: 'Store page',
    description: 'Make the game wishlistable early.',
    milestoneTitle: 'Steam store page public',
    tasks: [
      { key: 'steamworks', title: 'Steamworks account and app fee' },
      { key: 'capsules', title: 'Capsule art' },
      { key: 'trailer', title: 'Screenshots and a short trailer', dependsOn: ['slice'] },
      { key: 'copy', title: 'Store description and tags' },
      {
        key: 'live',
        title: 'Store page live — gather wishlists',
        dependsOn: ['steamworks', 'capsules', 'trailer', 'copy'],
      },
    ],
  },
  {
    key: 'polish',
    title: 'Polish and playtest',
    description: 'Make it feel finished.',
    milestoneTitle: 'Polish and playtesting finished',
    tasks: [
      { key: 'closed', title: 'Closed playtest round', dependsOn: ['playable'] },
      { key: 'bugs', title: 'Bug-fix pass', dependsOn: ['closed'] },
      { key: 'perf', title: 'Performance pass' },
    ],
  },
  {
    key: 'launch',
    title: 'Launch',
    description: 'Ship it.',
    milestoneTitle: 'Release',
    tasks: [
      { key: 'date', title: 'Choose the release date and launch discount' },
      { key: 'review', title: 'Submit the build for review', dependsOn: ['bugs', 'live'] },
      { key: 'presskit', title: 'Press kit' },
      { key: 'release', title: 'Release', dependsOn: ['review', 'date'] },
    ],
  },
];

export const SEED_LEARNING: readonly { category: string; title: string; notes: string }[] = [
  {
    category: 'Engine choice',
    title: 'Compare two or three engines',
    notes:
      'Language, 2D/3D fit, export targets, licence, size of the community, quality of the tutorials. Record the decision below.',
  },
  {
    category: 'Programming basics',
    title: 'Core programming concepts',
    notes:
      'Variables, functions, conditionals, loops, lists and dictionaries, classes or structs, and using a debugger with breakpoints.',
  },
  {
    category: 'The core game loop',
    title: 'Update, draw and time',
    notes:
      'The frame loop, delta time, fixed versus variable timestep, and game states (menu, play, pause, game over).',
  },
  {
    category: 'Input',
    title: 'Responsive controls',
    notes:
      'Keyboard, mouse and controller; input actions and rebinding; buffering and coyote time for forgiving controls.',
  },
  {
    category: 'Collision',
    title: 'Detecting and resolving contact',
    notes:
      'Bounding boxes and circles, collision layers and masks, physics bodies versus manual checks, resolving overlaps.',
  },
  {
    category: 'UI',
    title: 'Menus and HUD',
    notes:
      'Main menu, pause menu, HUD; scaling to different resolutions; controller navigation and focus.',
  },
  {
    category: 'Audio',
    title: 'Sound and music',
    notes: 'Playing effects and music, mixers or buses, volume settings, avoiding clipping.',
  },
  {
    category: 'Save systems',
    title: 'Persisting progress',
    notes:
      'What to save, file formats, versioning saves so old ones still load, cloud saves later.',
  },
  {
    category: 'Build and export',
    title: 'Shipping a build',
    notes:
      'Export presets for Windows, macOS and Linux; testing a clean build on another machine; build numbers.',
  },
];

export const SEED_PRACTICE: readonly string[] = [
  'Pong',
  'Breakout',
  'One-button game (Flappy-style)',
  'Single-screen platformer',
  'Top-down arena shooter',
];

export const STEAM_VERIFY_NOTE = 'Verify against the current Steamworks documentation.';

/**
 * Steam-readiness checklist. Fees, sizes and rules change: every item carries a
 * reminder to verify it, and figures are given as "last known", never as fact.
 */
export const SEED_STEAM: readonly { section: string; title: string; detail: string }[] = [
  {
    section: 'Account and legal',
    title: 'Steamworks partner account',
    detail: `Register as a Steamworks partner. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Account and legal',
    title: 'Steam Direct app fee',
    detail: `Last known: US$100 per app, recoupable after a revenue threshold. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Account and legal',
    title: 'Tax and bank information',
    detail: `Tax interview and payment details. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Account and legal',
    title: 'Identity verification',
    detail: `Valve verifies the account holder before release. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Header capsule',
    detail: `Last known size 920 × 430. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Small capsule',
    detail: `Last known size 462 × 174. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Main capsule',
    detail: `Last known size 1232 × 706. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Vertical capsule',
    detail: `Last known size 748 × 896. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Library capsule, hero and logo',
    detail: `Last known 600 × 900, 3840 × 1240 and 1280 × 720 (logo with transparency). ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Screenshots',
    detail: `At least five gameplay screenshots, 1920 × 1080 recommended. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Trailer',
    detail: `Show gameplay in the first seconds. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Store page assets',
    title: 'Descriptions, tags and system requirements',
    detail: `Short and long descriptions, genres and tags, minimum specs. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Wishlists and marketing',
    title: 'Wishlist target',
    detail: 'Set a target before launch and track it monthly.',
  },
  {
    section: 'Wishlists and marketing',
    title: '“Coming soon” page live early',
    detail: `A store page must be public for a minimum period before release (last known: two weeks). ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Wishlists and marketing',
    title: 'Press kit',
    detail: 'Description, screenshots, trailer, logo and contact.',
  },
  {
    section: 'Wishlists and marketing',
    title: 'Steam Next Fest (optional)',
    detail: `A demo during a Next Fest can bring wishlists. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Build and release',
    title: 'Upload a build with SteamPipe',
    detail: `Depots, branches and launch options. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Build and release',
    title: 'Store page review',
    detail: `Valve reviews the page before it can go live. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Build and release',
    title: 'Build review',
    detail: `Valve reviews the build before release; allow several days. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Build and release',
    title: 'Price and regional pricing',
    detail: `Choose a base price and review suggested regional prices. ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Build and release',
    title: 'Age ratings',
    detail: `Content survey and any required ratings (e.g. IARC). ${STEAM_VERIFY_NOTE}`,
  },
  {
    section: 'Build and release',
    title: 'Release date and launch discount',
    detail: `Plan around major sales and festivals. ${STEAM_VERIFY_NOTE}`,
  },
];
