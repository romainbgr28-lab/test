"use client";

import { Mic, ArrowRight, Loader2 } from "lucide-react";
import type { VoiceId } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/Card";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { AudioPlayer } from "../ui/AudioPlayer";
import { VOICE_DESCRIPTIONS } from "@/lib/pollinations";

const VOICE_OPTIONS = (Object.keys(VOICE_DESCRIPTIONS) as VoiceId[]).map((key) => ({
  value: key,
  label: VOICE_DESCRIPTIONS[key],
}));

interface StepVoiceProps {
  voiceId: VoiceId;
  onVoiceChange: (voice: VoiceId) => void;
  onGenerateVoice: () => void;
  voiceoverUrl?: string;
  generatingVoice: boolean;
  onProceed: () => void;
}

export function StepVoice({
  voiceId,
  onVoiceChange,
  onGenerateVoice,
  voiceoverUrl,
  generatingVoice,
  onProceed,
}: StepVoiceProps) {
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
              Voix off (Pollinations TTS)
            </CardTitle>
            <CardDescription>Choisis une voix, génère l&apos;audio puis écoute le résultat.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Voix</label>
              <Select value={voiceId} onChange={(v) => onVoiceChange(v as VoiceId)} options={VOICE_OPTIONS} />
            </div>
            <Button onClick={onGenerateVoice} disabled={generatingVoice} className="w-fit">
              {generatingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              Générer la voix off
            </Button>
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
