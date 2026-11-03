// Browser-side media helpers for Food Shorts: read a video's length and first frame
// before upload, and keep demo-mode videos in IndexedDB (localStorage is far too
// small for video). Nothing here talks to the server.
import { checkVideoDuration, checkVideoFile } from "@/lib/food-shorts-rules";

export type VideoInspection = { durationS: number; width: number; height: number; thumbDataUrl: string };

/** Validates type, size and length, and captures a small JPEG poster from the video. */
export async function inspectVideo(file: File): Promise<VideoInspection> {
  const fileCheck = checkVideoFile(file);
  if (!fileCheck.ok) throw new Error(fileCheck.message);
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata"; video.muted = true; video.playsInline = true; video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("That video could not be opened. Try an MP4 recorded on your phone")), 15_000);
      video.onloadedmetadata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new Error("That video could not be opened. Try an MP4 recorded on your phone")); };
    });
    // MediaRecorder WebM files report Infinity until the end is seeked to.
    if (!Number.isFinite(video.duration)) {
      video.currentTime = 1e7;
      await new Promise<void>((resolve) => { video.ontimeupdate = () => { video.ontimeupdate = null; resolve(); }; window.setTimeout(resolve, 3000); });
    }
    const durationS = Math.round(video.duration * 100) / 100;
    const durationCheck = checkVideoDuration(durationS);
    if (!durationCheck.ok) throw new Error(durationCheck.message);
    const target = Math.min(0.5, Math.max(0, durationS / 2));
    video.currentTime = target;
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); window.setTimeout(resolve, 3000); });
    const width = video.videoWidth || 360, height = video.videoHeight || 640;
    const scale = Math.min(1, 480 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { durationS, width, height, thumbDataUrl: canvas.toDataURL("image/jpeg", 0.78) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- demo-mode video store (IndexedDB) ----
const DB_NAME = "sheplates-food-shorts", STORE = "videos";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveLocalVideo(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(blob, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  } catch { /* private mode / quota: the short still works for this session */ }
}
export async function loadLocalVideoUrl(key: string): Promise<string | undefined> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => { const req = db.transaction(STORE).objectStore(STORE).get(key); req.onsuccess = () => resolve(req.result as Blob | undefined); req.onerror = () => reject(req.error); });
    db.close();
    return blob ? URL.createObjectURL(blob) : undefined;
  } catch { return undefined; }
}
export async function deleteLocalVideo(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
    db.close();
  } catch { /* nothing to delete */ }
}
