"use client";

import * as React from "react";
import { ImagePlus, ArrowRight, Loader2, Sparkles, RefreshCw, Plus, Minus, Upload, X, Film } from "lucide-react";
import type { ImageModel, VideoSegment, VisualStyle } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { ModelSelector } from "../ui/ModelSelector";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Skeleton } from "../ui/Skeleton";
import { VisualStyleManager } from "../ui/VisualStyleManager";
import { fileToDataUrl } from "@/lib/utils";

function buildImageModelOptions(leonardoModels: { id: string; name: string; description?: string }[]) {
  return leonardoModels.map((m) => ({
    value: m.id,
    label: m.name,
    description: m.description ?? "Coût en crédits Leonardo selon résolution et options",
  }));
}

interface StepImagesProps {
  segments: VideoSegment[];
  imageModel: ImageModel;
  onImageModelChange: (model: ImageModel) => void;
  onGenerateAllImages: () => void;
  onRegenerateSegment: (segId: string) => void;
  onRegenerateSlot: (segId: string, slotIdx: number) => void;
  onImageCountChange: (segId: string, count: number) => void;
  onSlotPromptChange: (segId: string, slotIdx: number, prompt: string) => void;
  onSlotReferenceChange: (segId: string, slotIdx: number, ref: string | undefined) => void;
  onDeleteSlotImage: (segId: string, slotIdx: number) => void;
  onAnimateSlot: (segId: string, slotIdx: number) => void;
  generatingImages: boolean;
  imageLoadingIds: Set<string>;
  videoLoadingIds: Set<string>;
  leonardoApiKey?: string;
  selectedVisualStyleId: string | null;
  onSelectVisualStyle: (style: VisualStyle | null) => void;
  selectedVisualStyle: VisualStyle | null;
  onProceed: () => void;
}

// ─── Slot Card ───────────────────────────────────────────────────────────────

interface SlotCardProps {
  segId: string;
  slotIdx: number;
  slotCount: number;
  prompt: string;
  referenceImage?: string;
  imageUrl?: string;
  motionVideoUrl?: string;
  loading: boolean;
  animating: boolean;
  onPromptChange: (v: string) => void;
  onReferenceChange: (ref: string | undefined) => void;
  onRegenerate: () => void;
  onDeleteImage: () => void;
  onAnimate: () => void;
}

function SlotCard({
  segId, slotIdx, slotCount, prompt, referenceImage, imageUrl, motionVideoUrl, loading, animating,
  onPromptChange, onReferenceChange, onRegenerate, onDeleteImage, onAnimate,
}: SlotCardProps) {
  const refInputRef = React.useRef<HTMLInputElement>(null);

  async function handleRefFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await fileToDataUrl(file);
    onReferenceChange(dataUrl);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Image {slotIdx + 1}/{slotCount}
        </span>
        <div className="flex items-center gap-1.5">
          {imageUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAnimate}
              disabled={loading || animating}
              title="Générer une animation vidéo à partir de cette image"
            >
              {animating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
              {animating ? "Animation…" : motionVideoUrl ? "Ré-animer" : "Animer"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading || animating}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Régénérer
          </Button>
        </div>
      </div>

      {/* Image preview */}
      <div className="relative mx-auto aspect-[9/16] w-28 overflow-hidden rounded-md border border-border bg-secondary shrink-0">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Image ${slotIdx + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={onDeleteImage}
              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"
              title="Supprimer l'image"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {slotIdx + 1}
          </div>
        )}
      </div>

      {/* Motion video preview */}
      {motionVideoUrl && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Animation générée</span>
          <video
            src={motionVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="mx-auto w-28 rounded-md border border-border bg-secondary object-cover"
          />
        </div>
      )}

      {/* Prompt */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Prompt</label>
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Décris ce que tu veux voir dans cette image…"
          className="min-h-[80px] text-xs leading-relaxed"
        />
      </div>

      {/* Reference image */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Image de référence (optionnel)</label>
        {referenceImage ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImage} alt="Référence" className="h-10 w-10 rounded-md border border-border object-cover" />
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 h-7 px-2"
              onClick={() => onReferenceChange(undefined)}
            >
              <X className="h-3 w-3" />
              Supprimer
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => refInputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            Ajouter une référence
          </Button>
        )}
        <input
          ref={refInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRefFile(f); }}
        />
      </div>
    </div>
  );
}

// ─── Segment Card ────────────────────────────────────────────────────────────

interface SegmentCardProps {
  segment: VideoSegment;
  imageLoadingIds: Set<string>;
  videoLoadingIds: Set<string>;
  onImageCountChange: (count: number) => void;
  onSlotPromptChange: (slotIdx: number, prompt: string) => void;
  onSlotReferenceChange: (slotIdx: number, ref: string | undefined) => void;
  onRegenerateSlot: (slotIdx: number) => void;
  onRegenerateSegment: () => void;
  onDeleteSlotImage: (slotIdx: number) => void;
  onAnimateSlot: (slotIdx: number) => void;
}

