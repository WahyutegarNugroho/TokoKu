/**
 * Escape HTML special characters to prevent XSS attacks.
 * Replaces &, <, >, ", ' with their HTML entity equivalents.
 * @param str - Raw string that may contain user-controlled data
 * @returns HTML-safe string
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Truncate a UUID to its first 8 characters and convert to uppercase.
 * Used for display purposes in receipts, invoices, and transaction lists.
 * @param id - Full UUID string
 * @returns Shortened ID (e.g., "A1B2C3D4")
 */
export function formatShortId(id: string): string {
  if (!id || id.length < 8) return '—';
  return id.slice(0, 8).toUpperCase();
}

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a number as Indonesian Rupiah currency string.
 * @param amount - Number to format
 * @returns Formatted string (e.g., "Rp 150.000")
 */
export function formatRupiah(amount: number): string {
  return `Rp ${rupiahFormatter.format(amount)}`;
}

/**
 * Escape a value for safe CSV output.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('\t')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Download an array of objects as a UTF-8 CSV file.
 * Creates a Blob with BOM for Excel compatibility and triggers download.
 */
export function exportCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sanitize error message for user display.
 * Logs full error to console, returns user-friendly message.
 * @param error - Error object or message string
 * @returns Safe, user-friendly error message
 */
export function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error details:', error);

  const lower = message.toLowerCase();
  if (lower.includes('sql') || lower.includes('query') || lower.includes('database') || lower.includes('constraint')) {
    return 'Terjadi kesalahan pada database. Tim teknis telah diberitahu.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return 'Koneksi terputus. Periksa koneksi internet Anda.';
  }
  if (lower.includes('auth') || lower.includes('session') || lower.includes('token') || lower.includes('login')) {
    return 'Sesi Anda telah berakhir. Silakan login kembali.';
  }
  return 'Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
}
