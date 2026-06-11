import type { VideoSegment, SubtitleEntry, VideoRenderOptions } from "@/types";
import { generateSubtitles } from "./subtitles";

export interface Beat {
  startTime: number;
  endTime: number;
  imageUrl: string;
  videoUrl?: string;
  videoTrimStart?: number;
  startScale: number;
  endScale: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Ken Burns trajectories — alternated to feel dynamic
const TRAJECTORIES: Omit<Beat, "startTime" | "endTime" | "imageUrl">[] = [
  { startScale: 1.0, endScale: 1.12, startX: 0.5, startY: 0.5, endX: 0.5, endY: 0.5 },   // zoom-in center
  { startScale: 1.12, endScale: 1.0, startX: 0.5, startY: 0.5, endX: 0.5, endY: 0.5 },   // zoom-out center
  { startScale: 1.08, endScale: 1.18, startX: 0.1, startY: 0.2, endX: 0.9, endY: 0.3 },  // zoom-in + pan right
  { startScale: 1.08, endScale: 1.18, startX: 0.9, startY: 0.2, endX: 0.1, endY: 0.3 },  // zoom-in + pan left
  { startScale: 1.15, endScale: 1.05, startX: 0.5, startY: 0.1, endX: 0.5, endY: 0.9 },  // zoom-out + tilt down
  { startScale: 1.15, endScale: 1.05, startX: 0.5, startY: 0.9, endX: 0.5, endY: 0.1 },  // zoom-out + tilt up
  { startScale: 1.05, endScale: 1.15, startX: 0.0, startY: 0.5, endX: 1.0, endY: 0.5 },  // pan right wide
  { startScale: 1.05, endScale: 1.15, startX: 1.0, startY: 0.5, endX: 0.0, endY: 0.5 },  // pan left wide
];

export function buildBeats(segments: VideoSegment[], beatDuration: number): Beat[] {
  const beats: Beat[] = [];
  let cursor = 0;
  let ti = 0;

  for (const segment of [...segments].sort((a, b) => a.order - b.order)) {
    const fallback = segment.imageBlob || segment.imageUrl || "";
    const imgs = segment.imageUrls && segment.imageUrls.length > 0 ? segment.imageUrls : [fallback];
    let t = cursor;
    const segEnd = cursor + segment.duration;
    let beatIndexInSeg = 0;
    while (t < segEnd - 0.01) {
      const beatEnd = Math.min(t + beatDuration, segEnd);
      const imgUrl = imgs[beatIndexInSeg % imgs.length];
      beats.push({ startTime: t, endTime: beatEnd, imageUrl: imgUrl, ...TRAJECTORIES[ti % TRAJECTORIES.length] });
      ti++;
      beatIndexInSeg++;
      t = beatEnd;
    }
    cursor = segEnd;
  }
  return beats;
}

export async function loadImages(segments: VideoSegment[]): Promise<Map<string, HTMLImageElement>> {
  const urls = [
    ...new Set(
      segments.flatMap((s) =>
        s.imageUrls && s.imageUrls.length > 0
          ? s.imageUrls
          : [s.imageBlob || s.imageUrl || ""]
      ).filter(Boolean)
    ),
  ];
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { map.set(url, img); resolve(); };
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
  return map;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function drawImageKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  beat: Beat,
  progress: number,
  enabled: boolean
) {
  const ep = enabled ? easeInOut(progress) : 0.5;
  const scale = lerp(beat.startScale, beat.endScale, ep);
  const px = lerp(beat.startX, beat.endX, ep);
  const py = lerp(beat.startY, beat.endY, ep);

  const baseScale = Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
  const totalScale = baseScale * scale;
  const sw = img.naturalWidth * totalScale;
  const sh = img.naturalHeight * totalScale;
  const excessX = sw - canvasW;
  const excessY = sh - canvasH;
  const x = -excessX * px;
  const y = -excessY * py;
  ctx.drawImage(img, x, y, sw, sh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3); // max 3 lines
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  text: string
) {
  const fontSize = Math.max(24, Math.round(canvasW * 0.042));
  ctx.font = `bold ${fontSize}px system-ui, Arial, sans-serif`;
  const maxWidth = canvasW * 0.86;
  const lines = wrapText(ctx, text, maxWidth);
  const lineH = fontSize * 1.35;
  const pad = fontSize * 0.55;
  const blockH = lines.length * lineH + pad * 2;
  const blockY = canvasH - blockH - fontSize * 1.1;

  // Background
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  const bx = canvasW * 0.07;
  const bw = canvasW * 0.86;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(bx + r, blockY);
  ctx.lineTo(bx + bw - r, blockY);
  ctx.arcTo(bx + bw, blockY, bx + bw, blockY + r, r);
  ctx.lineTo(bx + bw, blockY + blockH - r);
  ctx.arcTo(bx + bw, blockY + blockH, bx + bw - r, blockY + blockH, r);
  ctx.lineTo(bx + r, blockY + blockH);
  ctx.arcTo(bx, blockY + blockH, bx, blockY + blockH - r, r);
  ctx.lineTo(bx, blockY + r);
  ctx.arcTo(bx, blockY, bx + r, blockY, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Text
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize}px system-ui, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 8;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvasW / 2, blockY + pad + i * lineH);
  });
  ctx.restore();
}

