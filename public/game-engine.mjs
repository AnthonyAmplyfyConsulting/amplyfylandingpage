export const TILE_COUNT = 16;
export const MINE_COUNT = 2;
export const SAFE_COUNT = TILE_COUNT - MINE_COUNT;
export const BASE_REWARD = 50;
export const MAX_REWARD = 500;
export function amountFor(gems) {
  return gems >= SAFE_COUNT ? MAX_REWARD : Math.floor(BASE_REWARD * (MAX_REWARD / BASE_REWARD) ** (gems / SAFE_COUNT));
}
function randomIndex(limit) {
  const ceiling = 4294967296 - (4294967296 % limit);
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % limit;
}
export function createRound(rng = randomIndex) {
  const positions = Array.from({ length: TILE_COUNT }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return { mines: new Set(positions.slice(0, MINE_COUNT)), revealed: new Set(), gems: 0, ended: false, cleared: false, amount: BASE_REWARD };
}
export function revealTile(round, index) {
  if (round.ended || !Number.isInteger(index) || index < 0 || index >= TILE_COUNT || round.revealed.has(index)) return null;
  round.revealed.add(index);
  if (round.mines.has(index)) { round.ended = true; return 'mine'; }
  round.gems++;
  round.amount = amountFor(round.gems);
  if (round.gems === SAFE_COUNT) { round.ended = true; round.cleared = true; }
  return round.cleared ? 'clear' : 'gem';
}
