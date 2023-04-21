import { useEffect, useState } from "react";

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
