"use client";

import * as React from "react";
import { Upload, ArrowRight, Music, Loader2, Mic } from "lucide-react";
import type { VideoSegment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { fileToDataUrl } from "@/lib/utils";

const VOICE_OPTIONS = [
  { id: "Achird", label: "Achird — Neutre" },
  { id: "Algenib", label: "Algenib — Neutre" },
  { id: "Alnilam", label: "Alnilam — Neutre" },
  { id: "Charon", label: "Charon — Grave" },
  { id: "Enceladus", label: "Enceladus — Neutre" },
  { id: "Fenrir", label: "Fenrir — Masculin" },
  { id: "Iapetus", label: "Iapetus — Masculin" },
  { id: "Orus", label: "Orus — Masculin" },
  { id: "Puck", label: "Puck — Neutre" },
  { id: "Rasalgethi", label: "Rasalgethi — Masculin" },
  { id: "Aoede", label: "Aoede — Féminin" },
  { id: "Callirrhoe", label: "Callirrhoe — Féminin" },
  { id: "Despina", label: "Despina — Féminin" },
  { id: "Kore", label: "Kore — Féminin" },
  { id: "Leda", label: "Leda — Féminin" },
  { id: "Pulcherrima", label: "Pulcherrima — Féminin" },
  { id: "Zephyr", label: "Zephyr — Féminin" },
];

interface StepVoiceProps {
  segments: VideoSegment[];
  scriptText: string;
  language: string;
  googleTtsKey?: string;
  voiceoverUrl?: string;
  audioDuration: number;
  onAudioLoaded: (url: string, duration: number) => void;
  generatingPrompts?: boolean;
  onProceed: () => void;
}

/** Détecte la durée audio avec AudioContext (précis même sur MP3 VBR). */
async function getAccurateDuration(dataUrl: string): Promise<number> {
  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    return decoded.duration;
  } finally {
    await audioCtx.close();
  }
}

export function StepVoice({
  segments,
  scriptText,
  language,
  googleTtsKey,
  voiceoverUrl,
  audioDuration,
  onAudioLoaded,
  generatingPrompts,
  onProceed,
}: StepVoiceProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = React.useState("Orus");
  const [generatingTts, setGeneratingTts] = React.useState(false);

  async function processAudioFile(dataUrl: string) {
    setError(null);
    try {
      const duration = await getAccurateDuration(dataUrl);
      if (!Number.isFinite(duration) || duration <= 0) {
        setError("Impossible de lire la durée de ce fichier audio.");
        return;
      }
      onAudioLoaded(dataUrl, duration);
    } catch {
      setError("Impossible de décoder ce fichier audio.");
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("audio/")) {
      setError("Format non supporté : choisis un fichier audio (MP3, WAV, OGG, M4A).");
      return;
    }
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      await processAudioFile(dataUrl);
    } catch {
      setError("Échec de la lecture du fichier audio.");
    }
  }

  async function handleGenerateTts() {
    if (!googleTtsKey) {
      setError("Clé API Google TTS manquante (renseigne-la à l'étape Configuration).");
      return;
    }
    setGeneratingTts(true);
    setError(null);
    try {
      const text = scriptText ||
        segments
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => s.narration)
          .join(" ");

      if (!text.trim()) {
        setError("Aucun texte à synthétiser.");
        return;
      }

      const response = await fetch("/api/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          apiKey: googleTtsKey,
          language: language || "fr",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erreur lors de la synthèse vocale.");
      }

      const audioBlob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        await processAudioFile(dataUrl);
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setGeneratingTts(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const busy = generatingTts || generatingPrompts;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 2 — Voix off</CardTitle>
        <CardDescription>
          Génère la voix off ou uploade ton fichier audio. La durée réelle sera lue avec précision et les prompts
          d&apos;images seront générés en accord avec les durées exactes de chaque segment.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* TTS Generator */}
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" />
              Générer la voix off (Google TTS)
            </CardTitle>
            <CardDescription>
              Synthèse vocale automatique depuis le script. Nécessite une clé API Google TTS.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Voix
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={busy}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleGenerateTts}
              disabled={busy || !googleTtsKey}
              variant="outline"
            >
              {generatingTts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {generatingTts ? "Synthèse en cours…" : "Générer la voix off"}
            </Button>
            {!googleTtsKey && (
              <p className="text-xs text-amber-400">
                Renseigne ta clé Google TTS dans la Configuration pour activer cette fonctionnalité.
              </p>
            )}
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />
              Ou uploade ta voix off
            </CardTitle>
            <CardDescription>Glisse-dépose ou clique pour parcourir (MP3, WAV, OGG, M4A).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">Glisse ton fichier audio ici</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                Parcourir
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {voiceoverUrl && (
              <div className="flex flex-col gap-2">
                <audio controls src={voiceoverUrl} className="w-full" />
                <p className="text-sm font-medium text-emerald-400">
                  ✓ Durée détectée : {audioDuration.toFixed(2)}s
                </p>
                <p className="text-sm text-muted-foreground">
                  {segments.length} segment{segments.length > 1 ? "s" : ""} calés sur {audioDuration.toFixed(1)}s
                </p>
                {generatingPrompts && (
                  <p className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Génération des prompts d&apos;images selon les durées réelles…
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>

      <CardFooter>
        <Button onClick={onProceed} disabled={busy} size="lg">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {voiceoverUrl ? "Passer aux images" : "Continuer sans audio"}
        </Button>
      </CardFooter>
    </Card>
  );
}
