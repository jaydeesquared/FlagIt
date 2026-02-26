import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Convert any audio Blob to an MP3 Blob using the Web Audio API + lamejs.
 * Decodes the source blob to PCM via AudioContext, then encodes to MP3.
 */
export async function convertBlobToMp3(blob: Blob): Promise<Blob> {
  // Already MP3 — return as-is
  if (blob.type === "audio/mpeg") return blob;

  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const kbps = 128;

    if (channels === 1) {
      return encodeMono(audioBuffer.getChannelData(0), sampleRate, kbps);
    }

    // Stereo
    return encodeStereo(
      audioBuffer.getChannelData(0),
      audioBuffer.getChannelData(1),
      sampleRate,
      kbps,
    );
  } finally {
    await audioContext.close();
  }
}

function floatTo16Bit(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeMono(
  samples: Float32Array,
  sampleRate: number,
  kbps: number,
): Blob {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const int16 = floatTo16Bit(samples);
  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  for (let i = 0; i < int16.length; i += blockSize) {
    const chunk = int16.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) mp3Chunks.push(new Uint8Array(buf));
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Chunks.push(new Uint8Array(end));

  return new Blob(mp3Chunks as BlobPart[], { type: "audio/mpeg" });
}

function encodeStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  kbps: number,
): Blob {
  const encoder = new Mp3Encoder(2, sampleRate, kbps);
  const leftInt16 = floatTo16Bit(left);
  const rightInt16 = floatTo16Bit(right);
  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  for (let i = 0; i < leftInt16.length; i += blockSize) {
    const leftChunk = leftInt16.subarray(i, i + blockSize);
    const rightChunk = rightInt16.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (buf.length > 0) mp3Chunks.push(new Uint8Array(buf));
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Chunks.push(new Uint8Array(end));

  return new Blob(mp3Chunks as BlobPart[], { type: "audio/mpeg" });
}
