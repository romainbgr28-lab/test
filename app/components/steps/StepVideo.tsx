"use client";

import * as React from "react";
import {
  Play, Pause, SkipBack, Download, ArrowRight, Film, Loader2,
  Music, Volume2, VolumeX, Upload, Captions, Settings2, ChevronDown,
} from "lucide-react";
import type { Clip, Platform, SubtitleEntry, VideoRenderOptions } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { clipsToBeats, drawFrame, loadImages, loadVideos } from "@/lib/video-render";
import { getDimensionsForPlatform } from "@/lib/pollinations";
import { getTotalDuration } from "@/lib/clips";
import { TimelineEditor } from "../ui/TimelineEditor";
import { fileToDataUrl } from "@/lib/utils";
import { toSRT } from "@/lib/subtitles";

interface StepVideoProps {
  clips: Clip[];
  voiceoverUrl?: string;
  platform: Platform;
  subtitles: SubtitleEntry[];
  onSubtitlesChange: (s: SubtitleEntry[]) => void;
  onClipDurationChange: (id: string, duration: number) => void;
  onClipTrimChange: (id: string, trimStart: number, trimEnd: number | undefined) => void;
  onProceed: () => void;
}

const SUBTITLE_OPTIONS = [
  { value: "bottom", label: "Sous-titres activés" },
  { value: "none", label: "Sans sous-titres" },
];

const BEAT_OPTIONS = [
  { value: "1.5", label: "Très dynamique (1.5s)" },
  { value: "2", label: "Dynamique (2s)" },
  { value: "2.5", label: "Standard TikTok (2.5s)" },
  { value: "4", label: "Posé (4s)" },
];

const DEFAULT_OPTIONS: VideoRenderOptions = {
  kenBurns: true,
  transitions: true,
  subtitleStyle: "bottom",
  musicVolume: 0,
  beatDuration: 2.5,
};

const PREVIEW_HEIGHT = 480;

// ─── Film Strip ────────────────────────────────────────────────────────────

interface FilmStripProps {
  clips: Clip[];
  currentTime: number;
  selectedId: string | null;
  onSelect: (id: string, startTime: number) => void;
  onClipResize: (id: string, duration: number) => void;
}

