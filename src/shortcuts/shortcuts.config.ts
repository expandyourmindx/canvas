/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * KEYBOARD SHORTCUT CATALOG — Canvas DAW (Phase 1 discovery)
 *
 * SOURCE: KeyboardMidiListener.tsx
 *   [global]  Space / ' '              → transport.playPause   (toggle play/stop)
 *   [global]  PC QWERTY keys (z,s,x,d,c,v,g,b,h,n,j,m,,,q,2,w,3,e,r,5,t,6,y,7,u,i)
 *                                       → pcKeyboard MIDI note-on/off (when pcKeyboardMidiActive)
 *
 * SOURCE: AudioEngineProvider.tsx
 *   [global]  Ctrl+Z                   → edit.undo
 *   [global]  Ctrl+Shift+Z             → edit.redo
 *   [global]  Ctrl+Y                   → edit.redo
 *   [global]  Ctrl+S                   → project.save
 *   [global]  Ctrl+O                   → project.open
 *
 * SOURCE: Mixer.tsx (inline onKeyDown on rename input)
 *   [modal]   Enter                    → mixer.confirmRename   (only while rename input active)
 *   [modal]   Escape                   → mixer.cancelRename    (only while rename input active)
 *
 * NOTE: Canvas.tsx itself has NO direct keydown handlers.
 *       All clip operations (Delete, nudge, copy, paste, etc.) listed below
 *       are currently mouse/pointer only — keyboard shortcuts are TODO.
 */

import { ShortcutDef } from './shortcutTypes';

export const SHORTCUTS: ShortcutDef[] = [

  // ─────────────────────────────────────────────
  // TRANSPORT
  // ─────────────────────────────────────────────
  {
    id: 'transport.playPause',
    keys: ['Space'],
    label: 'Play / Pause',
    category: 'Transport',
    context: 'global',
    preventDefault: true,
  },
  {
    id: 'transport.stop',
    keys: ['Enter'],
    label: 'Stop',
    category: 'Transport',
    context: 'global',
    preventDefault: true,
  },

  // ─────────────────────────────────────────────
  // TOOLS  (arrangement context)
  // ─────────────────────────────────────────────
  {
    id: 'tool.pencil',
    keys: ['p', 'P'],
    label: 'Pencil Tool',
    category: 'Tools',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'tool.eraser',
    keys: ['e', 'E'],
    label: 'Eraser Tool',
    category: 'Tools',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'tool.split',
    keys: ['s', 'S'],
    label: 'Split / Razor Tool',
    category: 'Tools',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'tool.pointer',
    keys: ['Escape'],
    label: 'Pointer Tool (Select)',
    category: 'Tools',
    context: 'arrangement',
    preventDefault: false,
  },

  // ─────────────────────────────────────────────
  // CLIPS  (arrangement context)
  // ─────────────────────────────────────────────
  {
    id: 'clip.delete',
    keys: ['Delete', 'Backspace'],
    label: 'Delete Selected Clip(s)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.duplicate',
    keys: ['Ctrl+d', 'Ctrl+D'],
    label: 'Duplicate Selected Clip(s)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.selectAll',
    keys: ['Ctrl+a', 'Ctrl+A'],
    label: 'Select All Clips',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.copy',
    keys: ['Ctrl+c', 'Ctrl+C'],
    label: 'Copy Selected Clip(s)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.paste',
    keys: ['Ctrl+v', 'Ctrl+V'],
    label: 'Paste Clip(s)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.nudgeLeft',
    keys: ['ArrowLeft'],
    label: 'Nudge Left (1 beat)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.nudgeRight',
    keys: ['ArrowRight'],
    label: 'Nudge Right (1 beat)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.nudgeLeftFine',
    keys: ['Shift+ArrowLeft'],
    label: 'Nudge Left Fine (1/16 beat)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },
  {
    id: 'clip.nudgeRightFine',
    keys: ['Shift+ArrowRight'],
    label: 'Nudge Right Fine (1/16 beat)',
    category: 'Clips',
    context: 'arrangement',
    preventDefault: true,
  },

  // ─────────────────────────────────────────────
  // EDIT  (global)
  // ─────────────────────────────────────────────
  {
    id: 'edit.undo',
    keys: ['Ctrl+z', 'Ctrl+Z'],
    label: 'Undo',
    category: 'Edit',
    context: 'global',
    preventDefault: true,
  },
  {
    id: 'edit.redo',
    keys: ['Ctrl+Shift+z', 'Ctrl+Shift+Z', 'Ctrl+y', 'Ctrl+Y'],
    label: 'Redo',
    category: 'Edit',
    context: 'global',
    preventDefault: true,
  },

  // ─────────────────────────────────────────────
  // PROJECT  (global)
  // ─────────────────────────────────────────────
  {
    id: 'project.save',
    keys: ['Ctrl+s', 'Ctrl+S'],
    label: 'Save Project',
    category: 'Project',
    context: 'global',
    preventDefault: true,
  },
  {
    id: 'project.open',
    keys: ['Ctrl+o', 'Ctrl+O'],
    label: 'Open Project',
    category: 'Project',
    context: 'global',
    preventDefault: true,
  },

  // ─────────────────────────────────────────────
  // VIEW  (global)
  // ─────────────────────────────────────────────
  {
    id: 'view.zoomIn',
    keys: ['Ctrl+=', 'Ctrl++'],
    label: 'Zoom In',
    category: 'View',
    context: 'global',
    preventDefault: true,
  },
  {
    id: 'view.zoomOut',
    keys: ['Ctrl+-'],
    label: 'Zoom Out',
    category: 'View',
    context: 'global',
    preventDefault: true,
  },
  {
    id: 'view.zoomReset',
    keys: ['Ctrl+0'],
    label: 'Reset Zoom',
    category: 'View',
    context: 'global',
    preventDefault: true,
  },

  // ─────────────────────────────────────────────
  // MIXER  (arrangement context)
  // ─────────────────────────────────────────────
  {
    id: 'lane.toggleMute',
    keys: ['m', 'M'],
    label: 'Toggle Mute on Focused Lane',
    category: 'Mixer',
    context: 'arrangement',
    preventDefault: true,
  },

  // ─────────────────────────────────────────────
  // MODAL  (modal context only)
  // ─────────────────────────────────────────────
  {
    id: 'modal.confirm',
    keys: ['Enter'],
    label: 'Confirm / Submit',
    category: 'Modal',
    context: 'modal',
    preventDefault: false,
  },
  {
    id: 'modal.dismiss',
    keys: ['Escape'],
    label: 'Dismiss / Cancel',
    category: 'Modal',
    context: 'modal',
    preventDefault: false,
  },
];

export default SHORTCUTS;
