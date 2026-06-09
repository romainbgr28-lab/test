"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import type {
  ImageModel,
  Language,
  MistralModel,
  NicheProfile,
  Platform,
  PublishMetadata,
  VideoProject,
  VideoSegment,
  ViralityScore,
  VisualStyle,
} from "@/types";
import { Stepper, type StepDefinition } from "./components/ui/Stepper";
import { CostBadge } from "./components/ui/CostBadge";
import { StepConfig, type StepConfigState } from "./components/steps/StepConfig";
import { StepScript } from "./components/steps/StepScript";
import { StepImages } from "./components/steps/StepImages";
import { StepVoice } from "./components/steps/StepVoice";
import { StepVideo } from "./components/steps/StepVideo";
import { StepExport } from "./components/steps/StepExport";
import { useToast } from "./components/ui/Toast";
import { uid } from "@/lib/utils";
import { estimateCost, estimateVoiceCost, formatEur, formatPollen } from "@/lib/cost-calculator";
import { buildSceneContinuityPrompt, getDimensionsForPlatform } from "@/lib/pollinations";
import { syncSegmentsToAudio } from "@/lib/sync";

const STEPS: StepDefinition[] = [
  { index: 0, title: "Configuration" },
  { index: 1, title: "Script" },
  { index: 2, title: "Images" },
  { index: 3, title: "Voix off" },
  { index: 4, title: "Aperçu" },
  { index: 5, title: "Export" },
];

interface RawSegment {
  order: number;
  narration: string;
  visualDescription: string;
  duration: number;
}

function toSegment(raw: RawSegment): VideoSegment {
  return {
    id: uid(),
    order: raw.order,
    narration: raw.narration,
    visualDescription: raw.visualDescription,
    duration: raw.duration,
  };
}

