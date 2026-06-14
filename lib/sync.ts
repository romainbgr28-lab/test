import type { VideoSegment, SubtitleEntry } from "@/types";

/**
 * Redistribue proportionnellement les durées des segments sur la durée réelle
 * de l'audio. Le dernier segment absorbe le reste d'arrondi pour que la somme
 * des durées soit exactement égale à la durée audio (à 0,1s près).
 */
export function syncSegmentsToAudio(
  segments: VideoSegment[],
  audioDuration: number
): VideoSegment[] {
  const totalScriptDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  if (totalScriptDuration <= 0 || audioDuration <= 0) return segments;

  const sorted = [...segments].sort((a, b) => a.order - b.order);
  let allocated = 0;
  const durations = new Map<string, number>();
  sorted.forEach((segment, i) => {
    let duration: number;
    if (i === sorted.length - 1) {
      duration = Math.round((audioDuration - allocated) * 10) / 10;
    } else {
      duration = Math.round((segment.duration / totalScriptDuration) * audioDuration * 10) / 10;
    }
    duration = Math.max(0.1, duration);
    allocated += duration;
    durations.set(segment.id, duration);
  });

  return segments.map((segment) => ({
    ...segment,
    duration: durations.get(segment.id) ?? segment.duration,
  }));
}

export interface SyncReport {
  audioDuration: number;
  totalSegmentsDuration: number;
  driftSeconds: number;
  segmentCount: number;
  averageSegmentDuration: number;
  entries: {
    order: number;
    start: number;
    end: number;
    duration: number;
    wordCount: number;
    wordsPerSecond: number;
  }[];
}

/** Construit un rapport de synchronisation détaillé segment par segment. */
export function buildSyncReport(segments: VideoSegment[], audioDuration: number): SyncReport {
  const sorted = [...segments].sort((a, b) => a.order - b.order);
  let cursor = 0;
  const entries = sorted.map((segment) => {
    const start = cursor;
    cursor += segment.duration;
    const wordCount = segment.narration.split(/\s+/).filter(Boolean).length;
    return {
      order: segment.order,
      start,
      end: cursor,
      duration: segment.duration,
      wordCount,
      wordsPerSecond: segment.duration > 0 ? wordCount / segment.duration : 0,
    };
  });
  const totalSegmentsDuration = cursor;
  return {
    audioDuration,
    totalSegmentsDuration,
    driftSeconds: Math.abs(totalSegmentsDuration - audioDuration),
    segmentCount: sorted.length,
    averageSegmentDuration: sorted.length > 0 ? totalSegmentsDuration / sorted.length : 0,
    entries,
  };
}

/** Valide et normalise des sous-titres édités manuellement (tri, bornes, textes vides). */
export function normalizeSubtitles(subtitles: SubtitleEntry[]): SubtitleEntry[] {
  return subtitles
    .filter((s) => s.text.trim().length > 0 && s.end > s.start)
    .map((s) => ({ ...s, start: Math.max(0, s.start), text: s.text.trim() }))
    .sort((a, b) => a.start - b.start);
}
