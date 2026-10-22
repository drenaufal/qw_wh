/**
 * Timezone and duration utilities according to PRD standards (Asia/Jakarta WIB UTC+7)
 */

export function formatWIB(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return '-';
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date) + ' WIB';
}

export function formatWIBTimeOnly(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return '-';
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Formats duration in seconds as:
 * Under 1 hour: 05m 32s
 * Over 1 hour:  01h 14m 20s
 */
export function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || seconds < 0) return '00m 00s';
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
  }
  return `${pad(mins)}m ${pad(secs)}s`;
}

/**
 * Calculates live elapsed seconds from a start timestamp until now
 */
export function getElapsedSeconds(startTimeStr?: string | null): number {
  if (!startTimeStr) return 0;
  const start = new Date(startTimeStr).getTime();
  if (isNaN(start)) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / 1000));
}

