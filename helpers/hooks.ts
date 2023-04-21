import { useEffect, useMemo, useState } from "react";
import * as R from "ramda";

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  // First checks localStorage
  // If not found, uses defaultValue
  // Otherwise, uses the value from localStorage
  // Every time the state is set, it is also saved to localStorage

  const [state, setState] = useState<T>(() => {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value);
    } else {
      return defaultValue;
    }
  });

  const setStateAndSave = (value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
    setState(value);
  };

  return [state, setStateAndSave];
}

type CacheType = any;
export function useCache(
  interval: number = 1000 * 60 * 60
): [CacheType, (value: CacheType) => void] {
  const getTimeSegment = () => Math.floor(Date.now() / interval);

  const [segmentedCache, setSegmentedCache] = useState<{
    [unixHour: string]: CacheType;
  }>({});
  console.log("segmentedCache", segmentedCache);

  const mergedCache = useMemo(() => {
    const filteredSegments = Object.entries(segmentedCache).filter(
      ([unixHour]) => getTimeSegment() - parseInt(unixHour) > 12 // Only keep up to 24 hours in cache
    );
    console.log("filteredSegments", filteredSegments);
    return R.mergeAll(filteredSegments.map(([_, cache]) => cache));
  }, [segmentedCache]);
  console.log("mergedCache", mergedCache);

  useEffect(() => {
    setSegmentedCache(JSON.parse(localStorage.getItem("@globalCache") || "{}"));
  }, []);

  const updateCache = (value: CacheType) => {
    const newSegmentedCache = {
      ...segmentedCache,
      [getTimeSegment()]: {
        ...(segmentedCache[getTimeSegment()] || {}),
        ...value,
      },
    };
    setSegmentedCache(newSegmentedCache);
    localStorage.setItem("@globalCache", JSON.stringify(newSegmentedCache));
  };

  return [mergedCache, updateCache];
}
