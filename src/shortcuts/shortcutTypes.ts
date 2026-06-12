/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ShortcutContext defines the priority layer a shortcut belongs to.
 *
 * - 'global'      : Fires whenever no text input is focused. Not gated by active context.
 * - 'arrangement' : Fires only when the arrangement view is the active context.
 * - 'piano-roll'  : Fires only when the piano roll is the active context.
 * - 'modal'       : Fires only when a modal is open; blocks all non-modal shortcuts.
 */
export type ShortcutContext = 'global' | 'arrangement' | 'piano-roll' | 'modal';

/**
 * Canonical definition of a keyboard shortcut entry.
 * This is the source-of-truth registry — every shortcut that Canvas
 * understands should be declared here, even if no handler is wired yet.
 */
export interface ShortcutDef {
  /** Unique action identifier, used to look up registered handlers. */
  id: string;

  /**
   * One or more canonical key strings that activate this shortcut.
   * Each entry is a '+'-joined modifier+key string, e.g.:
   *   'Space', 'Delete', 'Ctrl+Z', 'Ctrl+Shift+Z', 'Shift+Left'
   * Key names follow the KeyboardEvent.key spec, normalized to Title Case
   * (e.g., 'Escape', 'Backspace', 'ArrowLeft').
   * Modifier order: Ctrl → Shift → Alt → key.
   */
  keys: string[];

  /** Human-readable label shown in the shortcut reference UI. */
  label: string;

  /**
   * Logical grouping for the shortcut reference UI.
   * Examples: 'Transport', 'Tools', 'Clips', 'View', 'Mixer', 'Project'
   */
  category: string;

  /** The context layer this shortcut belongs to. */
  context: ShortcutContext;

  /**
   * When true (the default), e.preventDefault() is called before dispatch.
   * Set to false for shortcuts where the browser default should still fire.
   */
  preventDefault?: boolean;
}

/** A function that handles a matched keyboard shortcut action. */
export type ShortcutHandler = (e: KeyboardEvent) => void;

/**
 * Associates a ShortcutDef's actionId with a concrete handler function.
 * Components register these pairs at mount time via the registry context.
 */
export interface ShortcutRegistration {
  /** Must match an `id` in the shortcuts config. */
  actionId: string;

  /** The callback to invoke when the shortcut fires. */
  handler: ShortcutHandler;
}
