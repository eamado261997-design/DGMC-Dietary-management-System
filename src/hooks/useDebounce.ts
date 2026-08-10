import { useState, useEffect } from "react";

/**
 * Custom React hook that debounces a rapidly changing value (e.g. search input value).
 *
 * @param value The value to be debounced
 * @param delay Delay in milliseconds (default 300ms)
 * @returns The debounced value updated only after `delay` ms of stability
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
