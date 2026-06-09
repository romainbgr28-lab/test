import type { VideoSegment, SubtitleEntry } from "@/types";

export function generateSubtitles(segments: VideoSegment[]): SubtitleEntry[] {
  let cursor = 0;
  return [...segments].sort((a, b) => a.order - b.order).map((segment) => {
    const entry: SubtitleEntry = {
      start: cursor,
      end: cursor + segment.duration,
      text: segment.narration,
    };
    cursor += segment.duration;
    return entry;
  });
}

export function toSRT(subtitles: SubtitleEntry[]): string {
  return subtitles
    .map((sub, i) => {
      const start = formatSRTTime(sub.start);
      const end = formatSRTTime(sub.end);
      return `${i + 1}\n${start} --> ${end}\n${sub.text}\n`;
    })
    .join("\n");
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}
