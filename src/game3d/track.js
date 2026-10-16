// NEON DRIFT track: generator (track-gen.js) + queries (track-query.js) behind one import. PURE (no three, no DOM).
export { generateTrack, validateTrack, trackHash, diagnoseAttempt, LIMITS } from './track-gen.js';
export { DS, WALL_MARGIN, wrapS, deltaS, frameAt, surfacePoint, surfaceNormal, closest, wallDistance } from './track-query.js';
