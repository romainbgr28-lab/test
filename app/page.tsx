"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import type {
  ImageModel,
  Language,
  MistralModel,
  NicheProfile,
  Platform,
  VideoProject,
  VideoSegment,
  ViralityScore,
  VoiceId,
} from "@/types";
import { Stepper, type StepDefinition } from "./components/ui/Stepper";
import { CostBadge } from "./components/ui/CostBadge";
import { StepConfig, type StepConfigState } from "./components/steps/StepConfig";
import { StepScript } from "./components/steps/StepScript";
import { StepAssets } from "./components/steps/StepAssets";
import { StepExport } from "./components/steps/StepExport";
import { useToast } from "./components/ui/Toast";
import { uid } from "@/lib/utils";
import { estimateCost, formatEur, formatPollen } from "@/lib/cost-calculator";
import { getDimensionsForPlatform } from "@/lib/pollinations";

const STEPS: StepDefinition[] = [
  { index: 0, title: "Configuration" },
  { index: 1, title: "Script" },
  { index: 2, title: "Assets" },
  { index: 3, title: "Export" },
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
  const [unlockedStep, setUnlockedStep] = React.useState(0);

  const [config, setConfig] = React.useState<StepConfigState>({
    subject: "",
    profile: null,
    platform: "tiktok",
    duration: 60,
    language: "fr",
    mistralModel: "mistral-small-latest",
    mistralApiKey: "",
    pollinationsApiKey: "",
  });

  const [generatingScript, setGeneratingScript] = React.useState(false);
  const [viralityScore, setViralityScore] = React.useState<ViralityScore | null>(null);
  const [segments, setSegments] = React.useState<VideoSegment[]>([]);
  const [regeneratingSegmentId, setRegeneratingSegmentId] = React.useState<string | null>(null);
  const [scriptValidated, setScriptValidated] = React.useState(false);

  const [imageModel, setImageModel] = React.useState<ImageModel>("flux");
  const [generatingImages, setGeneratingImages] = React.useState(false);
  const [imageLoadingIds, setImageLoadingIds] = React.useState<Set<string>>(new Set());

  const [voiceId, setVoiceId] = React.useState<VoiceId>("nova");
  const [voiceoverUrl, setVoiceoverUrl] = React.useState<string | undefined>(undefined);
  const [generatingVoice, setGeneratingVoice] = React.useState(false);

  const [project, setProject] = React.useState<VideoProject | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const cost = estimateCost({
    mistralModel: config.mistralModel,
    imageModel,
    segmentCount: segments.length || 0,
  });

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
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: config.subject,
          platform: config.platform,
          language: config.language,
          nicheInstructions: config.profile.instructions,
          duration: config.duration,
          model: config.mistralModel,
          apiKey: config.mistralApiKey || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Erreur lors de la génération du script.");
      }
      setViralityScore(data.viralityScore);
      setSegments((data.segments as RawSegment[]).map(toSegment));
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
          nicheInstructions: config.profile.instructions,
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
      if (!response.ok) {
        throw new Error(data?.error ?? "Erreur lors de la régénération du segment.");
      }
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

  async function generateImageForSegment(segment: VideoSegment): Promise<string | null> {
    if (!config.profile) return null;
    const dimensions = getDimensionsForPlatform(config.platform);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: segment.visualDescription,
          model: imageModel,
          width: dimensions.width,
          height: dimensions.height,
          apiKey: config.pollinationsApiKey || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Erreur lors de la génération de l'image.");
      }
      return data.imageUrl as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: `Échec image segment ${segment.order}`, description: message, variant: "error" });
      return null;
    }
  }

  async function handleGenerateAllImages() {
    setGeneratingImages(true);
    setImageLoadingIds(new Set(segments.map((s) => s.id)));
    try {
      const results = await Promise.all(
        segments.map(async (segment) => {
          const imageUrl = await generateImageForSegment(segment);
          return { id: segment.id, imageUrl };
        })
      );
      setSegments((prev) =>
        prev.map((s) => {
          const result = results.find((r) => r.id === s.id);
          if (result?.imageUrl) {
            return { ...s, imageUrl: result.imageUrl, imageBlob: result.imageUrl };
          }
          return s;
        })
      );
      const successCount = results.filter((r) => r.imageUrl).length;
      toast({
        title: "Génération des images terminée",
        description: `${successCount}/${segments.length} images générées avec succès.`,
        variant: successCount === segments.length ? "success" : "info",
      });
    } finally {
      setGeneratingImages(false);
      setImageLoadingIds(new Set());
    }
  }

  async function handleRegenerateImage(id: string) {
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    setImageLoadingIds((prev) => new Set(prev).add(id));
    const imageUrl = await generateImageForSegment(segment);
    if (imageUrl) {
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, imageUrl, imageBlob: imageUrl } : s)));
      toast({ title: `Image du segment ${segment.order} régénérée`, variant: "success" });
    }
    setImageLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleGenerateVoice() {
    setGeneratingVoice(true);
    try {
      const fullText = segments
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.narration)
        .join(" ");
      const response = await fetch("/api/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText, voice: voiceId, apiKey: config.pollinationsApiKey || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Erreur lors de la génération de la voix off.");
      }
      setVoiceoverUrl(data.audioUrl as string);
      toast({ title: "Voix off générée !", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de la génération de la voix off", description: message, variant: "error" });
    } finally {
      setGeneratingVoice(false);
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
      voiceId,
      mistralModel: config.mistralModel,
      imageModel,
      viralityScore: viralityScore ?? undefined,
      createdAt: new Date().toISOString(),
    };
    setProject(newProject);
    setCurrentStep(3);
    setUnlockedStep((u) => Math.max(u, 3));
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
            <p className="text-sm text-muted-foreground">Crée des vidéos faceless virales en 4 étapes</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Coût estimé total</span>
          <div className="flex gap-2">
            <CostBadge label={formatPollen(cost.totalPollen)} />
            <CostBadge label={formatEur(cost.totalEur)} />
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
        <StepAssets
          segments={segments}
          imageModel={imageModel}
          onImageModelChange={setImageModel}
          onGenerateAllImages={handleGenerateAllImages}
          onRegenerateImage={handleRegenerateImage}
          generatingImages={generatingImages}
          imageLoadingIds={imageLoadingIds}
          voiceId={voiceId}
          onVoiceChange={setVoiceId}
          onGenerateVoice={handleGenerateVoice}
          voiceoverUrl={voiceoverUrl}
          generatingVoice={generatingVoice}
          onProceed={handleProceedToExport}
        />
      )}

      {currentStep === 3 && <StepExport project={project} onExport={handleExport} exporting={exporting} />}
    </main>
  );
}
