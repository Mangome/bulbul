import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';

export interface AvailableUpdateInfo {
  currentVersion: string;
  version: string;
  notes: string | null;
  publishedAt: string | null;
}

export type CheckForUpdateResult =
  | {
      available: false;
      currentVersion: string;
    }
  | {
      available: true;
      update: AvailableUpdateInfo;
    };

export interface InstallUpdateProgress {
  stage: 'downloading' | 'installing';
  downloadedBytes: number;
  totalBytes: number | null;
}

let pendingUpdate: Update | null = null;

export async function getCurrentVersion(): Promise<string> {
  return await getVersion();
}

export async function checkForUpdate(): Promise<CheckForUpdateResult> {
  const currentVersion = await getCurrentVersion();
  const update = await check();

  await disposePendingUpdate();

  if (!update) {
    return {
      available: false,
      currentVersion,
    };
  }

  pendingUpdate = update;

  return {
    available: true,
    update: {
      currentVersion,
      version: update.version,
      notes: update.body?.trim() || null,
      publishedAt: update.date ?? null,
    },
  };
}

export async function downloadAndInstallUpdate(
  onProgress?: (progress: InstallUpdateProgress) => void,
): Promise<void> {
  if (!pendingUpdate) {
    throw new Error('当前没有可安装的更新，请先检查更新。');
  }

  const update = pendingUpdate;
  let downloadedBytes = 0;
  let totalBytes: number | null = null;

  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === 'Started') {
        totalBytes = event.data.contentLength ?? null;
        onProgress?.({
          stage: 'downloading',
          downloadedBytes,
          totalBytes,
        });
        return;
      }

      if (event.event === 'Progress') {
        downloadedBytes += event.data.chunkLength;
        onProgress?.({
          stage: 'downloading',
          downloadedBytes,
          totalBytes,
        });
        return;
      }

      onProgress?.({
        stage: 'installing',
        downloadedBytes,
        totalBytes,
      });
    });

    await relaunch();
  } finally {
    pendingUpdate = null;
    await update.close().catch(() => undefined);
  }
}

async function disposePendingUpdate(): Promise<void> {
  if (!pendingUpdate) {
    return;
  }

  const previousUpdate = pendingUpdate;
  pendingUpdate = null;
  await previousUpdate.close().catch(() => undefined);
}
