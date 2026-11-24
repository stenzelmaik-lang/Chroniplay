/** Spielpause results (Rubik cube and later mini games). Pure rules: which games exist, plausible values, limits.
 * Results are personal: only the player who solved sees them. Nothing here touches characters, XP or the table. */
import {z} from 'zod';

export const SPIELPAUSE_GAMES=['rubik'] as const;
export type SpielpauseGame=typeof SPIELPAUSE_GAMES[number];

/** Saved solves per player and hour; protects the table from a runaway client, not from honest play. */
export const RESULTS_PER_HOUR=60;
/** How many results the personal list shows. */
export const RESULTS_SHOWN=10;
/** A solve under this time is not humanly plausible for a scrambled 3×3 in this app. */
export const MIN_TIME_MS=1500;
export const MAX_TIME_MS=24*3600_000;

export const resultCreateSchema=z.object({
 game:z.enum(SPIELPAUSE_GAMES),
 timeMs:z.number().int().min(MIN_TIME_MS,'Diese Zeit ist zu kurz.').max(MAX_TIME_MS,'Diese Zeit ist zu lang.'),
 moves:z.number().int().min(1,'Mindestens ein Zug.').max(100000,'Zu viele Züge.'),
}).strict();

export const resultQuerySchema=z.object({game:z.enum(SPIELPAUSE_GAMES)});