function FilmStrip({ clips, currentTime, selectedId, onSelect, onClipResize }: FilmStripProps) {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<{ id: string; startX: number; startDuration: number } | null>(null);
  const total = getTotalDuration(clips);
  const safeTotal = Math.max(total, 0.1);

  React.useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const rect = stripRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pxPerSecond = rect.width / safeTotal;
      const delta = (e.clientX - drag!.startX) / pxPerSecond;
      const next = Math.max(0.3, Math.round((drag!.startDuration + delta) * 10) / 10);
      onClipResize(drag!.id, next);
    }
    function onUp() { setDrag(null); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [drag, safeTotal, onClipResize]);

  // Compute start times for click-seek
  const startTimes = React.useMemo(() => {
    let t = 0;
    return clips.map((c) => { const s = t; t += c.duration; return s; });
  }, [clips]);

  const playheadLeft = `${Math.min(100, (currentTime / safeTotal) * 100)}%`;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
        Film strip — {clips.length} clips · glisse le bord droit pour ajuster la durée
      </p>
      <div
        ref={stripRef}
        className="relative flex h-20 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-black cursor-pointer select-none"
        style={{ userSelect: drag ? "none" : undefined }}
      >
        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-red-500"
          style={{ left: playheadLeft }}
        />
        {clips.map((clip, i) => {
          const widthPct = (clip.duration / safeTotal) * 100;
          const isSelected = selectedId === clip.id;
          return (
            <div
              key={clip.id}
              style={{ width: `${Math.max(widthPct, 2)}%`, minWidth: "24px", flexShrink: 0 }}
              className={`relative h-full border-r border-white/10 transition-shadow ${
                isSelected ? "ring-2 ring-inset ring-primary" : ""
              }`}
              onClick={() => onSelect(clip.id, startTimes[i])}
            >
              {clip.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clip.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary text-[9px] text-muted-foreground">
                  {i + 1}
                </div>
              )}
              {/* Duration badge */}
              <span className="absolute bottom-0 left-0 rounded-tr bg-black/70 px-1 py-px text-[9px] text-white/90">
                {clip.duration.toFixed(1)}s
              </span>
              {/* Segment indicator */}
              {(i === 0 || clips[i - 1].segmentId !== clip.segmentId) && (
                <span className="absolute top-0 left-0 rounded-br bg-primary/80 px-1 py-px text-[9px] text-white">
                  S{clip.segmentOrder}
                </span>
              )}
              {/* Resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-primary/60 active:bg-primary/80 transition-colors"
                style={{ background: drag?.id === clip.id ? "rgba(139,92,246,0.6)" : undefined }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDrag({ id: clip.id, startX: e.clientX, startDuration: clip.duration });
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Audio Panel ────────────────────────────────────────────────────────────

interface AudioPanelProps {
  voiceoverUrl?: string;
  voiceDuration: number;
  musicUrl?: string;
  musicVolume: number;
  voiceVolume: number;
  onMusicLoaded: (url: string) => void;
  onMusicVolumeChange: (v: number) => void;
  onVoiceVolumeChange: (v: number) => void;
  onMusicRemove: () => void;
}

function AudioPanel({
  voiceoverUrl, voiceDuration, musicUrl, musicVolume, voiceVolume,
  onMusicLoaded, onMusicVolumeChange, onVoiceVolumeChange, onMusicRemove,
}: AudioPanelProps) {
  const musicInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleMusicFile(file: File) {
    if (!file.type.startsWith("audio/")) { setError("Format non supporté."); return; }
    setLoading(true); setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      onMusicLoaded(dataUrl);
    } catch { setError("Impossible de lire ce fichier."); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Voix off */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voix off</p>
        {voiceoverUrl ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/20 p-3">
            <audio controls src={voiceoverUrl} className="h-9 w-full" />
            <p className="text-xs text-muted-foreground">Durée : <span className="text-foreground font-medium">{voiceDuration.toFixed(1)}s</span></p>
            <div className="flex items-center gap-2">
              {voiceVolume === 0 ? <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Volume2 className="h-4 w-4 shrink-0 text-foreground" />}
              <input type="range" min={0} max={100} value={voiceVolume} onChange={(e) => onVoiceVolumeChange(Number(e.target.value))} className="flex-1 accent-primary" />
              <span className="w-10 text-right text-xs text-muted-foreground">{voiceVolume}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune voix off uploadée (étape 3).</p>
        )}
      </div>

      {/* Musique de fond */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Musique de fond</p>
        {musicUrl ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/20 p-3">
            <audio controls src={musicUrl} loop className="h-9 w-full" />
            <div className="flex items-center gap-2">
              {musicVolume === 0 ? <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Music className="h-4 w-4 shrink-0 text-foreground" />}
              <input type="range" min={0} max={100} value={musicVolume} onChange={(e) => onMusicVolumeChange(Number(e.target.value))} className="flex-1 accent-primary" />
              <span className="w-10 text-right text-xs text-muted-foreground">{musicVolume}%</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onMusicRemove} className="self-start text-red-400 hover:text-red-300">
              Supprimer la musique
            </Button>
          </div>
        ) : (
          <div
            onClick={() => musicInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-border p-4 transition-colors hover:border-primary/50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            <p className="text-sm text-muted-foreground">Ajoute une musique de fond (MP3, WAV…)</p>
            <input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMusicFile(f); }} />
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

// ─── Main StepVideo ─────────────────────────────────────────────────────────

export function StepVideo({
  clips, voiceoverUrl, platform, subtitles, onSubtitlesChange,
  onClipDurationChange, onClipTrimChange, onProceed,
}: StepVideoProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const musicRef = React.useRef<HTMLAudioElement>(null);
  const rafRef = React.useRef<number>(0);

  const [options, setOptions] = React.useState<VideoRenderOptions>(DEFAULT_OPTIONS);
  const [ready, setReady] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [downloadUrl, setDownloadUrl] = React.useState<string | undefined>();
  const [musicUrl, setMusicUrl] = React.useState<string | undefined>();
  const [musicVolume, setMusicVolume] = React.useState(30);
  const [voiceVolume, setVoiceVolume] = React.useState(100);
  const [showExportPanel, setShowExportPanel] = React.useState(false);
  const [trimVideoDuration, setTrimVideoDuration] = React.useState<number>(8);

  const { width: nativeW, height: nativeH } = getDimensionsForPlatform(platform);
  const previewW = Math.round((PREVIEW_HEIGHT * nativeW) / nativeH);
  const previewH = PREVIEW_HEIGHT;

  const totalDuration = getTotalDuration(clips);

  const beatsRef = React.useRef(clipsToBeats(clips));
  const imagesRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const videosRef = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const subtitlesRef = React.useRef(subtitles);
  const optionsRef = React.useRef(options);

  React.useEffect(() => { optionsRef.current = options; }, [options]);
  React.useEffect(() => {
    subtitlesRef.current = subtitles;
    if (ready) renderFrame(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles]);

  React.useEffect(() => {
    beatsRef.current = clipsToBeats(clips);
    if (ready) renderFrame(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  async function initPreview() {
    if (clips.length === 0) return;
    setLoading(true);
    setReady(false);
    beatsRef.current = clipsToBeats(clips);
    subtitlesRef.current = subtitles;
    imagesRef.current = await loadImages(clips.map(c => ({
      id: c.id, order: c.segmentOrder, narration: c.narration,
      visualDescription: "", duration: c.duration,
      imageUrl: c.imageUrl, imageBlob: c.imageUrl, imageUrls: [c.imageUrl],
    })));
    videosRef.current = await loadVideos(clips);
    setReady(true);
    setLoading(false);
    renderFrame(0);
  }

  function renderFrame(t: number) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    // Sync video element currentTime for the active beat
    const beat = beatsRef.current.find((b) => t >= b.startTime && t < b.endTime);
    if (beat?.videoUrl) {
      const vid = videosRef.current.get(beat.videoUrl);
      if (vid) {
        const targetTime = (beat.videoTrimStart ?? 0) + (t - beat.startTime);
        if (Math.abs(vid.currentTime - targetTime) > 0.1) vid.currentTime = targetTime;
      }
    }
    drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, optionsRef.current, videosRef.current);
  }

  React.useEffect(() => {
    initPreview();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.length, platform]);

  function seekTo(t: number) {
    const clamped = Math.min(totalDuration, Math.max(0, t));
    if (audioRef.current) audioRef.current.currentTime = clamped;
    if (musicRef.current) musicRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    renderFrame(clamped);
  }

  function startLoop() {
    const audio = audioRef.current;
    if (!audio) return;
    const ctx = canvasRef.current?.getContext("2d")!;
    function frame() {
      const t = audio!.currentTime;
      setCurrentTime(t);
      // Sync video for current beat
      const beat = beatsRef.current.find((b) => t >= b.startTime && t < b.endTime);
      if (beat?.videoUrl) {
        const vid = videosRef.current.get(beat.videoUrl);
        if (vid && vid.paused) {
          vid.currentTime = (beat.videoTrimStart ?? 0) + (t - beat.startTime);
          vid.play().catch(() => {});
        }
      }
      drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, optionsRef.current, videosRef.current);
      if (!audio!.paused && !audio!.ended) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        // Pause all videos
        videosRef.current.forEach((v) => v.pause());
        setPlaying(false);
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  function handlePlay() {
    if (!ready) return;
    if (playing) {
      audioRef.current?.pause();
      musicRef.current?.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.volume = voiceVolume / 100;
        audioRef.current.play();
      }
      if (musicRef.current) {
        musicRef.current.volume = musicVolume / 100;
        musicRef.current.play();
      }
      setPlaying(true);
      if (audioRef.current) startLoop();
      else {
        // No voiceover — drive animation by time
        const startWallTime = performance.now() - currentTime * 1000;
        const ctx = canvasRef.current?.getContext("2d")!;
        function frameNoAudio() {
          const t = (performance.now() - startWallTime) / 1000;
          if (t >= totalDuration) { videosRef.current.forEach((v) => v.pause()); setPlaying(false); setCurrentTime(totalDuration); return; }
          setCurrentTime(t);
          const beat = beatsRef.current.find((b) => t >= b.startTime && t < b.endTime);
          if (beat?.videoUrl) {
            const vid = videosRef.current.get(beat.videoUrl);
            if (vid && vid.paused) {
              vid.currentTime = (beat.videoTrimStart ?? 0) + (t - beat.startTime);
              vid.play().catch(() => {});
            }
          }
          drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, optionsRef.current, videosRef.current);
          rafRef.current = requestAnimationFrame(frameNoAudio);
        }
        rafRef.current = requestAnimationFrame(frameNoAudio);
      }
    }
  }

  function handleRestart() {
    audioRef.current?.pause();
    musicRef.current?.pause();
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    seekTo(0);
  }

  // Update audio volumes live
  React.useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicVolume / 100;
  }, [musicVolume]);
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = voiceVolume / 100;
  }, [voiceVolume]);

  async function handleRecord() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setRecording(true);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(undefined);
    if (playing) { audioRef.current?.pause(); musicRef.current?.pause(); cancelAnimationFrame(rafRef.current); setPlaying(false); }

    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);

    // Mix audio
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const sources: AudioBufferSourceNode[] = [];
      async function addTrack(url: string, volume: number, loop = false) {
        const resp = await fetch(url);
        const buf = await audioCtx.decodeAudioData(await resp.arrayBuffer());
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.loop = loop;
        const gain = audioCtx.createGain();
        gain.gain.value = volume / 100;
        src.connect(gain).connect(dest);
        src.start(0);
        sources.push(src);
      }
      if (voiceoverUrl) await addTrack(voiceoverUrl, voiceVolume);
      if (musicUrl) await addTrack(musicUrl, musicVolume, true);
      if (sources.length > 0) {
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      }
    } catch { /* no audio */ }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const opts = optionsRef.current;
    const FPS = 30;
    recorder.start(100);
    for (let f = 0; f <= Math.ceil(totalDuration * FPS); f++) {
      const t = f / FPS;
      // Seek video elements to the correct position for this frame
      const beat = beatsRef.current.find((b) => t >= b.startTime && t < b.endTime);
      if (beat?.videoUrl) {
        const vid = videosRef.current.get(beat.videoUrl);
        if (vid) {
          const targetTime = (beat.videoTrimStart ?? 0) + (t - beat.startTime);
          if (Math.abs(vid.currentTime - targetTime) > 0.05) {
            vid.currentTime = targetTime;
            await new Promise<void>((r) => { vid.onseeked = () => r(); setTimeout(r, 200); });
          }
        }
      }
      drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, opts, videosRef.current);
      await new Promise<void>((r) => setTimeout(r, 1000 / FPS));
    }
    recorder.stop();
    await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    setDownloadUrl(URL.createObjectURL(new Blob(chunks, { type: mimeType })));
    setRecording(false);
  }

  function downloadSRT() {
    const blob = new Blob([toSRT(subtitles)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "subtitles.srt";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-secondary/20">
        <CardTitle>Étape 4 — Éditeur vidéo</CardTitle>
        <CardDescription>
          Ajuste la durée de chaque clip en glissant son bord droit, paramètre l&apos;audio, les sous-titres et les effets, puis exporte.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 p-6">

        {/* ── Preview + Controls ───────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Canvas */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative overflow-hidden rounded-xl border border-border bg-black shadow-2xl"
              style={{ width: previewW, height: previewH }}
            >
              <canvas
                ref={canvasRef}
                width={nativeW}
                height={nativeH}
                style={{ width: previewW, height: previewH, display: "block" }}
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>
            {/* Scrubber */}
            <div className="flex w-full flex-col gap-1" style={{ maxWidth: previewW }}>
              <input
                type="range" min={0} max={totalDuration} step={0.05}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full accent-primary"
                disabled={!ready}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
              {/* Playback controls */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRestart} disabled={!ready}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handlePlay} disabled={!ready}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {playing ? "Pause" : "Lire"}
                </Button>
                {clips.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{clips.length} clips</span>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: sections */}
          <div className="flex flex-1 flex-col gap-4 min-w-0">
            {/* Effets visuels */}
            <section className="rounded-lg border border-border bg-secondary/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" /> Effets visuels
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Sous-titres</label>
                  <Select
                    value={options.subtitleStyle}
                    onChange={(v) => setOptions((o) => ({ ...o, subtitleStyle: v as VideoRenderOptions["subtitleStyle"] }))}
                    options={SUBTITLE_OPTIONS}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.kenBurns} onChange={(e) => setOptions((o) => ({ ...o, kenBurns: e.target.checked }))} className="accent-primary" />
                  <span className="font-medium">Effet Ken Burns (zoom/pan)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.transitions} onChange={(e) => setOptions((o) => ({ ...o, transitions: e.target.checked }))} className="accent-primary" />
                  <span className="font-medium">Transitions crossfade</span>
                </label>
              </div>
            </section>

            {/* Audio */}
            <section className="rounded-lg border border-border bg-secondary/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Music className="h-3.5 w-3.5" /> Audio
              </p>
              <AudioPanel
                voiceoverUrl={voiceoverUrl}
                voiceDuration={0}
                musicUrl={musicUrl}
                musicVolume={musicVolume}
                voiceVolume={voiceVolume}
                onMusicLoaded={setMusicUrl}
                onMusicVolumeChange={setMusicVolume}
                onVoiceVolumeChange={setVoiceVolume}
                onMusicRemove={() => setMusicUrl(undefined)}
              />
            </section>
          </div>
        </div>

        {/* Hidden audio elements */}
        {voiceoverUrl && <audio ref={audioRef} src={voiceoverUrl} onEnded={() => { setPlaying(false); musicRef.current?.pause(); }} />}
        {musicUrl && <audio ref={musicRef} src={musicUrl} loop />}

        {/* ── Film Strip ──────────────────────────────────────── */}
        {clips.length > 0 && (
          <FilmStrip
            clips={clips}
            currentTime={currentTime}
            selectedId={selectedClipId}
            onSelect={(id, t) => { setSelectedClipId(id); seekTo(t); }}
            onClipResize={onClipDurationChange}
          />
        )}

        {/* ── Video Trim Panel ────────────────────────────────── */}
        {(() => {
          const selectedClip = selectedClipId ? clips.find((c) => c.id === selectedClipId) : null;
          if (!selectedClip?.motionVideoUrl) return null;
          const vid = videosRef.current.get(selectedClip.motionVideoUrl);
          const vidDuration = vid?.duration && isFinite(vid.duration) ? vid.duration : trimVideoDuration;
          const trimStart = selectedClip.videoTrimStart ?? 0;
          const trimEnd = selectedClip.videoTrimEnd ?? Math.min(vidDuration, selectedClip.duration);
          return (
            <section className="rounded-lg border border-primary/40 bg-secondary/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                ✂️ Découpe vidéo — clip sélectionné
              </p>
              <div className="flex flex-col gap-4 md:flex-row md:gap-6">
                <video
                  key={selectedClip.motionVideoUrl}
                  src={selectedClip.motionVideoUrl}
                  controls
                  muted
                  className="h-32 rounded-md border border-border bg-black"
                  style={{ maxWidth: 200 }}
                  onLoadedMetadata={(e) => setTrimVideoDuration((e.target as HTMLVideoElement).duration)}
                />
                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      Début du clip : <span className="font-mono text-primary">{trimStart.toFixed(1)}s</span>
                    </label>
                    <input
                      type="range" min={0} max={Math.max(0, vidDuration - 0.1)} step={0.1}
                      value={trimStart}
                      onChange={(e) => onClipTrimChange(selectedClip.id, Number(e.target.value), trimEnd)}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      Fin du clip : <span className="font-mono text-primary">{trimEnd.toFixed(1)}s</span>
                      <span className="ml-2 text-xs text-muted-foreground">(durée utilisée : {(trimEnd - trimStart).toFixed(1)}s)</span>
                    </label>
                    <input
                      type="range" min={trimStart + 0.1} max={vidDuration} step={0.1}
                      value={trimEnd}
                      onChange={(e) => onClipTrimChange(selectedClip.id, trimStart, Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vidéo source : {vidDuration.toFixed(1)}s · Seule la portion [{trimStart.toFixed(1)}s → {trimEnd.toFixed(1)}s] sera utilisée dans le rendu.
                  </p>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── Timeline (sous-titres) ──────────────────────────── */}
        <section>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Captions className="h-3.5 w-3.5" /> Sous-titres
          </p>
          <TimelineEditor
            segments={[]}
            subtitles={subtitles}
            duration={totalDuration}
            currentTime={currentTime}
            hasAudio={!!voiceoverUrl}
            onSeek={seekTo}
            onSubtitlesChange={onSubtitlesChange}
          />
        </section>

        {/* ── Export ─────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-secondary/20 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            onClick={() => setShowExportPanel((v) => !v)}
          >
            <span className="flex items-center gap-2"><Film className="h-3.5 w-3.5" /> Export vidéo (WebM)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showExportPanel ? "rotate-180" : ""}`} />
          </button>
          {showExportPanel && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleRecord} disabled={recording || !ready}>
                {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                {recording ? `Export en cours… (~${Math.round(totalDuration)}s)` : "Exporter WebM (temps réel)"}
              </Button>
              {downloadUrl && (
                <a href={downloadUrl} download="studioai-video.webm">
                  <Button variant="outline"><Download className="h-4 w-4" />Télécharger WebM</Button>
                </a>
              )}
              <Button variant="outline" onClick={downloadSRT} disabled={subtitles.length === 0}>
                <Download className="h-4 w-4" />Télécharger .SRT
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                La vidéo WebM intègre la voix off et la musique de fond. Pour TikTok/YouTube, importe ce WebM + le .SRT dans CapCut pour le sous-titrage natif.
              </p>
            </div>
          )}
        </section>
      </CardContent>

      <CardFooter className="border-t border-border">
        <Button onClick={onProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          Passer à l&apos;export
        </Button>
      </CardFooter>
    </Card>
  );
}
