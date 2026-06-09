import type { VideoSegment } from "@/types";

export function syncSegmentsToAudio(
  segments: VideoSegment[],
  audioDuration: number
): VideoSegment[] {
  const totalScriptDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  return segments.map((segment) => ({
    ...segment,
    duration: Math.round((segment.duration / totalScriptDuration) * audioDuration * 10) / 10,
  }));
}
