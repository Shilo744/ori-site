// Per-game end-to-end checks used by smoke.mjs (all games) and test-game.mjs (one game). Add one line per game.
import { runSnake } from './game-snake.mjs';

export const GAME_TESTS = {
  snake: runSnake,
};
