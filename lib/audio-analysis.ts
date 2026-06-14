/**
 * Analyse une piste audio décodée pour détecter les pauses naturelles entre phrases.
 * Retourne les frontières temporelles de chaque phrase détectée.
 */
export interface AudioPhrase {
  start: number; // secondes
  end: number;
}

export function detectPhrasesFromAudio(
  channelData: Float32Array,
  sampleRate: number,
  totalDuration: number,
  options?: { minSilenceMs?: number; thresholdRatio?: number }
): AudioPhrase[] {
  const windowMs = 40; // fenêtre RMS de 40ms
  const minSilenceMs = options?.minSilenceMs ?? 250;
  const thresholdRatio = options?.thresholdRatio ?? 0.08; // 8% du pic

  const windowSamples = Math.floor((sampleRate * windowMs) / 1000);

  // Calcul RMS par fenêtre
  const rms: number[] = [];
  for (let i = 0; i < channelData.length; i += windowSamples) {
    let sum = 0;
    const end = Math.min(i + windowSamples, channelData.length);
    for (let j = i; j < end; j++) sum += channelData[j] * channelData[j];
    rms.push(Math.sqrt(sum / (end - i)));
  }

  const maxRms = Math.max(...rms, 0.001);
  const threshold = maxRms * thresholdRatio;

  // Détection des régions de silence
  const silenceBoundaries: number[] = [];
  let silenceStartIdx: number | null = null;

  for (let i = 0; i < rms.length; i++) {
    if (rms[i] < threshold) {
      if (silenceStartIdx === null) silenceStartIdx = i;
    } else {
      if (silenceStartIdx !== null) {
        const silenceStartSec = (silenceStartIdx * windowSamples) / sampleRate;
        const silenceEndSec = (i * windowSamples) / sampleRate;
        const durationMs = (silenceEndSec - silenceStartSec) * 1000;
        if (durationMs >= minSilenceMs) {
          // Le point de coupure est le milieu du silence
          silenceBoundaries.push((silenceStartSec + silenceEndSec) / 2);
        }
        silenceStartIdx = null;
      }
    }
  }

  // Silence final
  if (silenceStartIdx !== null) {
    const silenceStartSec = (silenceStartIdx * windowSamples) / sampleRate;
    const durationMs = (totalDuration - silenceStartSec) * 1000;
    if (durationMs >= minSilenceMs) {
      silenceBoundaries.push((silenceStartSec + totalDuration) / 2);
    }
  }

  // Convertir en phrases : [0, b1, b2, ..., totalDuration]
  const allBoundaries = [0, ...silenceBoundaries, totalDuration];
  const phrases: AudioPhrase[] = [];
  for (let i = 0; i < allBoundaries.length - 1; i++) {
    const start = allBoundaries[i];
    const end = allBoundaries[i + 1];
    if (end - start > 0.2) {
      phrases.push({ start, end });
    }
  }

  return phrases.length > 0 ? phrases : [{ start: 0, end: totalDuration }];
}

/** Découpe un texte en phrases (par ligne, ponctuation forte). */
export function splitScriptIntoSentences(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Mappe N phrases texte sur M phrases audio détectées.
 * Si N === M : mapping 1:1 parfait.
 * Sinon : distribution proportionnelle au nombre de mots dans chaque phrase audio.
 */
export function mapSentencesToPhrases(
  sentences: string[],
  audioPhrases: AudioPhrase[]
): Array<{ text: string; start: number; end: number }> {
  if (sentences.length === 0 || audioPhrases.length === 0) return [];

  if (sentences.length === audioPhrases.length) {
    // Mapping parfait 1:1
    return sentences.map((text, i) => ({
      text,
      start: audioPhrases[i].start,
      end: audioPhrases[i].end,
    }));
  }

  // Distribuer les phrases texte sur les phrases audio
  // selon la proportion de mots de chaque segment de texte
  const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
  const totalAudioDuration = audioPhrases[audioPhrases.length - 1].end;

  let cursor = 0;
  return sentences.map((text, i) => {
    const words = text.split(/\s+/).length;
    const fraction = words / totalWords;
    const duration = fraction * totalAudioDuration;
    const start = cursor;
    const end = i === sentences.length - 1 ? totalAudioDuration : Math.min(cursor + duration, totalAudioDuration);
    cursor = end;
    return { text, start, end };
  });
}
