// Seeded random numbers (mulberry32) so the city, traffic and screenshot
// scenes are identical for a given seed — the ?shot= scenes depend on it.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  /** Float in [0, 1). */
  float() {
    return this.next();
  }
  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }
  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  /** One element of an array. */
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
  /** True with probability p. */
  chance(p) {
    return this.next() < p;
  }
  /** A new array with the elements shuffled. */
  shuffle(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}
