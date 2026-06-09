import type { Clip, SubtitleEntry, VideoSegment } from "@/types";
import { uid } from "./utils";

export function buildClipsFromSegments(segments: VideoSegment[], beatDuration: number): Clip[] {
  const clips: Clip[] = [];
  for (const segment of [...segments].sort((a, b) => a.order - b.order)) {
    const imgs: string[] =
      segment.imageUrls && segment.imageUrls.length > 0
        ? segment.imageUrls
        : [segment.imageBlob ?? segment.imageUrl ?? ""];
    let remaining = segment.duration;
    let beatIndex = 0;
    while (remaining > 0.05) {
      const dur = Math.round(Math.min(beatDuration, remaining) * 10) / 10;
      clips.push({
        id: uid(),
        segmentId: segment.id,
        segmentOrder: segment.order,
        beatIndex,
        imageUrl: imgs[beatIndex % imgs.length] ?? "",
        duration: dur,
        narration: segment.narration,
      });
      remaining = Math.round((remaining - dur) * 10) / 10;
      beatIndex++;
    }
  }
  return clips;
}

export function syncClipsToAudio(clips: Clip[], audioDuration: number): Clip[] {
  const total = clips.reduce((s, c) => s + c.duration, 0);
  if (total <= 0 || audioDuration <= 0) return clips;
  let allocated = 0;
  return clips.map((clip, i) => {
    let duration: number;
    if (i === clips.length - 1) {
      duration = Math.max(0.1, Math.round((audioDuration - allocated) * 10) / 10);
    } else {
      duration = Math.max(0.1, Math.round((clip.duration / total) * audioDuration * 10) / 10);
    }
    allocated += duration;
    return { ...clip, duration };
  });
}

export function generateSubtitlesFromClips(clips: Clip[]): SubtitleEntry[] {
  const subs: SubtitleEntry[] = [];
  let cursor = 0;
  let i = 0;
  while (i < clips.length) {
    const segId = clips[i].segmentId;
    const narration = clips[i].narration;
    const start = cursor;
    while (i < clips.length && clips[i].segmentId === segId) {
      cursor += clips[i].duration;
      i++;
    }
    if (narration.trim()) subs.push({ start, end: cursor, text: narration });
  }
  return subs;
}

export function getClipStartTime(clips: Clip[], clipId: string): number {
  let t = 0;
  for (const c of clips) {
    if (c.id === clipId) return t;
    t += c.duration;
  }
  return 0;
}

export function getTotalDuration(clips: Clip[]): number {
  return clips.reduce((s, c) => s + c.duration, 0);
}
