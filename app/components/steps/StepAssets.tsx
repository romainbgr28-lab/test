"use client";

import * as React from "react";
import { ImagePlus, Mic, ArrowRight, Loader2 } from "lucide-react";
import type { ImageModel, VideoSegment, VoiceId } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { ModelSelector } from "../ui/ModelSelector";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { AudioPlayer } from "../ui/AudioPlayer";
import { Skeleton } from "../ui/Skeleton";
import { IMAGE_COSTS } from "@/lib/cost-calculator";
import { VOICE_DESCRIPTIONS } from "@/lib/pollinations";

const IMAGE_MODEL_OPTIONS = (Object.keys(IMAGE_COSTS) as ImageModel[]).map((key) => ({
  value: key,
  label: key,
  description: IMAGE_COSTS[key].label,
}));

const VOICE_OPTIONS = (Object.keys(VOICE_DESCRIPTIONS) as VoiceId[]).map((key) => ({
  value: key,
  label: VOICE_DESCRIPTIONS[key],
}));

interface StepAssetsProps {
  segments: VideoSegment[];
  imageModel: ImageModel;
  onImageModelChange: (model: ImageModel) => void;
  onGenerateAllImages: () => void;
  onRegenerateImage: (id: string) => void;
  generatingImages: boolean;
  imageLoadingIds: Set<string>;
  voiceId: VoiceId;
  onVoiceChange: (voice: VoiceId) => void;
  onGenerateVoice: () => void;
  voiceoverUrl?: string;
  generatingVoice: boolean;
  onProceed: () => void;
}

export function StepAssets({
  segments,
  imageModel,
  onImageModelChange,
  onGenerateAllImages,
  onRegenerateImage,
  generatingImages,
  imageLoadingIds,
  voiceId,
  onVoiceChange,
  onGenerateVoice,
  voiceoverUrl,
  generatingVoice,
  onProceed,
}: StepAssetsProps) {
  const generatedCount = segments.filter((s) => !!s.imageUrl).length;
  const canProceed = generatedCount === segments.length && segments.length > 0 && !!voiceoverUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 3 — Assets</CardTitle>
        <CardDescription>Génère les visuels et la voix off de ta vidéo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="bg-secondary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImagePlus className="h-4 w-4" />
                Images
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ModelSelector
                label="Modèle d'image (Pollinations)"
                value={imageModel}
                onChange={(v) => onImageModelChange(v as ImageModel)}
                options={IMAGE_MODEL_OPTIONS}
              />
              <div className="flex items-center justify-between">
                <Button onClick={onGenerateAllImages} disabled={generatingImages}>
                  {generatingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Générer toutes les images
                </Button>
                <span className="text-sm text-muted-foreground">
                  {generatedCount}/{segments.length} images générées
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {segments.map((segment) => {
                  const loading = imageLoadingIds.has(segment.id);
                  return (
                    <div key={segment.id} className="flex flex-col gap-1.5">
                      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-secondary">
                        {loading ? (
                          <Skeleton className="h-full w-full" />
                        ) : segment.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={segment.imageUrl}
                            alt={`Visuel segment ${segment.order}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            Segment {segment.order}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onRegenerateImage(segment.id)}
                        disabled={loading}
                      >
                        Regénérer
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4" />
                Voix off
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Voix (Pollinations TTS)</label>
                <Select value={voiceId} onChange={(v) => onVoiceChange(v as VoiceId)} options={VOICE_OPTIONS} />
              </div>
              <Button onClick={onGenerateVoice} disabled={generatingVoice} className="w-fit">
                {generatingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Générer la voix off
              </Button>
              <AudioPlayer src={voiceoverUrl} loading={generatingVoice} onRegenerate={onGenerateVoice} />
            </CardContent>
          </Card>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} disabled={!canProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          Passer à l'export
        </Button>
      </CardFooter>
    </Card>
  );
}
