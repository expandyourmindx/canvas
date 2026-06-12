/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { SHORTCUTS } from '../shortcuts/shortcuts.config';
import type {
  ShortcutContext,
  ShortcutHandler,
  ShortcutRegistration,
} from '../shortcuts/shortcutTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ShortcutRegistryContextValue {
  /** Register one or more action → handler bindings. */
  registerHandlers: (registrations: ShortcutRegistration[]) => void;

  /** Unregister handlers by their action IDs. */
  unregisterHandlers: (actionIds: string[]) => void;

  /**
   * Push a context onto the stack (e.g., when a modal opens or a panel
   * becomes active). The top-of-stack is the active context.
   */
  pushContext: (ctx: ShortcutContext) => void;

  /**
   * Pop the last matching context entry off the stack (e.g., when a modal
   * closes or a panel is deactivated).
   */
  popContext: (ctx: ShortcutContext) => void;

  /** The currently active context (top of the stack). */
  activeContext: ShortcutContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a canonical key string from a KeyboardEvent.
 * Modifier order: Ctrl → Shift → Alt → key.
 * Special normalisations:
 *   ' '        → 'Space'
 *   'Equal'    → '='
 *   'Plus'     → '+'
 *   'Minus'    → '-'
 *   Arrow keys → 'ArrowLeft', 'ArrowRight', etc. (unchanged, matches spec)
 */
function buildCanonicalKey(e: KeyboardEvent): string {
  let key = e.key;

  // Normalise whitespace and named keys
  if (key === ' ') key = 'Space';
  if (key === 'Equal') key = '=';
  if (key === 'Plus') key = '+';
  if (key === 'Minus') key = '-';

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  parts.push(key);

  return parts.join('+');
}

/**
 * Returns true when the current focus target is a text-editing element,
 * which should suppress most shortcut handling.
 */
function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ShortcutRegistryContext = createContext<ShortcutRegistryContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ShortcutRegistryProvider({ children }: { children: React.ReactNode }) {
  /**
   * handler map: actionId → handler function
   * Stored in a ref so that the single window listener doesn't need to be
   * re-attached whenever handlers change.
   */
  const handlerMapRef = useRef<Map<string, ShortcutHandler>>(new Map());

  /**
   * Context stack. Default is ['global'].
   * activeContext is always the last element.
   */
  const contextStackRef = useRef<ShortcutContext[]>(['global']);

  /**
   * Reactive activeContext state — kept in sync with the stack ref so
   * consumers can observe context changes.
   */
  const [activeContext, setActiveContext] = React.useState<ShortcutContext>('global');

  // ── Handler registration ──────────────────────────────────────────────────

  const registerHandlers = useCallback((registrations: ShortcutRegistration[]) => {
    for (const reg of registrations) {
      if (process.env.NODE_ENV !== 'production') {
        if (handlerMapRef.current.has(reg.actionId)) {
          console.warn(
            `[ShortcutRegistry] Action "${reg.actionId}" is already registered by another component. Overwriting.`
          );
        }
      }
      handlerMapRef.current.set(reg.actionId, reg.handler);
    }
  }, []);

  const unregisterHandlers = useCallback((actionIds: string[]) => {
    for (const id of actionIds) {
      handlerMapRef.current.delete(id);
    }
  }, []);

  // ── Context stack ─────────────────────────────────────────────────────────

  const pushContext = useCallback((ctx: ShortcutContext) => {
    contextStackRef.current = [...contextStackRef.current, ctx];
    setActiveContext(ctx);
  }, []);

  const popContext = useCallback((ctx: ShortcutContext) => {
    const stack = contextStackRef.current;
    // Remove the last occurrence of `ctx` from the stack
    const idx = [...stack].reverse().findIndex((c) => c === ctx);
    if (idx === -1) return;
    const removeAt = stack.length - 1 - idx;
    const next = stack.filter((_, i) => i !== removeAt);
    // Ensure we always have at least 'global'
    contextStackRef.current = next.length > 0 ? next : ['global'];
    setActiveContext(contextStackRef.current[contextStackRef.current.length - 1]);
  }, []);

  // ── Single global keydown listener ───────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const canonical = buildCanonicalKey(e);
      const currentContext = contextStackRef.current[contextStackRef.current.length - 1];
      const textFocused = isTextInputFocused();

      // Find a matching ShortcutDef
      for (const def of SHORTCUTS) {
        // Case-insensitive key matching
        const matched = def.keys.some(
          (k) => k.toLowerCase() === canonical.toLowerCase()
        );
        if (!matched) continue;

        // Context-based gating
        if (currentContext === 'modal') {
          // Only modal-scoped shortcuts fire when a modal is open
          if (def.context !== 'modal') continue;
        } else {
          if (def.context === 'modal') continue;

          if (def.context === 'global') {
            // Global shortcuts are suppressed when a text input is focused
            if (textFocused) continue;
          } else {
            // Context-specific shortcuts fire only when context matches
            // and no text input is focused
            if (textFocused) continue;
            if (def.context !== currentContext) continue;
          }
        }

        // Fire
        if (def.preventDefault !== false) {
          e.preventDefault();
        }

        const handler = handlerMapRef.current.get(def.id);
        if (handler) {
          handler(e);
        }

        // Stop searching once a match is dispatched
        break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // SHORTCUTS is a module-level constant — no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: ShortcutRegistryContextValue = {
    registerHandlers,
    unregisterHandlers,
    pushContext,
    popContext,
    activeContext,
  };

  return (
    <ShortcutRegistryContext.Provider value={value}>
      {children}
    </ShortcutRegistryContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useShortcutRegistry — access raw context
// ─────────────────────────────────────────────────────────────────────────────

export function useShortcutRegistry(): ShortcutRegistryContextValue {
  const ctx = useContext(ShortcutRegistryContext);
  if (!ctx) {
    throw new Error(
      'useShortcutRegistry must be used inside <ShortcutRegistryProvider>.'
    );
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// useShortcuts — convenience hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience hook. Accepts a map of actionId → handler and registers/
 * unregisters them automatically on mount/unmount.
 *
 * The handler map reference is intentionally tracked via a ref internally,
 * so callers do NOT need to memoize the object they pass in — the hook is
 * stable across renders.
 *
 * @example
 * useShortcuts({
 *   'clip.delete': (e) => deleteSelectedClips(),
 *   'clip.selectAll': (e) => selectAllClips(),
 * });
 */
export function useShortcuts(handlers: Record<string, ShortcutHandler>): void {
  const { registerHandlers, unregisterHandlers } = useShortcutRegistry();

  // Keep a stable ref to the latest handlers map
  const handlersRef = useRef<Record<string, ShortcutHandler>>(handlers);

  // Update the ref on every render so the registered closure always calls the
  // latest version of each handler without needing to re-register.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Mount: register proxy handlers that delegate to the ref
  useEffect(() => {
    const actionIds = Object.keys(handlersRef.current);

    const registrations: ShortcutRegistration[] = actionIds.map((id) => ({
      actionId: id,
      handler: (e: KeyboardEvent) => {
        const h = handlersRef.current[id];
        if (h) h(e);
      },
    }));

    registerHandlers(registrations);

    return () => {
      unregisterHandlers(actionIds);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerHandlers, unregisterHandlers]);
}
