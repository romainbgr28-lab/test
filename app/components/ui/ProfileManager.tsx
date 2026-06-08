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
  const [instructions, setInstructions] = React.useState("");
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
    if (!name.trim() || !instructions.trim()) {
      toast({ title: "Champs manquants", description: "Donne un nom et des instructions à ton profil.", variant: "error" });
      return;
    }
    const profile = saveProfile({ name: name.trim(), instructions: instructions.trim(), platform, language });
    setProfiles(getProfiles());
    onSelect(profile);
    setCreating(false);
    setName("");
    setInstructions("");
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
          description: p.instructions.slice(0, 70) + (p.instructions.length > 70 ? "…" : ""),
        }))}
        placeholder="Choisis un profil"
      />

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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tech FR" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Instructions de niche
              </label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Décris le ton, le public cible, les sujets favoris..."
              />
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
