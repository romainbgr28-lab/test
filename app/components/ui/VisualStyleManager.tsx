"use client";

import * as React from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import type { VisualStyle } from "@/types";
import { getVisualStyles, saveVisualStyle, deleteVisualStyle } from "@/lib/visual-styles";
import { Select } from "./Select";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./Card";
import { useToast } from "./Toast";
import { fileToDataUrl } from "@/lib/utils";

interface VisualStyleManagerProps {
  selectedId: string | null;
  onSelect: (style: VisualStyle | null) => void;
}

export function VisualStyleManager({ selectedId, onSelect }: VisualStyleManagerProps) {
  const { toast } = useToast();
  const [styles, setStyles] = React.useState<VisualStyle[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [stylePrompt, setStylePrompt] = React.useState("");
  const [draftImages, setDraftImages] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setStyles(getVisualStyles());
  }, []);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const dataUrls = await Promise.all(Array.from(files).map((file) => fileToDataUrl(file)));
    setDraftImages((prev) => [...prev, ...dataUrls]);
  }

  function removeDraftImage(index: number) {
    setDraftImages((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setName("");
    setStylePrompt("");
    setDraftImages([]);
  }

  function handleCreate() {
    if (!name.trim() || !stylePrompt.trim()) {
      toast({
        title: "Champs manquants",
        description: "Donne un nom et un prompt de style à ton style visuel.",
        variant: "error",
      });
      return;
    }
    const style = saveVisualStyle({
      name: name.trim(),
      stylePrompt: stylePrompt.trim(),
      referenceImages: draftImages,
    });
    setStyles(getVisualStyles());
    onSelect(style);
    setCreating(false);
    resetForm();
    toast({ title: "Style visuel créé", description: `"${style.name}" est prêt à être utilisé.`, variant: "success" });
  }

  function handleDelete(id: string) {
    const updated = deleteVisualStyle(id);
    setStyles(updated);
    if (selectedId === id) {
      onSelect(updated.length > 0 ? updated[0] : null);
    }
    toast({ title: "Style visuel supprimé", variant: "info" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Style visuel (optionnel)</label>
        <Button variant="outline" size="sm" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau style
        </Button>
      </div>

      <Select
        value={selectedId ?? ""}
        onChange={(value) => {
          if (!value) {
            onSelect(null);
            return;
          }
          const style = styles.find((s) => s.id === value);
          if (style) onSelect(style);
        }}
        options={[
          { value: "", label: "Aucun style visuel", description: "N'applique aucune référence ni prompt de style global" },
          ...styles.map((s) => ({
            value: s.id,
            label: s.name,
            description: `${s.referenceImages.length} image(s) de référence — ${s.stylePrompt.slice(0, 60)}${
              s.stylePrompt.length > 60 ? "…" : ""
            }`,
          })),
        ]}
        placeholder="Choisis un style visuel"
      />

      {styles.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground">
          Crée un style visuel réutilisable : uploade plusieurs images de référence (ex. un format TikTok qui marche
          bien) et décris le style recherché. Ce style s&apos;appliquera à toutes les images du projet, en plus du
          prompt de contenu propre à chaque segment.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {styles.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground"
          >
            {s.name}
            <button onClick={() => handleDelete(s.id)} className="hover:text-destructive" aria-label={`Supprimer ${s.name}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {creating && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Nouveau style visuel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Style TikTok néon urbain" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prompt de style visuel
              </label>
              <Textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="Décris le style recherché : palette de couleurs, éclairage, composition, ambiance, type de rendu (ex. néon urbain la nuit, contraste fort, grain cinématique)..."
              />
              <p className="text-xs text-muted-foreground">
                Ce prompt décrit COMMENT l&apos;image doit être rendue (le style). Il s&apos;ajoute au prompt de
                contenu de chaque segment, qui décrit lui CE QUI doit apparaître dans l&apos;image.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Images de référence (plusieurs possibles, jusqu&apos;à 4 utilisées par génération)
              </label>
              <p className="text-xs text-muted-foreground">
                Uploade des images représentatives du style que tu veux reproduire (ex. captures d&apos;un format
                TikTok qui performe). Elles servent de base visuelle pour guider le rendu (image guidance).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFilesSelected(e.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button variant="outline" size="sm" className="w-fit" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Importer des images
              </Button>
              {draftImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draftImages.map((src, index) => (
                    <div key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Référence ${index + 1}`}
                        className="h-16 w-16 rounded-md border border-border object-cover"
                      />
                      <button
                        onClick={() => removeDraftImage(index)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 text-muted-foreground hover:text-destructive"
                        aria-label={`Retirer l'image ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleCreate}>Créer le style</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