const TRANSITION_DURATION = 0.35;

function drawBeatMedia(
  ctx: CanvasRenderingContext2D,
  beat: Beat,
  images: Map<string, HTMLImageElement>,
  videos: Map<string, HTMLVideoElement>,
  canvasW: number,
  canvasH: number,
  progress: number,
  kenBurns: boolean
) {
  if (beat.videoUrl) {
    const vid = videos.get(beat.videoUrl);
    if (vid) {
      drawImageKenBurns(ctx, vid as unknown as HTMLImageElement, canvasW, canvasH, beat, progress, kenBurns);
      return;
    }
  }
  const img = images.get(beat.imageUrl);
  if (img) drawImageKenBurns(ctx, img, canvasW, canvasH, beat, progress, kenBurns);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  beats: Beat[],
  images: Map<string, HTMLImageElement>,
  currentTime: number,
  subtitles: SubtitleEntry[],
  options: VideoRenderOptions,
  videos: Map<string, HTMLVideoElement> = new Map()
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const bi = beats.findIndex((b) => currentTime >= b.startTime && currentTime < b.endTime);
  if (bi === -1) {
    // After last beat: show last frame frozen
    if (beats.length > 0 && currentTime >= beats[beats.length - 1].endTime) {
      const beat = beats[beats.length - 1];
      drawBeatMedia(ctx, beat, images, videos, canvasW, canvasH, 1, options.kenBurns);
    }
    return;
  }

  const beat = beats[bi];
  const beatProgress = (currentTime - beat.startTime) / (beat.endTime - beat.startTime);

  // Draw current beat
  drawBeatMedia(ctx, beat, images, videos, canvasW, canvasH, beatProgress, options.kenBurns);

  // Transition: crossfade to next beat at end of current beat
  if (options.transitions && bi < beats.length - 1) {
    const timeToEnd = beat.endTime - currentTime;
    if (timeToEnd < TRANSITION_DURATION) {
      const alpha = 1 - timeToEnd / TRANSITION_DURATION;
      const nextBeat = beats[bi + 1];
      ctx.save();
      ctx.globalAlpha = alpha;
      drawBeatMedia(ctx, nextBeat, images, videos, canvasW, canvasH, 0, options.kenBurns);
      ctx.restore();
    }
  }

  // Subtitles
  if (options.subtitleStyle !== "none") {
    const sub = subtitles.find((s) => currentTime >= s.start && currentTime < s.end);
    if (sub) drawSubtitles(ctx, canvasW, canvasH, sub.text);
  }
}

export function getTotalDuration(segments: VideoSegment[]): number {
  return segments.reduce((sum, s) => sum + s.duration, 0);
}

export { generateSubtitles };

// ─── Clip-based beat builder ─────────────────────────────────────────────────

interface ClipLike {
  imageUrl: string;
  duration: number;
  motionVideoUrl?: string;
  videoTrimStart?: number;
}

export function clipsToBeats(clips: ClipLike[]): Beat[] {
  let cursor = 0;
  return clips.map((clip, i) => {
    const traj = TRAJECTORIES[i % TRAJECTORIES.length];
    const beat: Beat = {
      startTime: cursor,
      endTime: cursor + clip.duration,
      imageUrl: clip.imageUrl,
      videoUrl: clip.motionVideoUrl,
      videoTrimStart: clip.videoTrimStart ?? 0,
      ...traj,
    };
    cursor += clip.duration;
    return beat;
  });
}

export async function loadVideos(clips: ClipLike[]): Promise<Map<string, HTMLVideoElement>> {
  const urls = [...new Set(clips.map((c) => c.motionVideoUrl).filter(Boolean) as string[])];
  const map = new Map<string, HTMLVideoElement>();
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const vid = document.createElement("video");
          vid.crossOrigin = "anonymous";
          vid.preload = "auto";
          vid.muted = true;
          vid.onloadeddata = () => { map.set(url, vid); resolve(); };
          vid.onerror = () => resolve();
          vid.src = url;
        })
    )
  );
  return map;
}
