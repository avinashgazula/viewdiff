/**
 * Encode / decode diff content for shareable URLs.
 * Uses base64 over the compressed bytes to keep it URL-safe.
 */

export async function encodeDiff(original: string, modified: string): Promise<string> {
  const payload = JSON.stringify({ o: original, m: modified })
  const bytes = new TextEncoder().encode(payload)

  // Use CompressionStream when available (all modern browsers)
  if (typeof CompressionStream !== 'undefined') {
    return compressToBase64(bytes)
  }
  return btoa(String.fromCharCode(...bytes))
}

async function compressToBase64(data: Uint8Array): Promise<string> {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  void writer.write(data as unknown as BufferSource)
  void writer.close()

  const chunks: Uint8Array[] = []
  const reader = cs.readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return btoa(String.fromCharCode(...merged))
}

export async function decodeDiff(encoded: string): Promise<{ original: string; modified: string } | null> {
  try {
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))

    // Try gzip decompression first
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('gzip')
        const writer = ds.writable.getWriter()
        void writer.write(bytes as unknown as BufferSource)
        void writer.close()

        const chunks: Uint8Array[] = []
        const reader = ds.readable.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }

        const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
        const merged = new Uint8Array(totalLen)
        let offset = 0
        for (const chunk of chunks) {
          merged.set(chunk, offset)
          offset += chunk.length
        }

        const json = new TextDecoder().decode(merged)
        const parsed = JSON.parse(json)
        return { original: parsed.o ?? '', modified: parsed.m ?? '' }
      } catch {
        // Not gzip — try raw base64
      }
    }

    // Fallback: raw base64 (no compression)
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)
    return { original: parsed.o ?? '', modified: parsed.m ?? '' }
  } catch {
    return null
  }
}

export function buildShareUrl(slug: string, encoded: string): string {
  const base = window.location.origin + slug
  return `${base}?d=${encodeURIComponent(encoded)}`
}

/** Encode a single string (e.g. a git patch) for a shareable URL */
export async function encodeText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  if (typeof CompressionStream !== 'undefined') {
    return compressToBase64(bytes)
  }
  return btoa(String.fromCharCode(...bytes))
}

/** Decode a single string encoded by encodeText */
export async function decodeText(encoded: string): Promise<string | null> {
  try {
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('gzip')
        const writer = ds.writable.getWriter()
        void writer.write(bytes as unknown as BufferSource)
        void writer.close()

        const chunks: Uint8Array[] = []
        const reader = ds.readable.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }

        const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
        const merged = new Uint8Array(totalLen)
        let offset = 0
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
        return new TextDecoder().decode(merged)
      } catch { /* not gzip */ }
    }

    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}
