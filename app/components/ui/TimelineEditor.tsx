"use client";

import * as React from "react";
import { Plus, Trash2, Captions, Image as ImageIcon, AudioLines } from "lucide-react";
import type { SubtitleEntry, VideoSegment } from "@/types";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { normalizeSubtitles } from "@/lib/sync";

interface TimelineEditorProps {
  segments: VideoSegment[];
  subtitles: SubtitleEntry[];
  duration: number;
  currentTime: number;
  hasAudio: boolean;
  onSeek: (time: number) => void;
  onSubtitlesChange: (subtitles: SubtitleEntry[]) => void;
}

const TRACK_COLORS = ["bg-primary/30 border-primary/50", "bg-primary/15 border-primary/30"];

function formatTimecode(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

/**
 * Timeline multi-pistes (audio / images / sous-titres) alignée sur la durée
 * totale, avec curseur temps réel, clic pour naviguer, et édition manuelle
 * des sous-titres (texte + bornes).
 */
export function TimelineEditor({
  segments,
  subtitles,
  duration,
  currentTime,
  hasAudio,
  onSeek,
  onSubtitlesChange,
}: TimelineEditorProps) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  const safeDuration = Math.max(duration, 0.1);
  const toPercent = (t: number) => `${Math.min(100, Math.max(0, (t / safeDuration) * 100))}%`;
  const widthPercent = (start: number, end: number) =>
    `${Math.max(0.5, ((Math.min(end, safeDuration) - Math.max(start, 0)) / safeDuration) * 100)}%`;

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  }

  function updateCue(index: number, patch: Partial<SubtitleEntry>) {
    const next = subtitles.map((sub, i) => (i === index ? { ...sub, ...patch } : sub));
    onSubtitlesChange(next);
  }

  function commitCue(index: number) {
    const cue = subtitles[index];
    if (!cue) return;
    if (cue.end <= cue.start) {
      updateCue(index, { end: Math.round((cue.start + 0.5) * 10) / 10 });
      return;
    }
    onSubtitlesChange(normalizeSubtitles(subtitles));
  }

  function deleteCue(index: number) {
    setSelectedIndex(null);
    onSubtitlesChange(subtitles.filter((_, i) => i !== index));
  }

  function addCue() {
    const last = subtitles[subtitles.length - 1];
    const start = last ? Math.round(last.end * 10) / 10 : 0;
    const end = Math.min(safeDuration, start + 2);
    onSubtitlesChange([...subtitles, { start, end: end > start ? end : start + 1, text: "Nouveau sous-titre" }]);
    setSelectedIndex(subtitles.length);
  }

  const sortedSegments = [...segments].sort((a, b) => a.order - b.order);
  let cursor = 0;
  const segmentBlocks = sortedSegments.map((segment, i) => {
    const start = cursor;
    cursor += segment.duration;
    return { segment, start, end: cursor, colorClass: TRACK_COLORS[i % TRACK_COLORS.length] };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex select-none flex-col gap-1.5 rounded-lg border border-border bg-secondary/20 p-3">
        {/* Curseur temps réel (superposé à la zone des pistes, après les labels) */}
        <div className="pointer-events-none absolute inset-y-2 z-10" style={{ left: "calc(0.75rem + 5.5rem)", right: "0.75rem" }}>
          <div className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: toPercent(currentTime) }} />
        </div>

        {/* Piste audio */}
        <div className="flex items-center gap-2">
          <span className="flex w-20 shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <AudioLines className="h-3 w-3" /> Audio
          </span>
          <div onClick={handleTrackClick} className="relative h-6 flex-1 cursor-pointer overflow-hidden rounded bg-card">
            {hasAudio ? (
              <div className="absolute inset-y-0 left-0 rounded bg-emerald-500/30 border border-emerald-600/40" style={{ width: "100%" }}>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-emerald-300">
                  Voix off — {formatTimecode(safeDuration)}
                </span>
              </div>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                Aucun audio uploadé
              </span>
            )}
          </div>
        </div>

        {/* Piste images (segments) */}
        <div className="flex items-center gap-2">
          <span className="flex w-20 shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <ImageIcon className="h-3 w-3" /> Images
          </span>
          <div onClick={handleTrackClick} className="relative h-6 flex-1 cursor-pointer overflow-hidden rounded bg-card">
            {segmentBlocks.map(({ segment, start, end, colorClass }) => (
              <div
                key={segment.id}
                title={`Segment ${segment.order} — ${segment.duration.toFixed(1)}s`}
                className={cn("absolute inset-y-0 overflow-hidden rounded border text-center text-[10px] leading-6 text-foreground/80", colorClass)}
                style={{ left: toPercent(start), width: widthPercent(start, end) }}
              >
                {segment.order}
              </div>
            ))}
          </div>
        </div>

        {/* Piste sous-titres */}
        <div className="flex items-center gap-2">
          <span className="flex w-20 shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Captions className="h-3 w-3" /> Sous-titres
          </span>
          <div onClick={handleTrackClick} className="relative h-6 flex-1 cursor-pointer overflow-hidden rounded bg-card">
            {subtitles.map((sub, i) => (
              <div
                key={i}
                title={sub.text}
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(i); onSeek(sub.start); }}
                className={cn(
                  "absolute inset-y-0 cursor-pointer overflow-hidden truncate rounded border px-1 text-[10px] leading-6",
                  selectedIndex === i
                    ? "border-amber-500 bg-amber-500/40 text-amber-100"
                    : "border-amber-700/40 bg-amber-500/15 text-amber-200/80"
                )}
                style={{ left: toPercent(sub.start), width: widthPercent(sub.start, sub.end) }}
              >
                {sub.text}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between pl-[5.5rem] text-[10px] text-muted-foreground">
          <span>0:00.0</span>
          <span>{formatTimecode(safeDuration / 2)}</span>
          <span>{formatTimecode(safeDuration)}</span>
        </div>
      </div>

      {/* Édition des sous-titres */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Édition des sous-titres</p>
          <Button variant="outline" size="sm" onClick={addCue}>
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>
        {subtitles.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun sous-titre. Uploade un audio à l&apos;étape Voix off ou ajoute un sous-titre manuellement.</p>
        )}
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
          {subtitles.map((sub, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border p-2",
                selectedIndex === i ? "border-amber-600/60 bg-amber-500/5" : "border-border bg-card"
              )}
              onFocus={() => setSelectedIndex(i)}
            >
              <input
                type="number"
                min={0}
                step={0.1}
                value={sub.start}
                onChange={(e) => updateCue(i, { start: Number(e.target.value) })}
                onBlur={() => commitCue(i)}
                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                aria-label={`Début du sous-titre ${i + 1} (secondes)`}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={sub.end}
                onChange={(e) => updateCue(i, { end: Number(e.target.value) })}
                onBlur={() => commitCue(i)}
                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                aria-label={`Fin du sous-titre ${i + 1} (secondes)`}
              />
              <input
                type="text"
                value={sub.text}
                onChange={(e) => updateCue(i, { text: e.target.value })}
                className="min-w-40 flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                aria-label={`Texte du sous-titre ${i + 1}`}
              />
              <Button variant="ghost" size="sm" onClick={() => deleteCue(i)} aria-label="Supprimer le sous-titre">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
