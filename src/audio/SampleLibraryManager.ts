/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SampleLibraryManager — File System Access API utility for managing user sample folders.
 *
 * Provides native folder picking, recursive directory tree scanning, on-demand audio buffer
 * loading via FileSystemFileHandle, and IndexedDB persistence of directory handles across sessions.
 *
 * Falls back to <input type="file" webkitdirectory> for browsers without FSAA support (Firefox, Safari).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SampleNode {
  type: "folder" | "file";
  name: string;
  /** Virtual relative path for display and keying (e.g. "My Pack/Kicks/kick_01.wav") */
  path: string;
  /** Only present when using FSAA (null for fallback-imported files) */
  handle: FileSystemFileHandle | FileSystemDirectoryHandle | null;
  /** Populated only for folder nodes */
  children?: SampleNode[];
  /** For fallback-imported files: the raw File object */
  file?: File;
}

export interface UserFolder {
  name: string;
  handle: FileSystemDirectoryHandle | null;
  children: SampleNode[];
  /** Whether the browser still has read permission for this handle */
  authorized: boolean;
}

// Audio file extensions we recognize
const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a", ".webm"]);

function isAudioFile(name: string): boolean {
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) return false;
  return AUDIO_EXTENSIONS.has(name.slice(dotIdx).toLowerCase());
}

// ─── IndexedDB Helpers ───────────────────────────────────────────────────────

