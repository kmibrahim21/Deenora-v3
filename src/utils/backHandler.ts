import { useEffect } from 'react';

export type BackHandlerFn = () => boolean;

export interface BackHandlerItem {
  id: string;
  fn: BackHandlerFn;
  priority: number;
}

const handlerStack: BackHandlerItem[] = [];

/**
 * Registers a back handler in the priority-sorted stack.
 * Returns an unregister cleanup function.
 */
export function registerBackHandler(id: string, fn: BackHandlerFn, priority: number = 0): () => void {
  // Remove existing handler with same ID if any
  const existingIndex = handlerStack.findIndex(h => h.id === id);
  if (existingIndex !== -1) {
    handlerStack.splice(existingIndex, 1);
  }

  handlerStack.push({ id, fn, priority });
  handlerStack.sort((a, b) => b.priority - a.priority); // Highest priority executed first

  return () => {
    const idx = handlerStack.findIndex(h => h.id === id);
    if (idx !== -1) {
      handlerStack.splice(idx, 1);
    }
  };
}

/**
 * React hook to register a back handler for the lifetime of a component or state condition.
 */
export function useBackHandler(id: string, fn: BackHandlerFn, active: boolean = true, priority: number = 0) {
  useEffect(() => {
    if (!active) return;
    return registerBackHandler(id, fn, priority);
  }, [id, active, priority, fn]);
}

/**
 * Executes registered handlers in order of highest priority.
 * Returns true if a handler consumed the back press event.
 */
export function executeBackHandlerStack(): boolean {
  for (let i = 0; i < handlerStack.length; i++) {
    try {
      const handled = handlerStack[i].fn();
      if (handled) {
        return true;
      }
    } catch (err) {
      console.warn('[BackHandler] Error executing back handler:', handlerStack[i]?.id, err);
    }
  }
  return false;
}
