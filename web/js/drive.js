// Contract for the optional Google Drive integration (Google Identity Services token model,
// scope drive.file, Drive REST v3 from the browser; no server, no secret).
// Disabled when GOOGLE_CLIENT_ID in js/config.js is empty: isConfigured() returns false and the UI hides Drive.
//
// export function isConfigured(): boolean
// export async function connect(): Promise<void>          // loads accounts.google.com/gsi/client lazily, asks for a token
// export function isConnected(): boolean
// export function onStatusChange(cb: (status) => void)   // status: "disabled" | "disconnected" | "connected" | "expired" | "error"
// export async function backupExperiment(experiment): Promise<void>     // MotilityJ/Backups/<name>.motilityj.json, update in place
// export async function listBackups(): Promise<{id, name, modifiedTime}[]>
// export async function downloadBackup(id): Promise<object>
// export async function listInbox(): Promise<{id, name, thumbnailLink?, sidecar?}[]>   // MotilityJ/Inbox/ photos uploaded from phones
// export async function downloadFile(id): Promise<Blob>
// export async function uploadCapture(blob, sidecar): Promise<void>     // queued + retried when offline

import { GOOGLE_CLIENT_ID } from "./config.js";
export function isConfigured() { return Boolean(GOOGLE_CLIENT_ID); }
export function isConnected() { return false; }
export function onStatusChange() {}
