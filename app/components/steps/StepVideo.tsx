"use client";

import * as React from "react";
import { Play, Pause, SkipBack, Download, ArrowRight, Film, Loader2 } from "lucide-react";
import type { VideoSegment, VideoRenderOptions, Platform, SubtitleEntry } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { buildBeats, loadImages, drawFrame, getTotalDuration } from "@/lib/video-render";
import { TimelineEditor } from "../ui/TimelineEditor";
import { getDimensionsForPlatform } from "@/lib/pollinations";

interface StepVideoProps {
  segments: VideoSegment[];
  voiceoverUrl?: string;
  platform: Platform;
  subtitles: SubtitleEntry[];
  onSubtitlesChange: (subtitles: SubtitleEntry[]) => void;
  onProceed: () => void;
}

const BEAT_OPTIONS = [
  { value: "1.5", label: "Très dynamique (1.5s)" },
  { value: "2.5", label: "Dynamique (2.5s)" },
  { value: "4", label: "Posé (4s)" },
];

const SUBTITLE_OPTIONS = [
  { value: "bottom", label: "Sous-titres activés" },
  { value: "none", label: "Sans sous-titres" },
];

const DEFAULT_OPTIONS: VideoRenderOptions = {
  kenBurns: true,
  transitions: true,
  subtitleStyle: "bottom",
  musicVolume: 0,
  beatDuration: 2.5,
};

// Preview canvas display size (scaled down from full resolution)
const PREVIEW_HEIGHT = 520;

