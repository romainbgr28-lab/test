import type { Platform, VideoSegment, VideoRenderOptions } from "@/types";

export interface RenderInput {
  segments: VideoSegment[];
  voiceoverUrl?: string;
  platform: Platform;
  options: VideoRenderOptions;
  onProgress?: (ratio: number, label: string) => void;
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
}

function renderDimensions(platform: Platform): { width: number; height: number } {
  if (platform === "youtube") return { width: 1280, height: 720 };
  return { width: 720, height: 1280 };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger une image du segment."));
    img.src = src;
  });
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Impossible de charger un fichier audio.");
  return res.arrayBuffer();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  alpha: number
) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let drawW: number;
  let drawH: number;
  if (imgRatio > canvasRatio) {
    drawH = h * zoom;
    drawW = drawH * imgRatio;
  } else {
    drawW = w * zoom;
    drawH = drawW / imgRatio;
  }
  const dx = (w - drawW) / 2 + panX;
  const dy = (h - drawH) / 2 + panY;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

interface CaptionSegment {
  words: CaptionWord[];
  start: number;
  end: number;
}

function buildCaptions(segments: VideoSegment[]): CaptionSegment[] {
  const ordered = [...segments].sort((a, b) => a.order - b.order);
  const result: CaptionSegment[] = [];
  let cursor = 0;
  for (const seg of ordered) {
    const words = (seg.narration || "").trim().split(/\s+/).filter(Boolean);
    const segStart = cursor;
    const segEnd = cursor + seg.duration;
    const per = words.length > 0 ? seg.duration / words.length : seg.duration;
    const captionWords: CaptionWord[] = words.map((text, i) => ({
      text,
      start: segStart + i * per,
      end: segStart + (i + 1) * per,
    }));
    result.push({ words: captionWords, start: segStart, end: segEnd });
    cursor = segEnd;
  }
  return result;
}