const IDB_NAME = "canvas-daw-sample-library";
const IDB_STORE = "directory-handles";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 2); // bump version to 2
    request.onupgradeneeded = () => {
      const db = request.result;
      // Delete old store if it exists with wrong schema
      if (db.objectStoreNames.contains(IDB_STORE)) {
        db.deleteObjectStore(IDB_STORE);
      }
      db.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandle(name: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, "readwrite");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.put(handle, name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteHandle(name: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, "readwrite");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.delete(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadHandles(): Promise<Record<string, FileSystemDirectoryHandle>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, "readonly");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.getAll();
    const keysRequest = store.getAllKeys();

    transaction.oncomplete = () => {
      const result: Record<string, FileSystemDirectoryHandle> = {};
      const keys = keysRequest.result;
      const values = request.result;
      for (let i = 0; i < keys.length; i++) {
        result[keys[i] as string] = values[i];
      }
      resolve(result);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

// ─── Manager Class ───────────────────────────────────────────────────────────

export class SampleLibraryManager {
  private folders: UserFolder[] = [];
  private onUpdateCallbacks: Set<() => void> = new Set();

  constructor() {
    this.restoreHandles();
  }

  public subscribe(callback: () => void): () => void {
    this.onUpdateCallbacks.add(callback);
    return () => {
      this.onUpdateCallbacks.delete(callback);
    };
  }

  private notify() {
    this.onUpdateCallbacks.forEach((cb) => cb());
  }

  public getFolders(): UserFolder[] {
    return this.folders;
  }

  public findNodeByPath(path: string): SampleNode | null {
    const search = (nodes: SampleNode[]): SampleNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    for (const folder of this.folders) {
      const found = search(folder.children);
      if (found) return found;
    }
    return null;
  }

  /**
   * Triggers native showDirectoryPicker() dialog and processes directory
   */
  public async addFolder(): Promise<void> {
    if (typeof (window as any).showDirectoryPicker === "undefined") {
      throw new Error("showDirectoryPicker is not supported in this browser");
    }

    try {
      const handle = await (window as any).showDirectoryPicker();

      // Check if already added
      if (this.folders.some((f) => f.name === handle.name)) {
        return;
      }

      const folder: UserFolder = {
        name: handle.name,
        handle,
        children: [],
        authorized: true,
      };

      folder.children = await this.scanDirectory(handle, handle.name);

      this.folders.push(folder);
      await saveHandle(handle.name, handle);
      this.notify();
    } catch (err) {
      console.error("Failed to add native directory", err);
      throw err;
    }
  }

  private async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    virtualParentPath: string,
    depth: number = 0
  ): Promise<SampleNode[]> {
    const nodes: SampleNode[] = [];
    if (depth > 10 || nodes.length > 5000) return nodes;

    try {
      for await (const entry of (dirHandle as any).values()) {
        const entryVirtualPath = `${virtualParentPath}/${entry.name}`;
        if (entry.kind === "directory") {
          const children = await this.scanDirectory(entry, entryVirtualPath, depth + 1);
          if (children.length > 0) {
            nodes.push({
              type: "folder",
              name: entry.name,
              path: entryVirtualPath,
              handle: entry,
              children,
            });
          }
        } else if (entry.kind === "file") {
          if (isAudioFile(entry.name)) {
            nodes.push({
              type: "file",
              name: entry.name,
              path: entryVirtualPath,
              handle: entry,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to scan entry", err);
    }

    // Folders first, files second, alphabetical sorted
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  public async removeFolder(folderIndex: number): Promise<void> {
    const folder = this.folders[folderIndex];
    if (folder) {
      this.folders.splice(folderIndex, 1);
      await deleteHandle(folder.name);
      this.notify();
    }
  }

  public async reauthorizeFolder(folderIndex: number): Promise<boolean> {
    const folder = this.folders[folderIndex];
    if (!folder || !folder.handle) return false;

    try {
      let authorized = false;

      try {
        const status = await (folder.handle as any).requestPermission({ mode: "read" });
        authorized = status === "granted";
      } catch (err) {
        // requestPermission not available — try scanning directly
        try {
          folder.children = await this.scanDirectory(folder.handle, folder.name);
          authorized = true;
        } catch (scanErr) {
          authorized = false;
        }
      }

      if (authorized) {
        folder.authorized = true;
        if (folder.children.length === 0) {
          folder.children = await this.scanDirectory(folder.handle, folder.name);
        }
        this.notify();
        return true;
      }
    } catch (err) {
      console.error("Failed to reauthorize folder", err);
    }
    return false;
  }

  private async restoreHandles(): Promise<void> {
    try {
      const handles = await loadHandles();
      const loadedFolders: UserFolder[] = [];

      for (const [name, handle] of Object.entries(handles)) {
        let authorized = false;
        let children: SampleNode[] = [];

        try {
          const permission = await (handle as any).queryPermission({ mode: "read" });
          authorized = permission === "granted";
        } catch (err) {
          // queryPermission not available on this handle — treat as unauthorized
          authorized = false;
        }

        if (authorized) {
          try {
            children = await this.scanDirectory(handle, name);
          } catch (err) {
            console.warn(`Failed to scan restored folder: ${name}`, err);
          }
        }

        loadedFolders.push({ name, handle, children, authorized });
      }

      this.folders = loadedFolders;
      this.notify();
    } catch (err) {
      console.error("Failed to restore directory handles", err);
      // Still notify so UI renders even if restore failed
      this.notify();
    }
  }

  /**
   * Standard webkitdirectory input fallback for Firefox/Safari
   */
  public addFilesFromFallback(files: FileList): void {
    if (files.length === 0) return;

    let folderName = "Imported Folder";
    const firstFile = files[0];
    if (firstFile.webkitRelativePath) {
      const parts = firstFile.webkitRelativePath.split("/");
      if (parts.length > 1) {
        folderName = parts[0];
      }
    }

    const rootNodes: SampleNode[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isAudioFile(file.name)) continue;

      const relativePath = file.webkitRelativePath || file.name;
      const parts = relativePath.split("/");
      const pathParts = parts.slice(1);

      let currentLevel = rootNodes;
      let currentVirtualPath = folderName;

      for (let j = 0; j < pathParts.length; j++) {
        const partName = pathParts[j];
        currentVirtualPath = `${currentVirtualPath}/${partName}`;
        const isLast = j === pathParts.length - 1;

        if (isLast) {
          currentLevel.push({
            type: "file",
            name: partName,
            path: currentVirtualPath,
            handle: null,
            file,
          });
        } else {
          let folderNode = currentLevel.find((n) => n.type === "folder" && n.name === partName);
          if (!folderNode) {
            folderNode = {
              type: "folder",
              name: partName,
              path: currentVirtualPath,
              handle: null,
              children: [],
            };
            currentLevel.push(folderNode);
          }
          currentLevel = folderNode.children!;
        }
      }
    }

    const sortTree = (nodes: SampleNode[]): SampleNode[] => {
      for (const node of nodes) {
        if (node.children) {
          node.children = sortTree(node.children);
        }
      }
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    const sortedChildren = sortTree(rootNodes);

    // Replace if exact duplicate name
    this.folders = this.folders.filter((f) => f.name !== folderName);

    this.folders.push({
      name: folderName,
      handle: null,
      children: sortedChildren,
      authorized: true,
    });

    this.notify();
  }

  public async loadBuffer(node: SampleNode): Promise<ArrayBuffer> {
    if (node.file) {
      return await node.file.arrayBuffer();
    } else if (node.handle && node.handle.kind === "file") {
      const fileHandle = node.handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    }
    throw new Error("No file or handle found for this sample node");
  }
}

let _libraryManager: SampleLibraryManager | null = null;
export function getLibraryManager(): SampleLibraryManager {
  if (!_libraryManager) {
    _libraryManager = new SampleLibraryManager();
  }
  return _libraryManager;
}
