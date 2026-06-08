"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { NicheProfile, Platform, Language } from "@/types";
import { getProfiles, saveProfile, deleteProfile } from "@/lib/profiles";
import { Select } from "./Select";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./Card";
import { useToast } from "./Toast";

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "youtube", label: "YouTube" },
  { value: "reels", label: "Instagram Reels" },
];

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
];

interface ProfileManagerProps {
  selectedId: string | null;
  onSelect: (profile: NicheProfile) => void;
}

export function ProfileManager({ selectedId, onSelect }: ProfileManagerProps) {
  const { toast } = useToast();
  const [profiles, setProfiles] = React.useState<NicheProfile[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scriptInstructions, setScriptInstructions] = React.useState("");
  const [viralityInstructions, setViralityInstructions] = React.useState("");
  const [platform, setPlatform] = React.useState<Platform>("tiktok");
  const [language, setLanguage] = React.useState<Language>("fr");

  React.useEffect(() => {
    const loaded = getProfiles();
    setProfiles(loaded);
    if (!selectedId && loaded.length > 0) {
      onSelect(loaded[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreate() {
    if (!name.trim() || !scriptInstructions.trim()) {
      toast({
        title: "Champs manquants",
        description: "Donne un nom et au moins des instructions de script à ton profil.",
        variant: "error",
      });
      return;
    }
    const profile = saveProfile({
      name: name.trim(),
      scriptInstructions: scriptInstructions.trim(),
      viralityInstructions: viralityInstructions.trim(),
      platform,
      language,
    });
    setProfiles(getProfiles());
    onSelect(profile);
    setCreating(false);
    setName("");
    setScriptInstructions("");
    setViralityInstructions("");
    toast({ title: "Profil créé", description: `"${profile.name}" est prêt à être utilisé.`, variant: "success" });
  }

  function handleDelete(id: string) {
    const updated = deleteProfile(id);
    setProfiles(updated);
    if (selectedId === id && updated.length > 0) {
      onSelect(updated[0]);
    }
    toast({ title: "Profil supprimé", variant: "info" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Profil de niche</label>
        <Button variant="outline" size="sm" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau profil
        </Button>
      </div>

      <Select
        value={selectedId ?? ""}
        onChange={(value) => {
          const profile = profiles.find((p) => p.id === value);
          if (profile) onSelect(profile);
        }}
        options={profiles.map((p) => ({
          value: p.id,
          label: p.name,
          description: p.scriptInstructions.slice(0, 70) + (p.scriptInstructions.length > 70 ? "…" : ""),
        }))}
        placeholder={profiles.length > 0 ? "Choisis un profil" : "Aucun profil — crées-en un ci-dessous"}
      />

      {profiles.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground">
          Tu n&apos;as encore aucun profil. Crée-en un pour définir tes propres instructions de script et de viralité —
          rien n&apos;est pré-rempli, c&apos;est toi qui définis tout.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {profiles.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground"
          >
            {p.name}
            <button onClick={() => handleDelete(p.id)} className="hover:text-destructive" aria-label={`Supprimer ${p.name}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {creating && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Nouveau profil de niche</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Fitness perte de gras FR" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Instructions de script
              </label>
              <Textarea
                value={scriptInstructions}
                onChange={(e) => setScriptInstructions(e.target.value)}
                placeholder="Ex: Scripts pour vidéos fitness sur la perte de gras, ton motivant, exemples concrets, vocabulaire simple, public 20-35 ans..."
              />
              <p className="text-xs text-muted-foreground">
                Décrit le ton, le sujet, le public cible et la structure attendue du script généré par l&apos;IA.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Instructions de viralité / format (optionnel)
              </label>
              <Textarea
                value={viralityInstructions}
                onChange={(e) => setViralityInstructions(e.target.value)}
                placeholder="Ex: Privilégier les hooks chocs avec chiffres, formats listicle 'top 5', rythme rapide, CTA vers le profil..."
              />
              <p className="text-xs text-muted-foreground">
                Décrit les mécaniques de viralité et de format que l&apos;IA doit privilégier pour ce type de contenu
                (hook, rythme, structure, type de CTA...).
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Plateforme par défaut
                </label>
                <Select value={platform} onChange={(v) => setPlatform(v as Platform)} options={PLATFORM_OPTIONS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Langue par défaut
                </label>
                <Select value={language} onChange={(v) => setLanguage(v as Language)} options={LANGUAGE_OPTIONS} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleCreate}>Créer le profil</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Annuler
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
