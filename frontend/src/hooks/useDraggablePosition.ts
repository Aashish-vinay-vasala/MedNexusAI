import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type Position = { x: number; y: number }
type Size = { width: number; height: number }

const STORAGE_KEY = 'mednexus.assistant.position'
const MARGIN = 16
const DRAG_THRESHOLD = 4

function clamp(pos: Position, size: Size): Position {
  const maxX = Math.max(MARGIN, window.innerWidth - size.width - MARGIN)
  const maxY = Math.max(MARGIN, window.innerHeight - size.height - MARGIN)
  return { x: Math.min(Math.max(pos.x, MARGIN), maxX), y: Math.min(Math.max(pos.y, MARGIN), maxY) }
}

function loadStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Position : null
  } catch { return null }
}

function savePosition(pos: Position) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch { /* storage unavailable — position just won't persist */ }
}

/** Lets the widget (FAB or open panel) be dragged and dropped anywhere on screen via a handle
 * element, rather than being pinned to a corner. Position is top-left-anchored, clamped to stay
 * fully on-screen as the element's own size changes (FAB <-> panel, or panel size preset), and
 * persisted to localStorage so it survives reloads. */
export function useDraggablePosition(currentSize: Size) {
  const [position, setPosition] = useState<Position>(() => {
    const stored = loadStoredPosition()
    const fallback = { x: window.innerWidth - currentSize.width - 24, y: window.innerHeight - currentSize.height - 24 }
    return clamp(stored ?? fallback, currentSize)
  })
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 })
  const sizeRef = useRef(currentSize)
  sizeRef.current = currentSize

  // Runs synchronously before paint so a size change (FAB <-> panel, or panel size preset)
  // resolves to its final anchored position in the same frame — no stale-position flash.
  // Keeps whichever corner of the box is nearest the screen edge fixed and grows/shrinks
  // toward the center, so the panel opens right where the FAB was instead of jumping to
  // an unrelated clamped position.
  const prevSizeRef = useRef(currentSize)
  useLayoutEffect(() => {
    const prevSize = prevSizeRef.current
    prevSizeRef.current = currentSize
    if (prevSize.width === currentSize.width && prevSize.height === currentSize.height) return
    setPosition(prev => {
      const anchorRight = prev.x + prevSize.width / 2 > window.innerWidth / 2
      const anchorBottom = prev.y + prevSize.height / 2 > window.innerHeight / 2
      const x = anchorRight ? prev.x + prevSize.width - currentSize.width : prev.x
      const y = anchorBottom ? prev.y + prevSize.height - currentSize.height : prev.y
      return clamp({ x, y }, currentSize)
    })
  }, [currentSize.width, currentSize.height])

  useEffect(() => {
    function onResize() { setPosition(prev => clamp(prev, sizeRef.current)) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current) return
      const dx = e.clientX - offsetRef.current.x
      const dy = e.clientY - offsetRef.current.y
      if (!movedRef.current && (Math.abs(e.clientX - offsetRef.current.startX) > DRAG_THRESHOLD || Math.abs(e.clientY - offsetRef.current.startY) > DRAG_THRESHOLD)) {
        movedRef.current = true
      }
      setPosition(clamp({ x: dx, y: dy }, sizeRef.current))
    }
    function onUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      setDragging(false)
      setPosition(prev => { savePosition(prev); return prev })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    draggingRef.current = true
    movedRef.current = false
    setDragging(true)
    offsetRef.current = { x: e.clientX - position.x, y: e.clientY - position.y, startX: e.clientX, startY: e.clientY }
  }, [position])

  /** Call inside a click handler to suppress the click that follows a real drag. */
  const consumeIfDragged = useCallback((): boolean => {
    const was = movedRef.current
    movedRef.current = false
    return was
  }, [])

  return { position, dragging, onPointerDown, consumeIfDragged }
}