function SegmentCard({
  segment, imageLoadingIds, videoLoadingIds,
  onImageCountChange, onSlotPromptChange, onSlotReferenceChange,
  onRegenerateSlot, onRegenerateSegment, onDeleteSlotImage, onAnimateSlot,
}: SegmentCardProps) {
  const slots = segment.imageSlots ?? [];
  const autoCount = Math.max(1, Math.ceil(segment.duration / 3));
  const isManual = segment.imageCount !== undefined && segment.imageCount !== autoCount;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Header: phrase + durée + compteur d'images */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Phrase {segment.order}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {segment.duration.toFixed(1)}s
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isManual ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {isManual ? `${slots.length} imgs (manuel)` : `${autoCount} img${autoCount > 1 ? "s" : ""} (auto)`}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed line-clamp-3">
              {segment.narration}
            </p>
          </div>

          {/* Image count control */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onImageCountChange(slots.length - 1)}
              disabled={slots.length <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium tabular-nums">{slots.length || autoCount}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onImageCountChange(slots.length + 1)}
              disabled={slots.length >= 10}
            >
              <Plus className="h-3 w-3" />
            </Button>
            {isManual && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => onImageCountChange(autoCount)}
              >
                Auto
              </Button>
            )}
          </div>
        </div>

        {/* Régénérer tout le segment */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateSegment}
            disabled={slots.some((_, i) => imageLoadingIds.has(`${segment.id}-${i}`))}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Régénérer toute la phrase
          </Button>
        </div>

        {/* Slots */}
        {slots.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot, i) => (
              <SlotCard
                key={slot.id}
                segId={segment.id}
                slotIdx={i}
                slotCount={slots.length}
                prompt={slot.prompt}
                referenceImage={slot.referenceImage}
                imageUrl={slot.imageUrl}
                motionVideoUrl={slot.motionVideoUrl}
                loading={imageLoadingIds.has(`${segment.id}-${i}`)}
                animating={videoLoadingIds.has(`${segment.id}-${i}`)}
                onPromptChange={(v) => onSlotPromptChange(i, v)}
                onReferenceChange={(ref) => onSlotReferenceChange(i, ref)}
                onRegenerate={() => onRegenerateSlot(i)}
                onDeleteImage={() => onDeleteSlotImage(i)}
                onAnimate={() => onAnimateSlot(i)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Génère toutes les images pour initialiser les slots.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Step ───────────────────────────────────────────────────────────────

export function StepImages({
  segments, imageModel, onImageModelChange,
  onGenerateAllImages, onRegenerateSegment, onRegenerateSlot,
  onImageCountChange, onSlotPromptChange, onSlotReferenceChange, onDeleteSlotImage,
  onAnimateSlot,
  generatingImages, imageLoadingIds, videoLoadingIds,
  leonardoApiKey, selectedVisualStyleId, onSelectVisualStyle, selectedVisualStyle,
  onProceed,
}: StepImagesProps) {
  const [leonardoModels, setLeonardoModels] = React.useState<{ id: string; name: string; description?: string }[]>([]);
  const imageModelOptions = React.useMemo(() => buildImageModelOptions(leonardoModels), [leonardoModels]);

  React.useEffect(() => {
    if (!leonardoApiKey) { setLeonardoModels([]); return; }
    let cancelled = false;
    fetch("/api/leonardo-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: leonardoApiKey }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { models?: { id: string; name: string; description?: string }[] }) => {
        if (!cancelled && Array.isArray(data.models)) {
          setLeonardoModels(data.models);
          if (!imageModel && data.models.length > 0) onImageModelChange(data.models[0].id);
        }
      })
      .catch(() => { if (!cancelled) setLeonardoModels([]); });
    return () => { cancelled = true; };
  }, [leonardoApiKey]);

  const totalSlots = segments.reduce((sum, s) => sum + (s.imageSlots?.length ?? 0), 0);
  const generatedSlots = segments.reduce(
    (sum, s) => sum + (s.imageSlots?.filter((sl) => !!sl.imageUrl).length ?? 0),
    0
  );
  const canProceed = totalSlots > 0 && generatedSlots === totalSlots;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 3 — Images</CardTitle>
        <CardDescription>
          Chaque phrase du script a son propre prompt et son propre nombre d&apos;images. Modifie les prompts, ajoute une image de référence, ajuste le nombre d&apos;images avec les boutons +/−.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* Style global */}
        <Card className="bg-secondary/30">
          <CardContent className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-2">
            <ModelSelector
              label="Modèle d'image (Leonardo)"
              value={imageModel}
              onChange={(v) => onImageModelChange(v as ImageModel)}
              options={imageModelOptions}
            />
            <div className="flex flex-col gap-1.5 lg:col-span-2">
              <VisualStyleManager selectedId={selectedVisualStyleId} onSelect={onSelectVisualStyle} />
              {selectedVisualStyle && (
                <p className="text-xs text-muted-foreground mt-1">
                  Style global : « {selectedVisualStyle.stylePrompt} » — appliqué à tous les prompts.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generate all */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Génération des visuels</span>
            <span className="text-xs text-muted-foreground">
              {generatedSlots}/{totalSlots} images générées
            </span>
          </div>
          <Button onClick={onGenerateAllImages} disabled={generatingImages}>
            {generatingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Tout générer
          </Button>
        </div>

        {/* Segments */}
        <div className="flex flex-col gap-4">
          {[...segments].sort((a, b) => a.order - b.order).map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              imageLoadingIds={imageLoadingIds}
              videoLoadingIds={videoLoadingIds}
              onImageCountChange={(count) => onImageCountChange(segment.id, count)}
              onSlotPromptChange={(idx, prompt) => onSlotPromptChange(segment.id, idx, prompt)}
              onSlotReferenceChange={(idx, ref) => onSlotReferenceChange(segment.id, idx, ref)}
              onRegenerateSlot={(idx) => onRegenerateSlot(segment.id, idx)}
              onRegenerateSegment={() => onRegenerateSegment(segment.id)}
              onDeleteSlotImage={(idx) => onDeleteSlotImage(segment.id, idx)}
              onAnimateSlot={(idx) => onAnimateSlot(segment.id, idx)}
            />
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={onProceed} disabled={!canProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          Passer à l&apos;aperçu vidéo
        </Button>
      </CardFooter>
    </Card>
  );
}