export function StepVideo({ segments, voiceoverUrl, platform, subtitles, onSubtitlesChange, onProceed }: StepVideoProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const rafRef = React.useRef<number>(0);
  const [options, setOptions] = React.useState<VideoRenderOptions>(DEFAULT_OPTIONS);
  const [ready, setReady] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [recording, setRecording] = React.useState(false);
  const [downloadUrl, setDownloadUrl] = React.useState<string | undefined>();

  const { width: nativeW, height: nativeH } = getDimensionsForPlatform(platform);
  const isVertical = nativeH > nativeW;
  const previewW = isVertical ? Math.round((PREVIEW_HEIGHT * nativeW) / nativeH) : Math.round((PREVIEW_HEIGHT * nativeW) / nativeH);
  const previewH = PREVIEW_HEIGHT;

  const totalDuration = getTotalDuration(segments);

  // Shared state refs for RAF loop (avoids stale closure)
  const beatsRef = React.useRef(buildBeats(segments, options.beatDuration));
  const imagesRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const subtitlesRef = React.useRef(subtitles);
  const optionsRef = React.useRef(options);

  React.useEffect(() => { optionsRef.current = options; }, [options]);

  // Les sous-titres édités dans la timeline sont redessinés immédiatement
  React.useEffect(() => {
    subtitlesRef.current = subtitles;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && ready) {
      drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, currentTime, subtitles, optionsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles]);

  async function initPreview() {
    setLoading(true);
    setReady(false);
    beatsRef.current = buildBeats(segments, options.beatDuration);
    subtitlesRef.current = subtitles;
    imagesRef.current = await loadImages(segments);
    setReady(true);
    setLoading(false);
    // Draw first frame
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, 0, subtitlesRef.current, options);
  }

  // Init on mount and when segments/platform change
  React.useEffect(() => {
    initPreview();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length, platform]);

  // Rebuild beats when beatDuration changes (don't reload images)
  React.useEffect(() => {
    beatsRef.current = buildBeats(segments, options.beatDuration);
  }, [options.beatDuration, segments]);

  // RAF animation loop
  function startLoop() {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;
    const ctx = canvas.getContext("2d")!;

    function frame() {
      const t = audio!.currentTime;
      setCurrentTime(t);
      drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, optionsRef.current);
      if (!audio!.paused && !audio!.ended) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setPlaying(false);
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  function handlePlay() {
    const audio = audioRef.current;
    if (!audio || !ready) return;
    if (playing) {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      startLoop();
    }
  }

  function handleRestart() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    // Draw frame 0
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, 0, subtitlesRef.current, options);
    if (playing) { audio.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); }
  }

  function seekTo(t: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = t;
    setCurrentTime(t);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, optionsRef.current);
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    seekTo(Number(e.target.value));
  }

  async function handleRecord() {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !ready) return;

    setRecording(true);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(undefined);

    // Restart
    audio.currentTime = 0;
    if (playing) { audio.pause(); cancelAnimationFrame(rafRef.current); setPlaying(false); }

    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);

    // Add audio track
    if (voiceoverUrl) {
      try {
        const audioCtx = new AudioContext();
        const resp = await fetch(voiceoverUrl);
        const buf = await resp.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        const dest = audioCtx.createMediaStreamDestination();
        const src = audioCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(dest);
        for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
        src.start(0);
      } catch { /* no audio */ }
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start(100);
    const opts = optionsRef.current;

    // Render at real-time speed for proper sync
    const FPS = 30;
    const frameInterval = 1000 / FPS;
    for (let frame = 0; frame <= Math.ceil(totalDuration * FPS); frame++) {
      const t = frame / FPS;
      drawFrame(ctx, nativeW, nativeH, beatsRef.current, imagesRef.current, t, subtitlesRef.current, opts);
      await new Promise<void>((r) => setTimeout(r, frameInterval));
    }

    recorder.stop();
    await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
    setRecording(false);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 4 — Aperçu vidéo</CardTitle>
        <CardDescription>
          Prévisualise ta vidéo avec les effets Ken Burns, transitions et sous-titres synchronisés.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Canvas preview */}
        <div className="flex justify-center">
          <div className="relative overflow-hidden rounded-xl border border-border bg-black shadow-lg"
            style={{ width: previewW, height: previewH }}>
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
        </div>

        {/* Audio element (hidden) */}
        {voiceoverUrl && (
          <audio ref={audioRef} src={voiceoverUrl} onEnded={() => setPlaying(false)} />
        )}

        {/* Playback controls */}
        <div className="flex flex-col gap-2">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.1}
            value={currentTime}
            onChange={handleScrub}
            className="w-full accent-primary"
            disabled={!ready}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRestart} disabled={!ready}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handlePlay} disabled={!ready || !voiceoverUrl}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Lire"}
            </Button>
            {!voiceoverUrl && (
              <span className="text-xs text-muted-foreground">Upload un fichier audio à l&apos;étape 3 pour activer la lecture.</span>
            )}
          </div>
        </div>

        {/* Timeline interactive : audio + images + sous-titres alignés */}
        <TimelineEditor
          segments={segments}
          subtitles={subtitles}
          duration={totalDuration}
          currentTime={currentTime}
          hasAudio={!!voiceoverUrl}
          onSeek={seekTo}
          onSubtitlesChange={onSubtitlesChange}
        />

        {/* Options */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-secondary/20 p-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Rythme des images</label>
            <Select
              value={String(options.beatDuration)}
              onChange={(v) => setOptions((o) => ({ ...o, beatDuration: Number(v) }))}
              options={BEAT_OPTIONS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Sous-titres</label>
            <Select
              value={options.subtitleStyle}
              onChange={(v) => setOptions((o) => ({ ...o, subtitleStyle: v as VideoRenderOptions["subtitleStyle"] }))}
              options={SUBTITLE_OPTIONS}
            />
          </div>
          <div className="flex flex-col gap-2 justify-end">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={options.kenBurns}
                onChange={(e) => setOptions((o) => ({ ...o, kenBurns: e.target.checked }))}
                className="accent-primary"
              />
              <span className="font-medium text-foreground">Effets Ken Burns</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={options.transitions}
                onChange={(e) => setOptions((o) => ({ ...o, transitions: e.target.checked }))}
                className="accent-primary"
              />
              <span className="font-medium text-foreground">Transitions (crossfade)</span>
            </label>
          </div>
        </div>

        {/* Export WebM */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRecord}
            disabled={recording || !ready}
          >
            {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {recording ? `Export en cours... (~${Math.round(totalDuration)}s)` : "Exporter en WebM"}
          </Button>
          {downloadUrl && (
            <a href={downloadUrl} download="studioai-video.webm">
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Télécharger WebM
              </Button>
            </a>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          Passer à l&apos;export
        </Button>
      </CardFooter>
    </Card>
  );
}
