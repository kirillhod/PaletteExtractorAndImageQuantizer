// @ts-check
/**
 * Deterministic splitmix64 PRNG. Never use Math.random in this project.
 */

const MASK64 = (1n << 64n) - 1n;
const GAMMA = 0x9e3779b97f4a7c15n;
const MUL1 = 0xbf58476d1ce4e5b9n;
const MUL2 = 0x94d049bb133111ebn;

/**
 * @param {number} seed
 */
export function createRng(seed) {
  if (!Number.isFinite(seed)) throw new TypeError('seed must be a finite number');
  let state = BigInt(Math.trunc(seed)) & MASK64;

  /** @returns {bigint} */
  function nextU64() {
    state = (state + GAMMA) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * MUL1) & MASK64;
    z = ((z ^ (z >> 27n)) * MUL2) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
  }

  /** @returns {number} in [0, 1) */
  function nextFloat() {
    return Number(nextU64() >> 11n) / 9007199254740992;
  }

  /**
   * @param {number} maxExclusive
   * @returns {number} in [0, maxExclusive)
   */
  function nextInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer');
    }
    return Number(nextU64() % BigInt(maxExclusive));
  }

  return { nextU64, nextFloat, nextInt };
}

export const splitmix64 = createRng;
