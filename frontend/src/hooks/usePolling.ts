import { useEffect, useRef, useState, useCallback, type Dispatch, type SetStateAction } from 'react'

/** Fetches on mount and on every dep change, then re-fetches on a fixed interval.
 * Pass intervalMs = 0 to disable polling (fetch on mount/dep-change only). */
export function usePolledResource<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[], initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [data, setData] = useState<T>(initial)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(() => {
    fetcherRef.current().then(setData).catch(() => { /* keep last known-good value on transient failure */ })
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load()
    if (!intervalMs) return
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, intervalMs, ...deps])

  return [data, setData]
}
