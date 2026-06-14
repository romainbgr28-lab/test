import { NextResponse } from "next/server";
import JSZip from "jszip";
import { callMistralChat } from "@/lib/mistral";
import type { VideoProject } from "@/types";
import { generateSubtitles, toSRT } from "@/lib/subtitles";
import { buildSyncReport, normalizeSubtitles } from "@/lib/sync";

export const runtime = "nodejs";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; extension: string } {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Format de données invalide.");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extension = mime.includes("png") ? "png" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "jpg";
  return { buffer, extension };
}

function buildScriptText(project: VideoProject): string {
  const lines: string[] = [];
  lines.push(`Sujet : ${project.subject}`);
  lines.push(`Plateforme : ${PLATFORM_LABELS[project.profile.platform] ?? project.profile.platform}`);
  const totalDuration = project.segments.reduce((sum, s) => sum + s.duration, 0);
  lines.push(`Durée totale : ${totalDuration}s`);
  lines.push("");
  lines.push("=== SEGMENTS ===");
  let cumulative = 0;
  for (const segment of [...project.segments].sort((a, b) => a.order - b.order)) {
    const start = cumulative;
    cumulative += segment.duration;
    lines.push("");
    lines.push(`Segment ${segment.order} — ${start}s → ${cumulative}s (${segment.duration}s)`);
    lines.push(`Narration : ${segment.narration}`);
    lines.push(`Description visuelle : ${segment.visualDescription}`);
  }
  return lines.join("\n");
}

function buildMontageFallback(project: VideoProject): string {
  const lines: string[] = [];
  lines.push("=== GUIDE DE MONTAGE CAPCUT ===");
  let cumulative = 0;
  for (const segment of [...project.segments].sort((a, b) => a.order - b.order)) {
    const start = cumulative;
    cumulative += segment.duration;
    const index = String(segment.order).padStart(2, "0");
    lines.push("");
    lines.push(`Segment ${segment.order} : importer image_${index}.png, durée ${segment.duration}s`);
    lines.push(`  - Ajouter la voix off de ${start}s à ${cumulative}s`);
    lines.push(`  - Texte à synchroniser : "${segment.narration}"`);
  }
  return lines.join("\n");
}

