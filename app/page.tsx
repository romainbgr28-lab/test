"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import type {
  Clip,
  ImageModel,
  PublishMetadata,
  SubtitleEntry,
  VideoProject,
  VideoSegment,
  ViralityScore,
  VisualStyle,
} from "@/types";
import { buildClipsFromSegments, syncClipsToAudio, generateSubtitlesFromClips } from "@/lib/clips";
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
import { buildSceneContinuityPrompt, buildSubSegmentPrompts, getDimensionsForPlatform } from "@/lib/pollinations";
import { syncSegmentsToAudio } from "@/lib/sync";

const STEPS: StepDefinition[] = [
  { index: 0, title: "Configuration" },
  { index: 1, title: "Script" },
  { index: 2, title: "Voix off" },
  { index: 3, title: "Images" },
  { index: 4, title: "Aperçu" },
  { index: 5, title: "Export" },
];


export default function Home() {
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = React.useState(0);
  const [unlockedStep, setUnlockedStep] = React.useState(0);

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
  const [scriptText, setScriptText] = React.useState("");
  const [segments, setSegments] = React.useState<VideoSegment[]>([]);
  const [scriptValidated, setScriptValidated] = React.useState(false);
  const [validatingScript, setValidatingScript] = React.useState(false);
  const [researchSources, setResearchSources] = React.useState<string[]>([]);

  const [imageModel, setImageModel] = React.useState<ImageModel>("");
  const [generatingImages, setGeneratingImages] = React.useState(false);
  const [imageLoadingIds, setImageLoadingIds] = React.useState<Set<string>>(new Set());
  const [selectedVisualStyleId, setSelectedVisualStyleId] = React.useState<string | null>(null);
  const [selectedVisualStyle, setSelectedVisualStyle] = React.useState<VisualStyle | null>(null);

  const [voiceoverUrl, setVoiceoverUrl] = React.useState<string | undefined>(undefined);
  const [audioDuration, setAudioDuration] = React.useState<number>(0);
  const [subtitles, setSubtitles] = React.useState<SubtitleEntry[]>([]);
  const [clips, setClips] = React.useState<Clip[]>([]);
  const [beatDuration, setBeatDuration] = React.useState(2.5);
  const [generatingPrompts, setGeneratingPrompts] = React.useState(false);

  const [publishMetadata, setPublishMetadata] = React.useState<PublishMetadata | undefined>(undefined);
  const [generatingMetadata, setGeneratingMetadata] = React.useState(false);

  const [project, setProject] = React.useState<VideoProject | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const cost = estimateCost({
    mistralModel: config.mistralModel,
    imageModel,
    segmentCount: segments.length || 0,
  });

  const scriptCharCount = scriptText.length;
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
    setScriptText("");
    setScriptValidated(false);
    setScriptProgress([]);
    setResearchSources([]);
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
      let result: { viralityScore: ViralityScore; script: string } | null = null;
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
            sources?: string[];
            viralityScore?: ViralityScore;
            script?: string;
          };
          if (event.type === "sources" && Array.isArray(event.sources)) {
            setResearchSources(event.sources);
          } else if (event.type === "status" && event.message) {
            setScriptProgress((prev) => [...prev, { message: event.message!, score: event.score }]);
          } else if (event.type === "result" && event.viralityScore && event.script) {
            result = { viralityScore: event.viralityScore, script: event.script };
          } else if (event.type === "error" && event.message) {
            streamError = event.message;
          }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!result) throw new Error("Aucun script n'a été généré.");

      setViralityScore(result.viralityScore);
      setScriptText(result.script);
      setCurrentStep(1);
      setUnlockedStep((u) => Math.max(u, 1));
      toast({ title: "Script généré !", description: "Relis et modifie le script, puis valide.", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de la génération du script", description: message, variant: "error" });
    } finally {
      setGeneratingScript(false);
    }
  }

  async function handleValidateScript() {
    if (!scriptText.trim()) return;
    setValidatingScript(true);
    try {
      const words = scriptText.trim().split(/\s+/).length;
      const estimatedDuration = words / 2.5;
      const segmentCount = Math.max(1, Math.ceil(estimatedDuration / 3));
      const chunkDuration = estimatedDuration / segmentCount;

      // Split script into segments without generating image prompts yet
      // (prompts are generated AFTER audio is loaded so durations are accurate)
      const lines = scriptText.split("\n").filter((l) => l.trim());
      const chunksText: string[] = [];
      const linesPerChunk = Math.ceil(lines.length / segmentCount);
      for (let i = 0; i < segmentCount; i++) {
        chunksText.push(lines.slice(i * linesPerChunk, (i + 1) * linesPerChunk).join(" ").trim() || scriptText);
      }

      const newSegments: VideoSegment[] = chunksText.map((narration, i) => ({
        id: uid(),
        order: i + 1,
        narration,
        visualDescription: "",
        duration: Math.round(chunkDuration * 10) / 10,
        imagePrompt: "",
      }));

      setSegments(newSegments);
      setScriptValidated(true);
      setCurrentStep(2);
      setUnlockedStep((u) => Math.max(u, 2));
      toast({
        title: "Script validé !",
        description: `${segmentCount} segments créés. Charge ta voix off pour caler les durées.`,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de la validation", description: message, variant: "error" });
    } finally {
      setValidatingScript(false);
    }
  }

  async function generateImagePrompts(syncedSegments: VideoSegment[]): Promise<VideoSegment[]> {
    const imageCount = syncedSegments.length;
    const scriptText = syncedSegments
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.narration)
      .join("\n");

    const response = await fetch("/api/generate-image-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptText,
        imageCount,
        platform: config.platform,
        language: config.language,
        model: config.mistralModel,
        apiKey: config.mistralApiKey || undefined,
        stylePrompt: selectedVisualStyle?.stylePrompt || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Erreur lors de la génération des prompts d'images.");
    const prompts = data.prompts as string[];

    return syncedSegments.map((seg, i) => ({
      ...seg,
      visualDescription: prompts[i] ?? seg.visualDescription,
      imagePrompt: prompts[i] ?? seg.imagePrompt,
    }));
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

  const IMAGE_INTERVAL = 3; // seconds between image changes

  function getImageCountForSegment(segment: VideoSegment): number {
    return Math.max(1, Math.ceil(segment.duration / IMAGE_INTERVAL));
  }

  async function generateImagesForSegment(
    segment: VideoSegment,
    index: number
  ): Promise<{ imageUrl: string | null; imageUrls: string[]; isVariation: boolean }> {
    const { isVariation, referenceImages } = getEffectivePrompt(index);
    const count = getImageCountForSegment(segment);
    const stylePrompt = selectedVisualStyle?.stylePrompt;
    const prompts = buildSubSegmentPrompts(segment, count, stylePrompt);
    const urls = await Promise.all(
      prompts.map((prompt, i) => {
        const seed = segment.order * 1000 + i * 137;
        return generateImageForSegment(segment, prompt, referenceImages, seed);
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
    const { referenceImages } = getEffectivePrompt(index);
    const count = getImageCountForSegment(segment);
    const stylePrompt = selectedVisualStyle?.stylePrompt;
    const prompts = buildSubSegmentPrompts(segment, count, stylePrompt);
    const urls = await Promise.all(
      prompts.map((prompt, i) => {
        const seed = segment.order * 1000 + Math.floor(Math.random() * 500) + i * 137;
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

  async function handleAudioLoaded(url: string, duration: number) {
    setVoiceoverUrl(url);
    setAudioDuration(duration);

    // Recalculate real segment durations from actual audio length
    const synced = syncSegmentsToAudio(segments, duration);
    setSegments(synced);

    // Build clips & subtitles immediately for preview later
    const newClips = buildClipsFromSegments(synced, beatDuration);
    const syncedClips = syncClipsToAudio(newClips, duration);
    setClips(syncedClips);
    setSubtitles(generateSubtitlesFromClips(syncedClips));

    // Now that we have real durations, generate image prompts
    // so the correct number of images per segment is generated in the next step
    setGeneratingPrompts(true);
    try {
      const withPrompts = await generateImagePrompts(synced);
      setSegments(withPrompts);
      toast({
        title: "Audio synchronisé",
        description: `${synced.length} segments calés sur ${duration.toFixed(1)}s. Prompts d'images prêts.`,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec des prompts d'images", description: message, variant: "error" });
    } finally {
      setGeneratingPrompts(false);
    }
  }

  function handleProceedToImages() {
    setCurrentStep(3);
    setUnlockedStep((u) => Math.max(u, 3));
  }

  function handleProceedToPreview() {
    const builtClips = buildClipsFromSegments(segments, beatDuration);
    const finalClips = audioDuration > 0 ? syncClipsToAudio(builtClips, audioDuration) : builtClips;
    setClips(finalClips);
    if (subtitles.length === 0 && segments.length > 0) {
      setSubtitles(generateSubtitlesFromClips(finalClips));
    }
    setCurrentStep(4);
    setUnlockedStep((u) => Math.max(u, 4));
  }

  function handleProceedToVoice() {
    // Legacy: kept for compatibility but not used in main flow anymore
    setCurrentStep(2);
    setUnlockedStep((u) => Math.max(u, 2));
  }

  function handleClipDurationChange(id: string, duration: number) {
    setClips((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, duration } : c));
      setSubtitles(generateSubtitlesFromClips(updated));
      return updated;
    });
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
    const projectClips = clips.length > 0 ? clips : buildClipsFromSegments(segments, beatDuration);
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
      subtitles: subtitles.length > 0 ? subtitles : generateSubtitlesFromClips(projectClips),
      researchSources: researchSources.length > 0 ? researchSources : undefined,
      audioDuration: audioDuration > 0 ? audioDuration : undefined,
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
            <h1 className="text-xl font-bold tracking-tight gradient-text">StudioAI</h1>
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
          scriptText={scriptText}
          onScriptChange={setScriptText}
          onValidate={handleValidateScript}
          validating={validatingScript}
          validated={scriptValidated}
          sources={researchSources}
          targetDuration={config.duration}
        />
      )}

      {currentStep === 2 && (
        <StepVoice
          segments={segments}
          voiceoverUrl={voiceoverUrl}
          audioDuration={audioDuration}
          onAudioLoaded={handleAudioLoaded}
          generatingPrompts={generatingPrompts}
          onProceed={handleProceedToImages}
        />
      )}

      {currentStep === 3 && (
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
          onProceed={handleProceedToPreview}
        />
      )}

      {currentStep === 4 && (
        <StepVideo
          clips={clips}
          voiceoverUrl={voiceoverUrl}
          platform={config.platform}
          subtitles={subtitles}
          onSubtitlesChange={setSubtitles}
          onClipDurationChange={handleClipDurationChange}
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
