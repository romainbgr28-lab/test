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
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60000) % 60;
  const h = Math.floor(totalMs / 3600000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}