async function buildMontageGuide(project: VideoProject, apiKey?: string): Promise<string> {
  const key = apiKey || process.env.MISTRAL_API_KEY;
  if (!key) return buildMontageFallback(project);

  try {
    const segmentsDescription = [...project.segments]
      .sort((a, b) => a.order - b.order)
      .map((s) => `Segment ${s.order} (${s.duration}s) : ${s.narration}`)
      .join("\n");

    const content = await callMistralChat({
      apiKey: key,
      model: project.mistralModel,
      messages: [
        {
          role: "system",
          content:
            "Tu es un monteur vidéo expert qui rédige des guides de montage clairs et actionnables pour CapCut, en français.",
        },
        {
          role: "user",
          content: `Rédige un guide de montage CapCut étape par étape pour assembler cette vidéo. Pour chaque segment indique : le nom du fichier image à importer (image_NN.png), la durée à appliquer, la portion de la voix off à synchroniser (de Xs à Xs), et d'éventuelles transitions ou effets adaptés au rythme de la plateforme "${PLATFORM_LABELS[project.profile.platform] ?? project.profile.platform}".

Voici les segments :
${segmentsDescription}

Réponds uniquement avec le texte du guide, sans introduction ni conclusion superflue.`,
        },
      ],
      temperature: 0.5,
    });
    return content.trim();
  } catch (error) {
    console.error("Erreur génération guide de montage, fallback utilisé :", error);
    return buildMontageFallback(project);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project, apiKey } = body as { project: VideoProject; apiKey?: string };

    if (!project || !project.segments || project.segments.length === 0) {
      return NextResponse.json({ error: "Projet invalide : aucun segment trouvé." }, { status: 400 });
    }

    const zip = new JSZip();

    zip.file("script_complet.txt", buildScriptText(project));

    const sortedSegments = [...project.segments].sort((a, b) => a.order - b.order);
    for (const segment of sortedSegments) {
      if (segment.imageBlob) {
        try {
          const { buffer, extension } = dataUrlToBuffer(segment.imageBlob);
          const index = String(segment.order).padStart(2, "0");
          zip.file(`image_${index}.${extension}`, buffer);
        } catch (err) {
          console.error(`Image du segment ${segment.order} ignorée :`, err);
        }
      }
    }

    if (project.voiceoverUrl) {
      try {
        const { buffer } = dataUrlToBuffer(project.voiceoverUrl);
        zip.file("voiceover.mp3", buffer);
      } catch (err) {
        console.error("Voix off ignorée :", err);
      }
    }

    const montageGuide = await buildMontageGuide(project, apiKey);
    zip.file("guide_montage_capcut.txt", montageGuide);

    const meta = project.publishMetadata;
    if (meta && (meta.caption || meta.hashtags.length > 0 || meta.title)) {
      const packLines = [
        "=== PACK DE PUBLICATION ===",
        "",
        ...(meta.title ? [`TITRE YOUTUBE :`, meta.title, ""] : []),
        ...(meta.description ? [`DESCRIPTION YOUTUBE :`, meta.description, ""] : []),
        ...(meta.caption ? [`LÉGENDE TIKTOK / REELS :`, meta.caption, ""] : []),
        ...(meta.hashtags.length > 0 ? [`HASHTAGS :`, meta.hashtags.map((h) => `#${h}`).join(" "), ""] : []),
        ...(meta.bestPostTime ? [`MEILLEUR CRÉNEAU DE PUBLICATION :`, meta.bestPostTime, ""] : []),
        ...(meta.nextVideoIdeas && meta.nextVideoIdeas.length > 0
          ? ["PROCHAINES VIDÉOS DE LA SÉRIE :", ...meta.nextVideoIdeas.map((idea, i) => `${i + 1}. ${idea}`), ""]
          : []),
      ];
      zip.file("pack_publication.txt", packLines.join("\n").trim());
    }

    // Sous-titres : on privilégie la version éditée manuellement dans la timeline
    const subtitles =
      project.subtitles && project.subtitles.length > 0
        ? normalizeSubtitles(project.subtitles)
        : generateSubtitles(sortedSegments);
    zip.file("subtitles.srt", toSRT(subtitles));

    const captionLines = subtitles.map(
      (sub, i) => `Sous-titre ${i + 1} : ${sub.start.toFixed(1)}s à ${sub.end.toFixed(1)}s - ${sub.text}`
    );
    zip.file("subtitles_capcut.txt", captionLines.join("\n"));

    if (project.researchSources && project.researchSources.length > 0) {
      zip.file(
        "sources_recherche.txt",
        ["Sources web utilisées pour le script :", "", ...project.researchSources].join("\n")
      );
    }

    const totalSegmentsDuration = project.segments.reduce((sum, s) => sum + s.duration, 0);
    const report = buildSyncReport(project.segments, project.audioDuration ?? totalSegmentsDuration);
    const syncReportLines = [
      "=== RAPPORT DE SYNCHRONISATION ===",
      "",
      `Durée audio détectée : ${report.audioDuration.toFixed(1)}s`,
      `Durée totale des segments : ${report.totalSegmentsDuration.toFixed(1)}s`,
      `Écart segments / audio : ${report.driftSeconds.toFixed(2)}s`,
      `Nombre de segments : ${report.segmentCount}`,
      `Durée moyenne par segment : ${report.averageSegmentDuration.toFixed(1)}s`,
      `Nombre de sous-titres : ${subtitles.length}`,
      "",
      "Segments (timing, mots, débit) :",
      ...report.entries.map(
        (e) =>
          `  ${e.order}. [${e.start.toFixed(1)}s → ${e.end.toFixed(1)}s] ${e.duration.toFixed(1)}s — ${e.wordCount} mots (${e.wordsPerSecond.toFixed(1)} mots/s)`
      ),
      "",
      "Sous-titres :",
      ...subtitles.map(
        (sub, i) =>
          `  ${i + 1}. [${sub.start.toFixed(1)}s → ${sub.end.toFixed(1)}s] ${sub.text.slice(0, 60)}${sub.text.length > 60 ? "..." : ""}`
      ),
    ];
    zip.file("sync_report.txt", syncReportLines.join("\n"));

    const metadata = {
      id: project.id,
      subject: project.subject,
      profile: project.profile,
      targetDuration: project.targetDuration,
      voiceId: project.voiceId,
      mistralModel: project.mistralModel,
      imageModel: project.imageModel,
      viralityScore: project.viralityScore ?? null,
      publishMetadata: project.publishMetadata ?? null,
      segmentCount: project.segments.length,
      totalDuration: project.segments.reduce((sum, s) => sum + s.duration, 0),
      createdAt: project.createdAt,
      exportedAt: new Date().toISOString(),
    };
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="studioai-${project.id}.zip"`,
      },
    });
  } catch (error) {
    console.error("Erreur /api/export-zip :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la génération du ZIP : ${message}` },
      { status: 500 }
    );
  }
}
