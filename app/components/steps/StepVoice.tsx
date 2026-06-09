"use client";

import * as React from "react";
import { Mic, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import type { VoiceId, VoiceOption } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { AudioPlayer } from "../ui/AudioPlayer";
import { Input } from "../ui/Input";

export const VOICE_OPTIONS: VoiceOption[] = [
  // VOIX HOMMES
  {
    id: "Schedar",
    name: "Schedar",
    gender: "homme",
    description: "Grave, autoritaire, parfait pour la finance",
    recommended: true,
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "homme",
    description: "Froid et intense, style narrateur documentaire",
    recommended: true,
  },
  {
    id: "Enceladus",
    name: "Enceladus",
    gender: "homme",
    description: "Énergique, rythme soutenu, TikTok motivation",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "homme",
    description: "Profond et posé, crédible sur des sujets sérieux",
  },
  {
    id: "Achird",
    name: "Achird",
    gender: "homme",
    description: "Conversationnel et naturel",
  },
  {
    id: "Alnilam",
    name: "Alnilam",
    gender: "homme",
    description: "Clair et articulé, bon pour les tutoriels",
  },
  {
    id: "Sadaltager",
    name: "Sadaltager",
    gender: "homme",
    description: "Dynamique, bon pour le storytelling",
  },
  {
    id: "Puck",
    name: "Puck",
    gender: "homme",
    description: "Léger et accessible, bon pour la vulgarisation",
  },
  // VOIX FEMMES
  {
    id: "Aoede",
    name: "Aoede",
    gender: "femme",
    description: "Chaleureuse et engageante, polyvalente",
    recommended: true,
  },
  {
    id: "Kore",
    name: "Kore",
    gender: "femme",
    description: "Froide et précise, style documentaire",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "femme",
    description: "Douce et rassurante, bonne pour le lifestyle",
  },
  {
    id: "Leda",
    name: "Leda",
    gender: "femme",
    description: "Énergique, bon rythme pour TikTok",
  },
  {
    id: "Gacrux",
    name: "Gacrux",
    gender: "femme",
    description: "Sérieuse et professionnelle",
  },
];

interface StepVoiceProps {
  voiceId: VoiceId;
  onVoiceChange: (voice: VoiceId) => void;
  onGenerateVoice: () => void;
  voiceoverUrl?: string;
  generatingVoice: boolean;
  onProceed: () => void;
  googleTtsKey?: string;
  onGoogleTtsKeyChange?: (key: string) => void;
}

export function StepVoice({
  voiceId,
  onVoiceChange,
  onGenerateVoice,
  voiceoverUrl,
  generatingVoice,
  onProceed,
  googleTtsKey,
  onGoogleTtsKeyChange,
}: StepVoiceProps) {
  const [activeTab, setActiveTab] = React.useState<"homme" | "femme">("homme");

  const filteredVoices = VOICE_OPTIONS.filter((v) => v.gender === activeTab);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape 4 — Voix off</CardTitle>
        <CardDescription>
          Optionnelle : tu peux générer une voix off ici, ou l&apos;ajouter toi-même au montage et passer directement
          à l&apos;export.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Card className="mx-auto w-full max-w-xl bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" />
              Voix off (Google Cloud TTS Chirp 3 HD)
            </CardTitle>
            <CardDescription>Choisis une voix, génère l&apos;audio puis écoute le résultat.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!googleTtsKey && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Clé API Google TTS</label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value=""
                  onChange={(e) => onGoogleTtsKeyChange?.(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Gratuit jusqu&apos;à 1 million de caractères/mois.{" "}
                  <a
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Obtenir une clé sur console.cloud.google.com
                  </a>
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Voix</label>
              <div className="flex gap-2 rounded-lg border border-border bg-secondary/20 p-1">
                <button
                  onClick={() => setActiveTab("homme")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "homme"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Hommes
                </button>
                <button
                  onClick={() => setActiveTab("femme")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "femme"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Femmes
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredVoices.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => onVoiceChange(voice.id)}
                    className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                      voiceId === voice.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/20 hover:border-primary/50 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{voice.name}</span>
                      <div className="flex items-center gap-1">
                        {voice.recommended && (
                          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                            Recommandé
                          </span>
                        )}
                        {voiceId === voice.id && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{voice.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={onGenerateVoice} disabled={generatingVoice} className="w-fit">
                {generatingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Générer la voix off
              </Button>
              {voiceoverUrl && (
                <Button
                  variant="outline"
                  onClick={onGenerateVoice}
                  disabled={generatingVoice}
                  className="w-fit"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regénérer
                </Button>
              )}
            </div>

            <AudioPlayer src={voiceoverUrl} loading={generatingVoice} onRegenerate={onGenerateVoice} />
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter>
        <Button onClick={onProceed} size="lg">
          <ArrowRight className="h-4 w-4" />
          {voiceoverUrl ? "Passer à l'export" : "Continuer sans voix off"}
        </Button>
      </CardFooter>
    </Card>
  );
}
