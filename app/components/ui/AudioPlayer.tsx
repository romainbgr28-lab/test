"use client";

import { RefreshCw, Volume2 } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

interface AudioPlayerProps {
  src?: string;
  loading?: boolean;
  onRegenerate?: () => void;
}

export function AudioPlayer({ src, loading, onRegenerate }: AudioPlayerProps) {
  if (loading) {
    return <Skeleton className="h-14 w-full" />;
  }

  if (!src) {
    return (
      <div className="flex h-14 items-center gap-2 rounded-md border border-dashed border-border px-4 text-sm text-muted-foreground">
        <Volume2 className="h-4 w-4" />
        Aucune voix off générée pour le moment.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <audio controls src={src} className="h-12 w-full rounded-md" />
      {onRegenerate && (
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" />
          Regénérer
        </Button>
      )}
    </div>
  );
}
