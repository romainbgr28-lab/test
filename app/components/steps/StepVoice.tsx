"use client";

import * as React from "react";
import { Upload, ArrowRight, Music, Loader2 } from "lucide-react";
import type { VideoSegment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { fileToDataUrl } from "@/lib/utils";

interface StepVoiceProps {
  segments: VideoSegment[];
  voiceoverUrl?: string;
  audioDuration: number;
  onAudioLoaded: (url: string, duration: number) => void;
  generatingPrompts?: boolean;
  onProceed: () => void;
}

export function StepVoice({ segments, voiceoverUrl, audioDuration, onAudioLoaded, generatingPrompts, onProceed }: StepVoiceProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [error, setError] = React.useState<string | null>(null);

  // L'audio est converti en data URL (et non en blob URL) pour pouvoir être
  // embarqué tel quel dans le ZIP d'export côté serveur.
  async function handleFile(file: File) {
    if (!file.type.startsWith("audio/")) {
      setError("Format non supporté : choisis un fichier audio (MP3, WAV, OGG, M4A).");
      return;
    }
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const audio = new Audio(dataUrl);
      audio.onloadedmetadata = () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          setError("Impossible de lire la durée de ce fichier audio.");
          return;
        }
        onAudioLoaded(dataUrl, audio.duration);
      };
      audio.onerror = () => setError("Impossible de décoder ce fichier audio.");
    } catch {
      setError("Échec de la lecture du fichier audio.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 2 — Voix off</CardTitle>
        <CardDescription>
          Uploade ta voix off enregistrée (MP3, WAV). La durée réelle de chaque segment sera calculée, puis les prompts d&apos;images seront générés en conséquence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Card className="mx-auto w-full max-w-xl bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />
              Fichier audio
            </CardTitle>
            <CardDescription>Glisse-dépose ou clique pour parcourir (MP3, WAV, OGG).</CardDescription>
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
                <p className="text-sm text-muted-foreground">
                  Durée détectée :{" "}
                  <span className="font-medium text-foreground">{audioDuration.toFixed(1)}s</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{segments.length} segments</span> synchronisés
                  proportionnellement sur {audioDuration.toFixed(1)}s
                </p>
                {generatingPrompts && (
                  <p className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Génération des prompts d&apos;images en cours…
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} disabled={generatingPrompts} size="lg">
          {generatingPrompts ? (
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