function wrapWords(words: string[], maxPerLine: number): string[][] {
  const lines: string[][] = [];
  for (let i = 0; i < words.length; i += maxPerLine) {
    lines.push(words.slice(i, i + maxPerLine));
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  caption: CaptionSegment,
  t: number,
  w: number,
  h: number,
  style: "karaoke" | "block"
) {
  if (caption.words.length === 0) return;
  const fontSize = Math.round(w * 0.058);
  ctx.font = `800 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const activeIndex = caption.words.findIndex((word) => t >= word.start && t < word.end);
  const currentIndex = activeIndex === -1 ? (t >= caption.end ? caption.words.length - 1 : 0) : activeIndex;

  const maxPerLine = 4;
  const lines = wrapWords(
    caption.words.map((word) => word.text),
    maxPerLine
  );
  const currentLineIndex = Math.floor(currentIndex / maxPerLine);
  const line = lines[currentLineIndex] ?? [];
  const lineStartWordIndex = currentLineIndex * maxPerLine;

  const baseY = h * 0.72;
  const spaceWidth = ctx.measureText(" ").width;
  const wordWidths = line.map((word) => ctx.measureText(word).width);
  const totalWidth = wordWidths.reduce((a, b) => a + b, 0) + spaceWidth * Math.max(0, line.length - 1);
  let x = w / 2 - totalWidth / 2;

  for (let i = 0; i < line.length; i++) {
    const globalIndex = lineStartWordIndex + i;
    const isActive = style === "karaoke" && globalIndex === currentIndex;
    const wordWidth = wordWidths[i];
    const cx = x + wordWidth / 2;

    if (isActive) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      const padX = fontSize * 0.18;
      const padY = fontSize * 0.12;
      roundRect(ctx, cx - wordWidth / 2 - padX, baseY - fontSize / 2 - padY, wordWidth + padX * 2, fontSize + padY * 2, fontSize * 0.18);
      ctx.fill();
      ctx.restore();
    }

    ctx.lineWidth = fontSize * 0.16;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(line[i], cx, baseY);
    ctx.fillStyle = isActive ? "#ffe14d" : "#ffffff";
    ctx.fillText(line[i], cx, baseY);

    x += wordWidth + spaceWidth;
  }
}

function pickMimeType(): { mimeType: string; isNativeMP4: boolean } {
  if (typeof MediaRecorder === "undefined") return { mimeType: "video/webm", isNativeMP4: false };

  const mp4Candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  for (const type of mp4Candidates) {
    if (MediaRecorder.isTypeSupported(type)) return { mimeType: type, isNativeMP4: true };
  }

  const webmCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of webmCandidates) {
    if (MediaRecorder.isTypeSupported(type)) return { mimeType: type, isNativeMP4: false };
  }
  return { mimeType: "video/webm", isNativeMP4: false };
}

async function convertWebmToMp4(webm: Blob, onProgress?: (ratio: number, label: string) => void): Promise<Blob | null> {
  try {
    onProgress?.(0.88, "Chargement du convertisseur MP4...");
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();

    const cdnBases = [
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd",
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd",
    ];

    let loaded = false;
    for (const baseURL of cdnBases) {
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        loaded = true;
        break;
      } catch {
        // try next CDN
      }
    }
    if (!loaded) throw new Error("Impossible de charger FFmpeg depuis les CDN disponibles.");

    onProgress?.(0.92, "Conversion en MP4...");
    await ffmpeg.writeFile("input.webm", await fetchFile(webm));
    await ffmpeg.exec([
      "-i", "input.webm",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "192k",
      "output.mp4",
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const mp4Blob = new Blob([bytes as BlobPart], { type: "video/mp4" });
    if (mp4Blob.size < 1000) throw new Error("Fichier MP4 généré vide ou invalide.");
    return mp4Blob;
  } catch (error) {
    console.error("Conversion MP4 échouée :", error);
    return null;
  }
}

export async function renderVideo(input: RenderInput): Promise<RenderResult> {
  const { segments, voiceoverUrl, platform, options, onProgress } = input;
  const ordered = [...segments].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) throw new Error("Aucun segment à monter.");

  const { width, height } = renderDimensions(platform);
  const fps = 30;
  const totalDuration = ordered.reduce((sum, s) => sum + s.duration, 0);
  const transitionDuration = options.transitions ? 0.5 : 0;

  onProgress?.(0.02, "Chargement des images...");
  const images = await Promise.all(
    ordered.map((seg) => (seg.imageUrl ? loadImage(seg.imageUrl) : Promise.reject(new Error("Une image manque."))))
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (!ctx) throw new Error("Canvas indisponible.");

  const captions = buildCaptions(ordered);

  const AudioCtx: typeof AudioContext =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();
  const audioDest = audioContext.createMediaStreamDestination();

  const audioSources: AudioBufferSourceNode[] = [];

  if (voiceoverUrl) {
    try {
      const buf = await audioContext.decodeAudioData(await fetchArrayBuffer(voiceoverUrl));
      const source = audioContext.createBufferSource();
      source.buffer = buf;
      source.connect(audioDest);
      audioSources.push(source);
    } catch (error) {
      console.error("Voix off non décodée :", error);
    }
  }

  if (options.musicUrl) {
    try {
      const buf = await audioContext.decodeAudioData(await fetchArrayBuffer(options.musicUrl));
      const source = audioContext.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const gain = audioContext.createGain();
      gain.gain.value = Math.max(0, Math.min(1, options.musicVolume));
      source.connect(gain).connect(audioDest);
      audioSources.push(source);
    } catch (error) {
      console.error("Musique non décodée :", error);
    }
  }

  const canvasStream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(fps);
  const tracks = [...canvasStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()];
  const stream = new MediaStream(tracks);

  const { mimeType, isNativeMP4 } = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const startAt = audioContext.currentTime + 0.1;
  for (const source of audioSources) source.start(startAt);
  recorder.start();

  await new Promise<void>((resolve) => {
    function frame() {
      const elapsed = audioContext.currentTime - startAt;
      const t = Math.max(0, elapsed);

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      let acc = 0;
      let index = 0;
      for (let i = 0; i < ordered.length; i++) {
        if (t < acc + ordered[i].duration) {
          index = i;
          break;
        }
        acc += ordered[i].duration;
        index = i;
      }
      const segStart = ordered.slice(0, index).reduce((s, seg) => s + seg.duration, 0);
      const segDuration = ordered[index].duration;
      const localT = t - segStart;
      const localProgress = Math.min(1, Math.max(0, localT / segDuration));

      const zoom = options.kenBurns ? 1 + 0.1 * localProgress : 1.02;
      const panX = options.kenBurns ? (localProgress - 0.5) * width * 0.04 : 0;
      const panY = options.kenBurns ? (localProgress - 0.5) * height * 0.04 : 0;
      drawCover(ctx, images[index], width, height, zoom, panX, panY, 1);

      if (transitionDuration > 0 && index < ordered.length - 1) {
        const intoTransition = localT - (segDuration - transitionDuration);
        if (intoTransition > 0) {
          const alpha = Math.min(1, intoTransition / transitionDuration);
          drawCover(ctx, images[index + 1], width, height, 1.0, 0, 0, alpha);
        }
      }

      if (options.subtitleStyle !== "none") {
        drawSubtitles(ctx, captions[index], t, width, height, options.subtitleStyle);
      }

      if (onProgress) onProgress(0.05 + (t / totalDuration) * 0.8, "Rendu de la vidéo...");

      if (elapsed >= totalDuration) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  recorder.stop();
  for (const source of audioSources) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }
  const recordedBlob = await recordingDone;
  await audioContext.close();

  if (isNativeMP4) {
    onProgress?.(1, "Terminé");
    return { blob: recordedBlob, mimeType: "video/mp4", extension: "mp4" };
  }

  const mp4 = await convertWebmToMp4(recordedBlob, onProgress);
  onProgress?.(1, "Terminé");
  if (mp4) {
    return { blob: mp4, mimeType: "video/mp4", extension: "mp4" };
  }
  return { blob: recordedBlob, mimeType, extension: "webm" };
}