export default function Home() {
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = React.useState(0);
  const [unlockedStep, setUnlockedStep] = React.useState(STEPS.length - 1);

  const [config, setConfig] = React.useState<StepConfigState>({
    subject: "",
    sourceContent: "",
    profile: null,
    platform: "tiktok",
    duration: 60,
    language: "fr",
    mistralModel: "mistral-small-latest",
    mistralApiKey: "",
    pollinationsApiKey: "",
    leonardoApiKey: "",
    googleTtsKey: "",
  });

  const [generatingScript, setGeneratingScript] = React.useState(false);
  const [scriptProgress, setScriptProgress] = React.useState<{ message: string; score?: number }[]>([]);
  const [viralityScore, setViralityScore] = React.useState<ViralityScore | null>(null);
  const [segments, setSegments] = React.useState<VideoSegment[]>([]);
  const [regeneratingSegmentId, setRegeneratingSegmentId] = React.useState<string | null>(null);
  const [scriptValidated, setScriptValidated] = React.useState(false);

  const [imageModel, setImageModel] = React.useState<ImageModel>("");
  const [generatingImages, setGeneratingImages] = React.useState(false);
  const [imageLoadingIds, setImageLoadingIds] = React.useState<Set<string>>(new Set());
  const [selectedVisualStyleId, setSelectedVisualStyleId] = React.useState<string | null>(null);
  const [selectedVisualStyle, setSelectedVisualStyle] = React.useState<VisualStyle | null>(null);

  const [voiceoverUrl, setVoiceoverUrl] = React.useState<string | undefined>(undefined);
  const [audioDuration, setAudioDuration] = React.useState<number>(0);

  const [publishMetadata, setPublishMetadata] = React.useState<PublishMetadata | undefined>(undefined);
  const [generatingMetadata, setGeneratingMetadata] = React.useState(false);

  const [project, setProject] = React.useState<VideoProject | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const cost = estimateCost({
    mistralModel: config.mistralModel,
    imageModel,
    segmentCount: segments.length || 0,
  });

  const scriptCharCount = segments.reduce((acc, s) => acc + s.narration.length, 0);
  const voiceCost = estimateVoiceCost(scriptCharCount);

  function updateConfig(patch: Partial<StepConfigState>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  function goToStep(index: number) {
    if (index <= unlockedStep) setCurrentStep(index);
  }

  async function handleGenerateScript() {
    if (!config.profile) return;
    setGeneratingScript(true);
    setViralityScore(null);
    setSegments([]);
    setScriptValidated(false);
    setScriptProgress([]);
    setUnlockedStep((u) => Math.max(u, 1));
    setCurrentStep(1);
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: config.subject,
          sourceContent: config.sourceContent || undefined,
          platform: config.platform,
          language: config.language,
          scriptInstructions: config.profile.scriptInstructions,
          viralityInstructions: config.profile.viralityInstructions || undefined,
          duration: config.duration,
          model: config.mistralModel,
          apiKey: config.mistralApiKey || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Erreur lors de la génération du script.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: { viralityScore: ViralityScore; segments: RawSegment[] } | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          const event = JSON.parse(jsonStr) as {
            type: string;
            message?: string;
            score?: number;
            viralityScore?: ViralityScore;
            segments?: RawSegment[];
          };
          if (event.type === "status" && event.message) {
            setScriptProgress((prev) => [...prev, { message: event.message!, score: event.score }]);
          } else if (event.type === "result" && event.viralityScore && event.segments) {
            result = { viralityScore: event.viralityScore, segments: event.segments };
          } else if (event.type === "error" && event.message) {
            streamError = event.message;
          }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!result) throw new Error("Aucun script n'a été généré.");

      setViralityScore(result.viralityScore);
      setSegments(result.segments.map(toSegment));
      setCurrentStep(1);
      setUnlockedStep((u) => Math.max(u, 1));
      toast({ title: "Script généré !", description: "Relis et ajuste les segments avant de valider.", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de la génération du script", description: message, variant: "error" });
    } finally {
      setGeneratingScript(false);
    }
  }

  function handleSegmentChange(id: string, patch: Partial<VideoSegment>) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function handleRegenerateSegment(id: string) {
    if (!config.profile) return;
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    setRegeneratingSegmentId(id);
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: config.subject,
          platform: config.platform,
          language: config.language,
          scriptInstructions: config.profile.scriptInstructions,
          viralityInstructions: config.profile.viralityInstructions || undefined,
          duration: config.duration,
          model: config.mistralModel,
          apiKey: config.mistralApiKey || undefined,
          regenerateSegmentOrder: segment.order,
          existingSegment: {
            order: segment.order,
            narration: segment.narration,
            visualDescription: segment.visualDescription,
            duration: segment.duration,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Erreur lors de la régénération du segment.");
      const raw = data.segment as RawSegment;
      handleSegmentChange(id, {
        narration: raw.narration,
        visualDescription: raw.visualDescription,
        duration: raw.duration,
      });
      toast({ title: `Segment ${segment.order} régénéré`, variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de la régénération", description: message, variant: "error" });
    } finally {
      setRegeneratingSegmentId(null);
    }
  }

  function handleValidateScript() {
    setScriptValidated(true);
    setCurrentStep(2);
    setUnlockedStep((u) => Math.max(u, 2));
    toast({ title: "Script validé", description: "Passe à la génération des assets.", variant: "success" });
  }

  function getEffectivePrompt(index: number): { prompt: string; isVariation: boolean; referenceImages?: string[] } {
    const segment = segments[index];
    const { prompt: suggested, isVariation } = buildSceneContinuityPrompt(segments, index);
    const base = segment.imagePrompt?.trim() || suggested;
    const referenceImages = selectedVisualStyle?.referenceImages?.length
      ? selectedVisualStyle.referenceImages
      : undefined;
    return { prompt: base, isVariation, referenceImages };
  }

  function handleSegmentPromptChange(id: string, imagePrompt: string) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, imagePrompt } : s)));
  }

  function handleSelectVisualStyle(style: VisualStyle | null) {
    setSelectedVisualStyle(style);
    setSelectedVisualStyleId(style?.id ?? null);
  }

  async function generateImageForSegment(
    segment: VideoSegment,
    promptOverride: string,
    referenceImages?: string[],
    seedOverride?: number
  ): Promise<string | null> {
    if (!config.profile) return null;
    const dimensions = getDimensionsForPlatform(config.platform);
    const seed = seedOverride ?? segment.order * 1000;
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptOverride,
          model: imageModel,
          width: dimensions.width,
          height: dimensions.height,
          seed,
          apiKey: config.leonardoApiKey || undefined,
          referenceImages: referenceImages || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Erreur lors de la génération de l'image.");
      return data.imageUrl as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: `Échec image segment ${segment.order}`, description: message, variant: "error" });
      return null;
    }
  }

  const IMAGE_INTERVAL = 2.5; // seconds between image changes

  function getImageCountForSegment(segment: VideoSegment): number {
    return Math.max(1, Math.ceil(segment.duration / IMAGE_INTERVAL));
  }

  async function generateImagesForSegment(
    segment: VideoSegment,
    index: number
  ): Promise<{ imageUrl: string | null; imageUrls: string[]; isVariation: boolean }> {
    const { prompt, isVariation, referenceImages } = getEffectivePrompt(index);
    const count = getImageCountForSegment(segment);
    if (count <= 1) {
      const imageUrl = await generateImageForSegment(segment, prompt, referenceImages);
      return { imageUrl, imageUrls: imageUrl ? [imageUrl] : [], isVariation };
    }
    const urls = await Promise.all(
      Array.from({ length: count }, (_, i) => {
        const variationPrompt = i === 0 ? prompt : `${prompt}, slight variation`;
        const seed = segment.order * 1000 + i * 137;
        return generateImageForSegment(segment, variationPrompt, referenceImages, seed);
      })
    );
    const imageUrls = urls.filter((u): u is string => !!u);
    return { imageUrl: imageUrls[0] ?? null, imageUrls, isVariation };
  }

  async function handleGenerateAllImages() {
    setGeneratingImages(true);
    setImageLoadingIds(new Set(segments.map((s) => s.id)));
    try {
      const results = await Promise.all(
        segments.map(async (segment, index) => {
          const result = await generateImagesForSegment(segment, index);
          return { id: segment.id, ...result };
        })
      );
      setSegments((prev) =>
        prev.map((s) => {
          const result = results.find((r) => r.id === s.id);
          if (result?.imageUrl) {
            return { ...s, imageUrl: result.imageUrl, imageBlob: result.imageUrl, imageUrls: result.imageUrls, isSceneVariation: result.isVariation };
          }
          return s;
        })
      );
      const successCount = results.filter((r) => r.imageUrl).length;
      toast({
        title: "Génération des images terminée",
        description: `${successCount}/${segments.length} segments générés avec succès.`,
        variant: successCount === segments.length ? "success" : "info",
      });
    } finally {
      setGeneratingImages(false);
      setImageLoadingIds(new Set());
    }
  }

  async function handleRegenerateImage(id: string) {
    const index = segments.findIndex((s) => s.id === id);
    if (index === -1) return;
    const segment = segments[index];
    setImageLoadingIds((prev) => new Set(prev).add(id));
    const result = await generateImagesForSegment(segment, index);
    if (result.imageUrl) {
      setSegments((prev) =>
        prev.map((s) => s.id === id ? { ...s, imageUrl: result.imageUrl!, imageBlob: result.imageUrl!, imageUrls: result.imageUrls, isSceneVariation: result.isVariation } : s)
      );
      toast({ title: `Images du segment ${segment.order} régénérées (${result.imageUrls.length})`, variant: "success" });
    }
    setImageLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleGenerateImageVariation(id: string) {
    const index = segments.findIndex((s) => s.id === id);
    if (index === -1) return;
    const segment = segments[index];
    setImageLoadingIds((prev) => new Set(prev).add(id));
    const { prompt: basePrompt, referenceImages } = getEffectivePrompt(index);
    const count = getImageCountForSegment(segment);
    const urls = await Promise.all(
      Array.from({ length: count }, (_, i) => {
        const prompt = `${basePrompt}, slight variation, same composition, different angle`;
        const seed = segment.order * 1000 + Math.floor(Math.random() * 999) + i * 137;
        return generateImageForSegment(segment, prompt, referenceImages, seed);
      })
    );
    const imageUrls = urls.filter((u): u is string => !!u);
    if (imageUrls.length > 0) {
      setSegments((prev) =>
        prev.map((s) => s.id === id ? { ...s, imageUrl: imageUrls[0], imageBlob: imageUrls[0], imageUrls, isSceneVariation: true } : s)
      );
      toast({ title: `${imageUrls.length} variations générées pour le segment ${segment.order}`, variant: "success" });
    }
    setImageLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleAudioLoaded(url: string, duration: number) {
    setVoiceoverUrl(url);
    setAudioDuration(duration);
    const synced = syncSegmentsToAudio(segments, duration);
    setSegments(synced);
    toast({
      title: "Audio synchronisé",
      description: `${synced.length} segments synchronisés sur ${duration.toFixed(1)}s`,
      variant: "success",
    });
  }

  function handleProceedToVoice() {
    setCurrentStep(3);
    setUnlockedStep((u) => Math.max(u, 3));
  }

  function handleProceedToPreview() {
    setCurrentStep(4);
    setUnlockedStep((u) => Math.max(u, 4));
  }

  async function handleGenerateMetadata() {
    setGeneratingMetadata(true);
    try {
      const narration = segments
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.narration)
        .join(" ");
      const response = await fetch("/api/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: config.subject,
          narration,
          platform: config.platform,
          language: config.language,
          model: config.mistralModel,
          apiKey: config.mistralApiKey || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Erreur lors de la génération des métadonnées.");
      setPublishMetadata(data as PublishMetadata);
      toast({ title: "Légende générée !", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de la génération", description: message, variant: "error" });
    } finally {
      setGeneratingMetadata(false);
    }
  }

  function handleProceedToExport() {
    if (!config.profile) return;
    const newProject: VideoProject = {
      id: uid(),
      subject: config.subject,
      profile: config.profile,
      targetDuration: config.duration,
      segments,
      voiceoverUrl,
      voiceId: "",
      mistralModel: config.mistralModel,
      imageModel,
      viralityScore: viralityScore ?? undefined,
      publishMetadata: publishMetadata ?? undefined,
      createdAt: new Date().toISOString(),
    };
    setProject(newProject);
    setCurrentStep(5);
    setUnlockedStep((u) => Math.max(u, 5));
  }

  async function handleExport() {
    if (!project) return;
    setExporting(true);
    try {
      const response = await fetch("/api/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erreur lors de la génération du ZIP.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studioai-${project.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "ZIP téléchargé !", description: "Ton projet est prêt pour le montage.", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de l'export", description: message, variant: "error" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Wand2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">StudioAI</h1>
            <p className="text-sm text-muted-foreground">Crée des vidéos faceless virales en 6 étapes</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Coût estimé total</span>
          <div className="flex gap-2">
            <CostBadge label={formatPollen(cost.totalPollen)} />
            <CostBadge label={formatEur(cost.totalEur)} />
            {scriptCharCount > 0 && voiceCost.isFree && (
              <CostBadge label="Voix : Gratuit" className="border-green-700/40 bg-green-500/10 text-green-300" />
            )}
          </div>
        </div>
      </header>

      <Stepper steps={STEPS} current={currentStep} unlocked={unlockedStep} onSelect={goToStep} />

      {currentStep === 0 && (
        <StepConfig state={config} onChange={updateConfig} onGenerate={handleGenerateScript} generating={generatingScript} />
      )}

      {currentStep === 1 && (
        <StepScript
          loading={generatingScript}
          progress={scriptProgress}
          viralityScore={viralityScore}
          segments={segments}
          onSegmentChange={handleSegmentChange}
          onRegenerateSegment={handleRegenerateSegment}
          regeneratingSegmentId={regeneratingSegmentId}
          onValidate={handleValidateScript}
          validated={scriptValidated}
        />
      )}

      {currentStep === 2 && (
        <StepImages
          segments={segments}
          imageModel={imageModel}
          onImageModelChange={setImageModel}
          onGenerateAllImages={handleGenerateAllImages}
          onRegenerateImage={handleRegenerateImage}
          onGenerateImageVariation={handleGenerateImageVariation}
          generatingImages={generatingImages}
          imageLoadingIds={imageLoadingIds}
          onSegmentPromptChange={handleSegmentPromptChange}
          leonardoApiKey={config.leonardoApiKey}
          selectedVisualStyleId={selectedVisualStyleId}
          onSelectVisualStyle={handleSelectVisualStyle}
          selectedVisualStyle={selectedVisualStyle}
          onProceed={handleProceedToVoice}
        />
      )}

      {currentStep === 3 && (
        <StepVoice
          segments={segments}
          voiceoverUrl={voiceoverUrl}
          audioDuration={audioDuration}
          onAudioLoaded={handleAudioLoaded}
          onProceed={handleProceedToPreview}
        />
      )}

      {currentStep === 4 && (
        <StepVideo
          segments={segments}
          voiceoverUrl={voiceoverUrl}
          platform={config.platform}
          onProceed={handleProceedToExport}
        />
      )}

      {currentStep === 5 && (
        <StepExport
          project={project}
          onExport={handleExport}
          exporting={exporting}
          publishMetadata={publishMetadata}
          onGenerateMetadata={handleGenerateMetadata}
          generatingMetadata={generatingMetadata}
        />
      )}
    </main>
  );
}
