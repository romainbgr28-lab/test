"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import type {
  Clip,
  ImageModel,
  ImageSlot,
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
import { detectPhrasesFromAudio, splitScriptIntoSentences, mapSentencesToPhrases } from "@/lib/audio-analysis";

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
  const [videoLoadingIds, setVideoLoadingIds] = React.useState<Set<string>>(new Set());
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

    // Initialiser les slots par segment avec des prompts distincts
    return syncedSegments.map((seg, i) => {
      const basePrompt = prompts[i] ?? seg.visualDescription;
      const count = seg.imageCount ?? Math.max(1, Math.ceil(seg.duration / 3));
      const stylePrompt = selectedVisualStyle?.stylePrompt;
      const subPrompts = buildSubSegmentPrompts({ ...seg, imagePrompt: basePrompt }, count, stylePrompt);
      const slots: ImageSlot[] = subPrompts.map((p) => ({ id: uid(), prompt: p }));
      return { ...seg, visualDescription: basePrompt, imagePrompt: basePrompt, imageSlots: slots };
    });
  }

  function handleSelectVisualStyle(style: VisualStyle | null) {
    setSelectedVisualStyle(style);
    setSelectedVisualStyleId(style?.id ?? null);
  }

  function handleImageCountChange(segId: string, count: number) {
    const newCount = Math.max(1, Math.min(10, count));
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        const stylePrompt = selectedVisualStyle?.stylePrompt;
        const subPrompts = buildSubSegmentPrompts(s, newCount, stylePrompt);
        const existing = s.imageSlots ?? [];
        const newSlots: ImageSlot[] = Array.from({ length: newCount }, (_, i) => ({
          id: existing[i]?.id ?? uid(),
          prompt: existing[i]?.prompt ?? subPrompts[i] ?? s.imagePrompt ?? "",
          referenceImage: existing[i]?.referenceImage,
          imageUrl: existing[i]?.imageUrl,
        }));
        return { ...s, imageCount: newCount, imageSlots: newSlots };
      })
    );
  }

  function handleSlotPromptChange(segId: string, slotIdx: number, prompt: string) {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId || !s.imageSlots) return s;
        const slots = s.imageSlots.map((slot, i) => (i === slotIdx ? { ...slot, prompt } : slot));
        return { ...s, imageSlots: slots };
      })
    );
  }

  function handleSlotReferenceChange(segId: string, slotIdx: number, referenceImage: string | undefined) {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId || !s.imageSlots) return s;
        const slots = s.imageSlots.map((slot, i) => (i === slotIdx ? { ...slot, referenceImage } : slot));
        return { ...s, imageSlots: slots };
      })
    );
  }

  async function generateOneSlot(segment: VideoSegment, slotIdx: number): Promise<string | null> {
    const slot = segment.imageSlots?.[slotIdx];
    if (!slot) return null;
    const dimensions = getDimensionsForPlatform(config.platform);
    const styleRefs = selectedVisualStyle?.referenceImages?.length ? selectedVisualStyle.referenceImages : [];
    const refImages = slot.referenceImage ? [slot.referenceImage, ...styleRefs] : styleRefs.length ? styleRefs : undefined;
    const seed = segment.order * 1000 + slotIdx * 137;
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: slot.prompt,
          model: imageModel,
          width: dimensions.width,
          height: dimensions.height,
          seed,
          apiKey: config.leonardoApiKey || undefined,
          referenceImages: refImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Erreur génération image");
      return data.imageUrl as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: `Échec image ${segment.order}-${slotIdx + 1}`, description: message, variant: "error" });
      return null;
    }
  }

  function applySlotResults(segId: string, slotResults: (string | null)[]) {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId || !s.imageSlots) return s;
        const slots = s.imageSlots.map((slot, i) =>
          slotResults[i] ? { ...slot, imageUrl: slotResults[i]! } : slot
        );
        const imageUrls = slots.map((sl) => sl.imageUrl).filter(Boolean) as string[];
        return { ...s, imageSlots: slots, imageUrl: imageUrls[0], imageBlob: imageUrls[0], imageUrls };
      })
    );
  }

  async function handleGenerateAllImages() {
    setGeneratingImages(true);
    const allSlotIds = new Set(
      segments.flatMap((s) => (s.imageSlots ?? []).map((_, i) => `${s.id}-${i}`))
    );
    setImageLoadingIds(allSlotIds);
    try {
      await Promise.all(
        segments.map(async (segment) => {
          if (!segment.imageSlots?.length) return;
          const results = await Promise.all(
            segment.imageSlots.map((_, i) => generateOneSlot(segment, i))
          );
          applySlotResults(segment.id, results);
          setImageLoadingIds((prev) => {
            const next = new Set(prev);
            segment.imageSlots!.forEach((_, i) => next.delete(`${segment.id}-${i}`));
            return next;
          });
        })
      );
      toast({ title: "Toutes les images générées", variant: "success" });
    } finally {
      setGeneratingImages(false);
      setImageLoadingIds(new Set());
    }
  }

  function handleDeleteSlotImage(segId: string, slotIdx: number) {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId || !s.imageSlots) return s;
        const slots = s.imageSlots.map((slot, i) => (i === slotIdx ? { ...slot, imageUrl: undefined } : slot));
        const imageUrls = slots.map((sl) => sl.imageUrl).filter(Boolean) as string[];
        return { ...s, imageSlots: slots, imageUrl: imageUrls[0], imageBlob: imageUrls[0], imageUrls };
      })
    );
  }

  async function handleRegenerateSlot(segId: string, slotIdx: number) {
    const segment = segments.find((s) => s.id === segId);
    if (!segment) return;
    const loadId = `${segId}-${slotIdx}`;
    setImageLoadingIds((prev) => new Set(prev).add(loadId));
    const url = await generateOneSlot(segment, slotIdx);
    applySlotResults(segId, segment.imageSlots!.map((_, i) => (i === slotIdx ? url : null)));
    setImageLoadingIds((prev) => { const next = new Set(prev); next.delete(loadId); return next; });
  }

  async function handleRegenerateSegment(segId: string) {
    const segment = segments.find((s) => s.id === segId);
    if (!segment?.imageSlots?.length) return;
    const loadIds = new Set(segment.imageSlots.map((_, i) => `${segId}-${i}`));
    setImageLoadingIds((prev) => new Set([...prev, ...loadIds]));
    const results = await Promise.all(segment.imageSlots.map((_, i) => generateOneSlot(segment, i)));
    applySlotResults(segId, results);
    setImageLoadingIds((prev) => { const next = new Set(prev); loadIds.forEach((id) => next.delete(id)); return next; });
    toast({ title: `Segment ${segment.order} régénéré (${results.filter(Boolean).length} images)`, variant: "success" });
  }

  async function handleAnimateSlot(
    segId: string,
    slotIdx: number,
    motionModel: string,
    prompt: string,
    motionStrength: number
  ) {
    const segment = segments.find((s) => s.id === segId);
    const slot = segment?.imageSlots?.[slotIdx];
    if (!slot?.imageUrl) {
      toast({ title: "Pas d'image à animer", description: "Génère d'abord l'image.", variant: "error" });
      return;
    }
    const loadId = `${segId}-${slotIdx}`;
    setVideoLoadingIds((prev) => new Set(prev).add(loadId));
    try {
      // Étape 1 : démarrer la génération (retour rapide, évite le timeout Vercel)
      const startRes = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: slot.imageUrl,
          motionModel,
          prompt,
          motionStrength,
          apiKey: config.leonardoApiKey || undefined,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData?.error ?? "Erreur au démarrage de la génération vidéo");
      const { generationId } = startData as { generationId: string };

      // Étape 2 : polling côté client toutes les 5s, max 5 minutes
      const apiKeyParam = config.leonardoApiKey ? `&apiKey=${encodeURIComponent(config.leonardoApiKey)}` : "";
      let videoUrl: string | undefined;
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        const pollRes = await fetch(`/api/generate-video/status?generationId=${generationId}${apiKeyParam}`);
        const pollData = await pollRes.json();
        if (!pollRes.ok) throw new Error(pollData?.error ?? "Erreur de polling");
        if (pollData.status === "COMPLETE" && pollData.videoUrl) {
          videoUrl = pollData.videoUrl as string;
          break;
        }
        if (pollData.status === "FAILED") throw new Error("La génération vidéo a échoué côté Leonardo.");
      }
      if (!videoUrl) throw new Error("Délai d'attente dépassé (5 min). Réessaie.");

      setSegments((prev) =>
        prev.map((s) => {
          if (s.id !== segId || !s.imageSlots) return s;
          const slots = s.imageSlots.map((sl, i) =>
            i === slotIdx ? { ...sl, motionVideoUrl: videoUrl! } : sl
          );
          return { ...s, imageSlots: slots };
        })
      );
      toast({ title: "Animation générée !", description: "La vidéo est prête dans la carte image.", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Échec de l'animation", description: message, variant: "error" });
    } finally {
      setVideoLoadingIds((prev) => { const next = new Set(prev); next.delete(loadId); return next; });
    }
  }

  // Kept for compatibility — use handleRegenerateSegment in new UI
  async function handleRegenerateImage(id: string) { await handleRegenerateSegment(id); }
  function handleSegmentPromptChange(id: string, imagePrompt: string) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, imagePrompt } : s)));
  }

  async function handleAudioLoaded(url: string, duration: number, audioBuffer: AudioBuffer) {
    setVoiceoverUrl(url);
    setAudioDuration(duration);

    // Détecter les pauses naturelles dans l'audio pour connaître le timing EXACT de chaque phrase
    const channelData = audioBuffer.getChannelData(0);
    const detectedPhrases = detectPhrasesFromAudio(channelData, audioBuffer.sampleRate, duration);

    // Découper le script en phrases et les caler sur les timestamps audio détectés
    const sentences = splitScriptIntoSentences(scriptText);
    const mappedPhrases = mapSentencesToPhrases(sentences, detectedPhrases);

    // Créer les segments avec des durées EXACTES issues de l'analyse audio
    const newSegments: VideoSegment[] = mappedPhrases.map((phrase, i) => ({
      id: uid(),
      order: i + 1,
      narration: phrase.text,
      visualDescription: "",
      duration: Math.round((phrase.end - phrase.start) * 100) / 100,
      imagePrompt: "",
    }));

    // Sous-titres avec timestamps exacts — chaque phrase commence et finit au bon moment
    const exactSubtitles: SubtitleEntry[] = mappedPhrases.map((phrase) => ({
      start: phrase.start,
      end: phrase.end,
      text: phrase.text,
    }));

    setSegments(newSegments);
    setSubtitles(exactSubtitles);

    // Construire les clips (1 image toutes les ~2.5s) en se basant sur l'audio
    const newClips = buildClipsFromSegments(newSegments, beatDuration);
    const syncedClips = syncClipsToAudio(newClips, duration);
    setClips(syncedClips);

    // Générer les prompts d'images maintenant qu'on connaît les durées exactes
    setGeneratingPrompts(true);
    try {
      const withPrompts = await generateImagePrompts(newSegments);
      setSegments(withPrompts);
      toast({
        title: "Audio analysé",
        description: `${detectedPhrases.length} phrases détectées sur ${duration.toFixed(1)}s. Prompts d'images générés.`,
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
          scriptText={scriptText}
          language={config.language as "fr" | "en"}
          googleTtsKey={config.googleTtsKey}
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
          onRegenerateSegment={handleRegenerateSegment}
          onRegenerateSlot={handleRegenerateSlot}
          onImageCountChange={handleImageCountChange}
          onSlotPromptChange={handleSlotPromptChange}
          onSlotReferenceChange={handleSlotReferenceChange}
          onDeleteSlotImage={handleDeleteSlotImage}
          onAnimateSlot={(segId, slotIdx, model, prompt, strength) => handleAnimateSlot(segId, slotIdx, model, prompt, strength)}
          generatingImages={generatingImages}
          imageLoadingIds={imageLoadingIds}
          videoLoadingIds={videoLoadingIds}
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
