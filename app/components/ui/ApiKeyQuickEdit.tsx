"use client";

import * as React from "react";
import { KeyRound, X, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";

const STORAGE_KEY = "studioai:apiKeys";

interface ApiKeys {
  mistralApiKey: string;
  leonardoApiKey: string;
}

interface ApiKeyQuickEditProps {
  mistralApiKey: string;
  leonardoApiKey: string;
  onChange: (keys: Partial<ApiKeys>) => void;
}

export function ApiKeyQuickEdit({ mistralApiKey, leonardoApiKey, onChange }: ApiKeyQuickEditProps) {
  const [open, setOpen] = React.useState(false);
  const [localMistral, setLocalMistral] = React.useState(mistralApiKey);
  const [localLeonardo, setLocalLeonardo] = React.useState(leonardoApiKey);
  const [showMistral, setShowMistral] = React.useState(false);
  const [showLeonardo, setShowLeonardo] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Sync local state when parent changes
  React.useEffect(() => { setLocalMistral(mistralApiKey); }, [mistralApiKey]);
  React.useEffect(() => { setLocalLeonardo(leonardoApiKey); }, [leonardoApiKey]);

  function handleSave() {
    const patch = { mistralApiKey: localMistral, leonardoApiKey: localLeonardo };
    onChange(patch);
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...patch }));
    } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    setSaved(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/60"
        title="Modifier les clés API"
        aria-label="Modifier les clés API"
      >
        <KeyRound className="h-5 w-5 text-primary-foreground" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Clés API</span>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Mistral */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mistral AI
              </label>
              <div className="relative flex items-center">
                <Input
                  type={showMistral ? "text" : "password"}
                  value={localMistral}
                  onChange={(e) => setLocalMistral(e.target.value)}
                  placeholder="Clé Mistral…"
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowMistral((v) => !v)}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={showMistral ? "Masquer" : "Afficher"}
                >
                  {showMistral ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Leonardo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Leonardo AI
              </label>
              <div className="relative flex items-center">
                <Input
                  type={showLeonardo ? "text" : "password"}
                  value={localLeonardo}
                  onChange={(e) => setLocalLeonardo(e.target.value)}
                  placeholder="Clé Leonardo…"
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowLeonardo((v) => !v)}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={showLeonardo ? "Masquer" : "Afficher"}
                >
                  {showLeonardo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <Button onClick={handleSave} size="sm" className="w-full gap-1.5">
              {saved ? (
                <><Check className="h-3.5 w-3.5" /> Enregistré</>
              ) : (
                "Enregistrer"
              )}
            </Button>

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Les clés sont stockées uniquement dans ton navigateur (localStorage).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
