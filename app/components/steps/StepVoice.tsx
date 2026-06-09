"use client";

import * as React from "react";
import { Upload, ArrowRight, Music } from "lucide-react";
import type { VideoSegment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";

interface StepVoiceProps {
  segments: VideoSegment[];
  voiceoverUrl?: string;
  audioDuration: number;
  onAudioLoaded: (url: string, duration: number) => void;
  onProceed: () => void;
}

export function StepVoice({ segments, voiceoverUrl, audioDuration, onAudioLoaded, onProceed }: StepVoiceProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.match(/audio\/(mpeg|wav|mp3|x-wav|ogg)/)) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => onAudioLoaded(url, audio.duration);
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
        <CardTitle>Étape 3 — Voix off</CardTitle>
        <CardDescription>
          Uploade ta voix off enregistrée (MP3, WAV). La durée sera détectée et les segments synchronisés automatiquement.
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
                accept="audio/mpeg,audio/wav,audio/mp3,audio/ogg"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

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
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          {voiceoverUrl ? "Voir l'aperçu vidéo" : "Continuer sans audio"}
        </Button>
      </CardFooter>
    </Card>
  );
}
