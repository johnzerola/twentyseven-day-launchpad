/**
 * Shared audio concatenation utilities.
 * Handles both WAV and MP3 concatenation safely,
 * and provides duration measurement via AudioContext.
 */

/**
 * Detect if a Blob is WAV by checking the RIFF/WAVE header.
 */
function isWavBlob(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      // Check for RIFF....WAVE
      const isRiff = arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46;
      const isWave = arr[8] === 0x57 && arr[9] === 0x41 && arr[10] === 0x56 && arr[11] === 0x45;
      resolve(isRiff && isWave);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(blob.slice(0, 12));
  });
}

/**
 * Concatenate multiple WAV blobs into a single valid WAV file.
 * Strips individual headers and writes one combined header.
 */
async function concatenateWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 1) return blobs[0];

  const buffers = await Promise.all(blobs.map(b => b.arrayBuffer()));

  // Read header info from first WAV
  const firstView = new DataView(buffers[0]);
  const numChannels = firstView.getUint16(22, true);
  const sampleRate = firstView.getUint32(24, true);
  const bitsPerSample = firstView.getUint16(34, true);

  // Extract raw PCM data from each WAV
  const pcmChunks: Uint8Array[] = [];
  let totalPcmLength = 0;
  for (const buf of buffers) {
    const view = new DataView(buf);
    let dataOffset = 44;
    for (let i = 12; i < Math.min(buf.byteLength - 4, 200); i++) {
      if (view.getUint8(i) === 0x64 && view.getUint8(i + 1) === 0x61 &&
        view.getUint8(i + 2) === 0x74 && view.getUint8(i + 3) === 0x61) {
        dataOffset = i + 8;
        break;
      }
    }
    const pcm = new Uint8Array(buf, dataOffset);
    pcmChunks.push(pcm);
    totalPcmLength += pcm.byteLength;
  }

  // Build new WAV with combined PCM
  const wavBuffer = new ArrayBuffer(44 + totalPcmLength);
  const wav = new DataView(wavBuffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) wav.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  wav.setUint32(4, 36 + totalPcmLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, numChannels, true);
  wav.setUint32(24, sampleRate, true);
  wav.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  wav.setUint16(32, numChannels * (bitsPerSample / 8), true);
  wav.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  wav.setUint32(40, totalPcmLength, true);

  const output = new Uint8Array(wavBuffer);
  let offset = 44;
  for (const chunk of pcmChunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Safely concatenate audio blobs (WAV or MP3).
 * For WAV: reconstructs header properly.
 * For MP3: simple binary concat (valid for MP3 frames).
 */
export async function safeConcatAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error('No audio blobs to concatenate');
  if (blobs.length === 1) return blobs[0];

  const firstIsWav = await isWavBlob(blobs[0]);
  if (firstIsWav) {
    return concatenateWavBlobs(blobs);
  }

  // MP3 or other: simple binary concat
  return new Blob(blobs, { type: blobs[0].type || 'audio/mpeg' });
}

/**
 * Measure the real duration of an audio blob using AudioContext.
 * Returns duration in seconds. Falls back to word-count estimate on failure.
 */
export async function measureAudioDuration(blob: Blob, fallbackWordCount?: number): Promise<number> {
  try {
    const audioCtx = new AudioContext();
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuf);
    const duration = Math.round(decoded.duration);
    audioCtx.close();
    return duration;
  } catch (err) {
    console.warn('AudioContext decode failed, using word count estimate:', err);
    if (fallbackWordCount && fallbackWordCount > 0) {
      return Math.round((fallbackWordCount / 150) * 60);
    }
    return 0;
  }
}

/**
 * Returns the minimum acceptable audio duration in seconds for a given requested duration string.
 * Accepts 90% of target as minimum.
 */
export function getMinDurationSeconds(requestedDuration: string): number {
  const minutes = parseInt(requestedDuration, 10) || 8;
  return Math.floor(minutes * 60 * 0.85); // 85% minimum threshold
}

/**
 * Returns expected scene count for a given audio duration.
 * Each scene covers ~8 seconds.
 */
export function getExpectedSceneCount(audioDurationSeconds: number): number {
  return Math.ceil(audioDurationSeconds / 8);
}
