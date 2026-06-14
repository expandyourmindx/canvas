/**
 * CloudSampleCache — IndexedDB cache for cloud sample ArrayBuffers.
 * Separate from canvas-daw-sample-library to avoid schema conflicts.
 */

const DB_NAME = "canvas-cloud-sample-cache";
const STORE_NAME = "buffers";
const DB_VERSION = 1;

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCloudSampleCache(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[CloudSampleCache] get failed:", err);
    return null;
  }
}

export async function setCloudSampleCache(url: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(buffer.slice(0), url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[CloudSampleCache] set failed:", err);
  }
}
