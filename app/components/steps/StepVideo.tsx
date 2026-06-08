"use client";

import * as React from "react";
import { Film, ArrowRight, Loader2, Upload, X, Download, Hash, Sparkles, Copy } from "lucide-react";
import type { PublishMetadata, VideoRenderOptions, SubtitleStyle, VideoSegment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { useToast } from "../ui/Toast";

const SUBTITLE_OPTIONS = [
  { value: "karaoke", label: "Dynamiques (mot par mot, style TikTok)" },
  { value: "block", label: "Bloc (phrase entière)" },
  { value: "none", label: "Aucun sous-titre" },
];

interface StepVideoProps {
  segments: VideoSegment[];
  voiceoverUrl?: string;
  renderOptions: VideoRenderOptions;
  onRenderOptionsChange: (patch: Partial<VideoRenderOptions>) => void;
  onMusicChange: (file: File | null) => void;
  musicName?: string;
  videoUrl?: string;
  videoExtension?: "mp4" | "webm";
  rendering: boolean;
  renderProgress: { ratio: number; label: string };
  onRender: () => void;
  publishMetadata?: PublishMetadata;
  generatingMetadata: boolean;
  onGenerateMetadata: () => void;
  onProceed: () => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-left"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function StepVideo({
  segments,
  voiceoverUrl,
  renderOptions,
  onRenderOptionsChange,
  onMusicChange,
  musicName,
  videoUrl,
  videoExtension,
  rendering,
  renderProgress,
  onRender,
  publishMetadata,
  generatingMetadata,
  onGenerateMetadata,
  onProceed,
}: StepVideoProps) {
  const { toast } = useToast();
  const musicInputRef = React.useRef<HTMLInputElement>(null);
  const allImagesReady = segments.length > 0 && segments.every((s) => !!s.imageUrl);

  function copyMetadata() {
    if (!publishMetadata) return;
    const text = `${publishMetadata.caption}\n\n${publishMetadata.hashtags.map((h) => `#${h}`).join(" ")}`;
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copié !", description: "Légende et hashtags copiés dans le presse-papiers.", variant: "success" }),
      () => toast({ title: "Copie impossible", variant: "error" })
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 5 — Montage vidéo</CardTitle>
        <CardDescription>
          Assemble automatiquement tes images et ta voix off en une vidéo finie (Ken Burns, transitions, sous-titres
          animés et musique), prête à publier.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!allImagesReady && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600">
            Génère d&apos;abord toutes les images des segments (étape Images) pour pouvoir monter la vidéo.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle
            checked={renderOptions.kenBurns}
            onChange={(v) => onRenderOptionsChange({ kenBurns: v })}
            label="Effet Ken Burns (zoom / pan)"
          />
          <Toggle
            checked={renderOptions.transitions}
            onChange={(v) => onRenderOptionsChange({ transitions: v })}
            label="Transitions en fondu entre segments"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Style de sous-titres</label>
          <Select
            value={renderOptions.subtitleStyle}
            onChange={(v) => onRenderOptionsChange({ subtitleStyle: v as SubtitleStyle })}
            options={SUBTITLE_OPTIONS}
          />
          <p className="text-xs text-muted-foreground">
            Les sous-titres sont synchronisés à partir de la durée de chaque segment.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Musique de fond (optionnel)</label>
          <input
            ref={musicInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => onMusicChange(e.target.files?.[0] ?? null)}
          />
          {musicName ? (
            <div className="flex items-center gap-3">
              <span className="truncate rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm">
                {musicName}
              </span>
              <Button variant="outline" size="sm" onClick={() => onMusicChange(null)}>
                <X className="h-4 w-4" />
                Retirer
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => musicInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Importer une musique
            </Button>
          )}
          {musicName && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Volume musique</span>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.05}
                value={renderOptions.musicVolume}
                onChange={(e) => onRenderOptionsChange({ musicVolume: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">
                {Math.round(renderOptions.musicVolume * 100)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
          <Button onClick={onRender} disabled={rendering || !allImagesReady} size="lg" className="w-fit">
            {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {videoUrl ? "Regénérer la vidéo" : "Générer la vidéo"}
          </Button>
          {!voiceoverUrl && (
            <p className="text-xs text-muted-foreground">
              Astuce : génère une voix off à l&apos;étape précédente pour une vidéo complète avec audio.
            </p>
          )}
          {rendering && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(renderProgress.ratio * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{renderProgress.label}</p>
              <p className="text-xs text-muted-foreground">
                Le rendu se fait en temps réel dans ton navigateur : compte environ la durée de la vidéo.
              </p>
            </div>
          )}
          {videoUrl && !rendering && (
            <div className="flex flex-col gap-3">
              <video src={videoUrl} controls className="max-h-[480px] w-fit rounded-lg border border-border" />
              <a
                href={videoUrl}
                download={`studioai-video.${videoExtension ?? "mp4"}`}
                className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                Télécharger la vidéo ({(videoExtension ?? "mp4").toUpperCase()})
              </a>
            </div>
          )}
        </div>

        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4" />
              Légende & hashtags
            </CardTitle>
            <CardDescription>Génère une légende accrocheuse et des hashtags pertinents pour la publication.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" size="sm" className="w-fit" onClick={onGenerateMetadata} disabled={generatingMetadata}>
              {generatingMetadata ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Générer légende & hashtags
            </Button>
            {publishMetadata && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background/50 p-3">
                <p className="text-sm text-foreground">{publishMetadata.caption}</p>
                <div className="flex flex-wrap gap-1.5">
                  {publishMetadata.hashtags.map((h) => (
                    <span key={h} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      #{h}
                    </span>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-fit" onClick={copyMetadata}>
                  <Copy className="h-3.5 w-3.5" />
                  Copier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
