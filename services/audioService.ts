
/**
 * Converts a Float32Array (Web Audio API standard) to Int16Array (required by LameJS)
 * Clamps values to the range [-1, 1] before scaling.
 */
const convertBuffer = (buffer: Float32Array): Int16Array => {
  const len = buffer.length;
  const result = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let sample = buffer[i];
    // Clamp
    if (sample > 1) sample = 1;
    else if (sample < -1) sample = -1;
    // Scale
    result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return result;
};

/**
 * Decodes audio file, slices a random 15s segment, and re-encodes to MP3.
 */
export const processAudioFile = async (
  file: File,
  targetDurationSec: number = 15
): Promise<{ blob: Blob; startTime: number; duration: number }> => {
  
  // 1. Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // 2. Decode Audio
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;
  
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    audioCtx.close();
    throw new Error('Failed to decode audio file. It might be corrupted or an unsupported format.');
  }

  // 3. Determine Random Start Time
  const fileDuration = audioBuffer.duration;
  let startTime = 0;
  
  if (fileDuration > targetDurationSec) {
    const maxStart = fileDuration - targetDurationSec;
    startTime = Math.random() * maxStart;
  }
  
  // Real output duration (might be less than 15s if file is short)
  const outputDuration = Math.min(fileDuration, targetDurationSec);

  // 4. Extract Channels
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  
  // Calculate start and end samples
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor((startTime + outputDuration) * sampleRate);
  const lengthSamples = endSample - startSample;

  const leftChannelRaw = audioBuffer.getChannelData(0).slice(startSample, endSample);
  const rightChannelRaw = numChannels > 1 
    ? audioBuffer.getChannelData(1).slice(startSample, endSample) 
    : undefined;

  // Cleanup AudioContext
  await audioCtx.close();

  // 5. Encode to MP3 using lamejs
  // Access global lamejs loaded via script tag to avoid ESM "MPEGMode not defined" error
  const lamejs = (window as any).lamejs;
  if (!lamejs) {
    throw new Error('lamejs library not loaded. Please refresh the page.');
  }

  // @ts-ignore
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128); // 128kbps

  const leftData = convertBuffer(leftChannelRaw);
  const rightData = rightChannelRaw ? convertBuffer(rightChannelRaw) : undefined;

  const mp3Data: Int8Array[] = [];

  // Encode in chunks to prevent blocking (though we are in a promise here, 
  // for 15s clips it's fast enough to do in one go for most devices).
  const sampleBlockSize = 1152; // multiple of 576
  
  for (let i = 0; i < lengthSamples; i += sampleBlockSize) {
    const leftChunk = leftData.subarray(i, i + sampleBlockSize);
    let mp3buf;
    
    if (numChannels === 2 && rightData) {
      const rightChunk = rightData.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }
    
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  // Flush
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  const blob = new Blob(mp3Data, { type: 'audio/mp3' });

  return {
    blob,
    startTime,
    duration: outputDuration
  };
};
