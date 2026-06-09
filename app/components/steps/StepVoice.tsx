"use client";

import * as React from "react";
import { Upload, ArrowRight, Music } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";

interface StepVoiceProps {
  onAudioLoaded: (url: string, duration: number) => void;
  voiceoverUrl?: string;
  audioDuration: number;
  segments: { id: string }[];
  onProceed: () => void;
}

export function StepVoice({ onAudioLoaded, voiceoverUrl, audioDuration, segments, onProceed }: StepVoiceProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.match(/audio\/(mpeg|wav|mp3|x-wav)/)) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      onAudioLoaded(url, audio.duration);
    };
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 3 — Upload Audio</CardTitle>
        <CardDescription>
          Uploade ton fichier audio MP3 ou WAV. La durée sera détectée automatiquement et les segments seront synchronisés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Card className="mx-auto w-full max-w-xl bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />
              Voix off
            </CardTitle>
            <CardDescription>Glisse-dépose un fichier MP3 ou WAV, ou utilise le bouton Parcourir.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Glisse ton fichier audio ici
              </p>
              <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                Parcourir
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="audio/mpeg,audio/wav,audio/mp3"
                className="hidden"
                onChange={handleChange}
              />
            </div>

            {voiceoverUrl && (
              <div className="flex flex-col gap-2">
                <audio controls src={voiceoverUrl} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  Audio détecté : <span className="font-medium text-foreground">{audioDuration.toFixed(1)} secondes</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {segments.length} segments synchronisés sur {audioDuration.toFixed(1)}s
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          {voiceoverUrl ? "Passer à l'export" : "Continuer sans audio"}
        </Button>
      </CardFooter>
    </Card>
  );
}
