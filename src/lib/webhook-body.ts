// Limits storage and parsing cost even when Content-Length is absent or false.
export const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function readWebhookBody(request: Request): Promise<string | null> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    return raw + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
