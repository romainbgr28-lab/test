"use client";

import { RefreshCw, Clock, ImageIcon } from "lucide-react";
import type { VideoSegment } from "@/types";
import { Card, CardContent, CardHeader } from "./Card";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

interface SegmentCardProps {
  segment: VideoSegment;
  onChange?: (patch: Partial<VideoSegment>) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  showImage?: boolean;
  imageLoading?: boolean;
  onRegenerateImage?: () => void;
  readOnly?: boolean;
}

export function SegmentCard({
  segment,
  onChange,
  onRegenerate,
  regenerating,
  showImage,
  imageLoading,
  onRegenerateImage,
  readOnly,
}: SegmentCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {segment.order}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {segment.duration}s
          </span>
        </div>
        {onRegenerate && !readOnly && (
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
            Regénérer ce segment
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        {showImage && (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-44">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-secondary">
              {imageLoading ? (
                <Skeleton className="h-full w-full" />
              ) : segment.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={segment.imageUrl} alt={`Visuel segment ${segment.order}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            {onRegenerateImage && (
              <Button variant="outline" size="sm" onClick={onRegenerateImage} disabled={imageLoading} className="w-full">
                <RefreshCw className={`h-3.5 w-3.5 ${imageLoading ? "animate-spin" : ""}`} />
                Regénérer
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Narration</label>
            <Textarea
              value={segment.narration}
              readOnly={readOnly}
              onChange={(e) => onChange?.({ narration: e.target.value })}
              className="min-h-[70px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description visuelle
            </label>
            <Textarea
              value={segment.visualDescription}
              readOnly={readOnly}
              onChange={(e) => onChange?.({ visualDescription: e.target.value })}
              className="min-h-[70px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
