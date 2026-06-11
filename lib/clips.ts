import type { Clip, SubtitleEntry, VideoSegment } from "@/types";
import { uid } from "./utils";

export function buildClipsFromSegments(segments: VideoSegment[], _beatDuration: number): Clip[] {
  const clips: Clip[] = [];
  for (const segment of [...segments].sort((a, b) => a.order - b.order)) {
    const imgs: string[] =
      segment.imageUrls && segment.imageUrls.length > 0
        ? segment.imageUrls
        : [segment.imageBlob ?? segment.imageUrl ?? ""];
    const count = imgs.length;
    const baseDur = Math.round((segment.duration / count) * 10) / 10;
    let remaining = segment.duration;
    for (let i = 0; i < count; i++) {
      const dur = Math.max(0.1, i === count - 1 ? Math.round(remaining * 10) / 10 : baseDur);
      const slot = segment.imageSlots?.[i];
      clips.push({
        id: uid(),
        segmentId: segment.id,
        segmentOrder: segment.order,
        beatIndex: i,
        imageUrl: imgs[i] ?? "",
        duration: dur,
        narration: segment.narration,
        motionVideoUrl: slot?.motionVideoUrl,
        videoTrimStart: 0,
        videoTrimEnd: undefined,
      });
      remaining = Math.round((remaining - baseDur) * 10) / 10;
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
