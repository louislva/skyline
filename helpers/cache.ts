// Cache behaves like a simple JSON object
// But, behind the scenes, it also stores the cache in localStorage
const CHUNK_LENGTH = 1000 * 10;
const MAX_CHUNKS = 4; // KEEP 12 HOURS OF CACHE

type CacheType = {
  [key: string]: any;
};
export default class Cache {
  name: string;
  cacheByTimestamp: {
    [timestamp: string]: CacheType;
  };

  constructor(name: string) {
    this.name = "@cache/" + name;

    const storedCacheByTimestamp =
      typeof window !== "undefined" ? localStorage.getItem(this.name) : "{}";
    if (storedCacheByTimestamp) {
      this.cacheByTimestamp = JSON.parse(storedCacheByTimestamp);
    } else {
      this.cacheByTimestamp = {};
    }
    this.removeExpired();
    this.save();
  }
  removeExpired() {
    const nowChunk = Math.floor(Date.now() / CHUNK_LENGTH);
    this.cacheByTimestamp = Object.fromEntries(
      Object.entries(this.cacheByTimestamp).filter(
        ([key, _cache]) => parseInt(key) + MAX_CHUNKS > nowChunk
      )
    );
  }
  save() {
    if (typeof window !== "undefined")
      localStorage.setItem(this.name, JSON.stringify(this.cacheByTimestamp));
  }
  get(key: string): any {
    return Object.entries(this.cacheByTimestamp)
      .sort((a, b) => {
        const aKey = parseInt(a[0]);
        const bKey = parseInt(b[0]);
        return bKey - aKey;
      })
      .find((cache) => cache[1][key])?.[1][key];
  }
  set(key: string, value: any) {
    const nowChunk = Math.floor(Date.now() / CHUNK_LENGTH);
    this.cacheByTimestamp[nowChunk] = this.cacheByTimestamp[nowChunk] || {};
    this.cacheByTimestamp[nowChunk][key] = value;
    this.save();
  }
}
