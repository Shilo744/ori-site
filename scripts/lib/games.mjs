// Per-game end-to-end checks used by smoke.mjs (all games) and test-game.mjs (one game). Add one line per game.
import { runSnake } from './game-snake.mjs';
import { run2048 } from './game-2048.mjs';
import { runTetris } from './game-tetris.mjs';
import { runMinesweeper } from './game-minesweeper.mjs';

export const GAME_TESTS = {
  snake: runSnake,
  2048: run2048,
  tetris: runTetris,
  minesweeper: runMinesweeper,
};
