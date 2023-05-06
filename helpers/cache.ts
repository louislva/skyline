// Cache behaves like a simple JSON object
// But, behind the scenes, it also stores the cache in localStorage

export default class Cache<T> {
  name: string;
  disabled: boolean;
  cacheByTimestamp: {
    [timestamp: string]: {
      [key: string]: T;
    };
  };
  chunkLength: number;
  maxChunks: number;

  constructor(
    name: string,
    storeDuration: number = 1000 * 60 * 60 * 12 /* 12 hours */,
    disabled: boolean = false
  ) {
    this.name = "@cache/" + name;
    this.disabled = disabled;

    this.chunkLength = storeDuration / 10;
    this.maxChunks = 10;

    const storedCacheByTimestamp =
      typeof window !== "undefined" ? localStorage.getItem(this.name) : "{}";
    if (storedCacheByTimestamp) {
      this.cacheByTimestamp = JSON.parse(storedCacheByTimestamp);
    } else {
      this.cacheByTimestamp = {};
    }
    this.save();
  }
  removeExpired() {
    const nowChunk = Math.floor(Date.now() / this.chunkLength);
    this.cacheByTimestamp = Object.fromEntries(
      Object.entries(this.cacheByTimestamp).filter(
        ([key, _cache]) => parseInt(key) + this.maxChunks > nowChunk
      )
    );
  }
  save() {
    this.removeExpired();
    if (typeof window !== "undefined")
      localStorage.setItem(
        this.name,
        this.disabled ? "{}" : JSON.stringify(this.cacheByTimestamp)
      );
  }
  get(key: string): T | undefined {
    return Object.entries(this.cacheByTimestamp)
      .sort((a, b) => {
        const aKey = parseInt(a[0]);
        const bKey = parseInt(b[0]);
        return bKey - aKey;
      })
      .find((cache) => cache[1][key])?.[1][key];
  }
  set(key: string, value: T) {
    try {
      const nowChunk = Math.floor(Date.now() / this.chunkLength);
      this.cacheByTimestamp[nowChunk] = this.cacheByTimestamp[nowChunk] || {};
      this.cacheByTimestamp[nowChunk][key] = value;
      this.save();
    } catch (error) {
      console.error("Error saving to cache: ", error);
    }
  }
}
