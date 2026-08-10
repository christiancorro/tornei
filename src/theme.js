/* ---------------------------------------------------------
   Design tokens — grounded in the subject: sand, grass, sea,
   sun. Kept as plain hex + inline style throughout so nothing
   depends on Tailwind's JIT/arbitrary-value features.
--------------------------------------------------------- */
export const SAND = '#fffcf8';
export const CARD_BG = '#fffefb';
export const INK = '#282828';
export const SUN = '#F5A524';
export const SEA = '#1C7C8C';
export const SEA_DARK = '#145A66';
export const GRASS = '#a0f34e';
export const GRASS_DARK = '#488222';
export const CLAY = '#B8472A';
export const CLAY_DARK = '#8C3520';
export const SABBIA = '#f0c843';
export const SABBIA_DARK = '#c78c20';

// Bacheca (notice board) tokens — kept separate from the discipline
// colors above so a post's color never implies Beach/Green Volley.
export const BOARD_A = SUN; // 'Cerco squadra' accent — reuses the primary accent
export const BOARD_B = '#6B4E8E'; // 'Cercasi giocatori' accent — a new, distinct hue
export const CORK = '#fffaf1';
export const CORK_FRAME = 'rgba(202, 157, 117, 0.3)';
export const PIN_COLOR = '#d56e63';
export const NOTE_YELLOW = '#fff9df';
export const NOTE_WHITE = '#f7f7ff';
