"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface EvidenceItem {
  line_id: number;
  text: string;
  certainty: "confirmed" | "uncertain" | "user_confirmed";
}

interface FindingItem {
  id: string;
  allergen: string;
  result: "conflict_found" | "unknown" | "no_known_conflict";
  reason: string;
  evidence: EvidenceItem[];
  box_ids?: string[];
  ai_explanation?: string | null;
}

interface BoxLine {
  id: string;
  line_no: number;
  text: string;
  ocr_confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  field?: string;
  user_corrected: boolean;
  corrected_text?: string;
  uncertain: boolean;
  touches_edge: boolean;
  certainty: string;
}

function ResultsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const scanId = params.id as string;
  const allergensParam = searchParams.get("allergens") || "peanut,milk";
  const userAllergens = allergensParam.split(",").filter(Boolean);

  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState<string>("unknown");
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [lines, setLines] = useState<BoxLine[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!scanId) return;

    // Run /analyze to get updated findings and status
    fetch(`${apiUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scan_id: scanId,
        user_allergens: userAllergens,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to analyze scan");
        return res.json();
      })
      .then((data) => {
        setOverallStatus(data.overall_status);
        setFindings(data.findings || []);
        setLines(data.lines || []);
        setImageUrl(data.image_url ? `${apiUrl}${data.image_url}` : null);
        if (data.findings && data.findings.length > 0) {
          setSelectedFindingId(data.findings[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [scanId, apiUrl]);

  const handleRequestAiExplain = async (finding: FindingItem) => {
    setLoadingAi((prev) => ({ ...prev, [finding.id]: true }));
    try {
      const evidenceText = finding.evidence.map((e) => e.text).join("; ");
      const res = await fetch(`${apiUrl}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allergen: finding.allergen,
          rule_detail: finding.reason,
          label_text: evidenceText,
        }),
      });

      if (!res.ok) throw new Error("Explain request failed");
      const data = await res.json();
      setAiExplanations((prev) => ({
        ...prev,
        [finding.id]: data.explanation,
      }));
    } catch (err) {
      console.error(err);
      setAiExplanations((prev) => ({
        ...prev,
        [finding.id]: "[AI] Explanation temporarily unavailable. Rely solely on the rule finding above.",
      }));
    } finally {
      setLoadingAi((prev) => ({ ...prev, [finding.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-oxblood" />
        <p className="text-sm font-mono text-ink-muted">Evaluating label safety against rules...</p>
      </div>
    );
  }

  // Active highlighted line numbers for the selected finding
  const selectedFinding = findings.find((f) => f.id === selectedFindingId);
  const activeLineIds = selectedFinding
    ? selectedFinding.evidence.map((e) => e.line_id)
    : [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto py-2">
      {/* 1. Overall Status Banner (Hard Rule: No Green, Unknown is never Safe) */}
      <div className="w-full">
        {overallStatus === "conflict_found" && (
          <div className="p-5 sm:p-6 bg-oxblood text-parchment rounded-md shadow-sm border border-oxblood-hover flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-parchment/15 rounded-full shrink-0 mt-0.5">
                <ShieldAlert className="w-7 h-7 text-parchment" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold bg-parchment/20 px-2 py-0.5 rounded">
                  Safety Result
                </span>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-parchment mt-1">
                  Conflict Found
                </h1>
                <p className="text-xs sm:text-sm text-parchment/90 mt-1 max-w-2xl leading-relaxed">
                  One or more allergens from your dietary profile appear on this label. Review the source text highlighted below.
                </p>
              </div>
            </div>

            <Link
              href={`/scan/review?id=${scanId}&allergens=${encodeURIComponent(allergensParam)}`}
              className="px-4 py-2.5 bg-parchment text-oxblood font-medium text-xs font-mono rounded hover:bg-parchment-light transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-oxblood" />
              <span>Edit Corrections</span>
            </Link>
          </div>
        )}

        {overallStatus === "unknown" && (
          <div className="p-5 sm:p-6 bg-parchment-light text-ink rounded-md shadow-sm border-2 border-gold-dark flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gold/25 rounded-full shrink-0 mt-0.5">
                <HelpCircle className="w-7 h-7 text-gold-dark" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold bg-gold/30 text-ink px-2 py-0.5 rounded border border-gold-dark/30">
                  Neutral Finding
                </span>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink mt-1">
                  Safety Status: Unknown
                </h1>
                <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl leading-relaxed">
                  The label could not be completely or clearly read. <strong className="text-ink">Missing or unclear data is never assumed safe.</strong> Always inspect packaging manually.
                </p>
              </div>
            </div>

            <Link
              href={`/scan/review?id=${scanId}&allergens=${encodeURIComponent(allergensParam)}`}
              className="px-4 py-2.5 bg-ink text-parchment font-medium text-xs font-mono rounded hover:bg-ink-muted transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-parchment" />
              <span>Verify Fields Manually</span>
            </Link>
          </div>
        )}

        {overallStatus === "no_known_conflict" && (
          <div className="p-5 sm:p-6 bg-ink text-parchment rounded-md shadow-sm border border-ink-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-parchment/15 rounded-full shrink-0 mt-0.5">
                <ShieldCheck className="w-7 h-7 text-gold" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold bg-parchment/15 text-parchment px-2 py-0.5 rounded">
                  Safety Result
                </span>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-parchment mt-1">
                  No Known Conflict
                </h1>
                <p className="text-xs sm:text-sm text-parchment/80 mt-1 max-w-2xl leading-relaxed">
                  No specified allergen terms were found in the clearly read ingredient panel. (Note: this confirms absence only in the read text, not medical safety).
                </p>
              </div>
            </div>

            <Link
              href={`/scan/review?id=${scanId}&allergens=${encodeURIComponent(allergensParam)}`}
              className="px-4 py-2.5 bg-parchment text-ink font-medium text-xs font-mono rounded hover:bg-parchment-light transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink" />
              <span>Review Extracted Text</span>
            </Link>
          </div>
        )}
      </div>

      {/* 2. Responsive Main Layout (Task D)
          Desktop: Split layout (Photo on Left, Findings on Right)
          Narrow Screens: Single column with bottom sheet callouts
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Photo with SVG Highlights */}
        <div className="lg:col-span-6 bg-parchment-light border border-ink-border rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-mono text-ink-muted border-b border-ink-border pb-2">
            <span>Packaging Photo & Evidence Callouts</span>
            <span className="text-[11px]">Click an SVG box to inspect</span>
          </div>

          <div className="relative w-full rounded overflow-hidden border border-ink-border bg-parchment-dark aspect-square flex items-center justify-center">
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Scanned packaged food label"
                  className="w-full h-full object-contain"
                />
                {/* SVG Highlighting Layer with Fractional Coordinates */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {lines.map((l) => {
                    const isEvidence = activeLineIds.includes(l.line_no);
                    const isAnyEvidence = findings.some((f) =>
                      f.evidence.some((e) => e.line_id === l.line_no)
                    );
                    const isUncertain = l.uncertain || (l.touches_edge && !l.user_corrected);

                    let strokeColor = "#26231F";
                    let fillColor = "rgba(38, 35, 31, 0.05)";
                    let strokeWidth = "0.7";

                    if (isEvidence) {
                      strokeColor = "#A23B32";
                      fillColor = "rgba(162, 59, 50, 0.3)";
                      strokeWidth = "1.5";
                    } else if (isAnyEvidence) {
                      strokeColor = "#A23B32";
                      fillColor = "rgba(162, 59, 50, 0.15)";
                      strokeWidth = "1.0";
                    } else if (isUncertain) {
                      strokeColor = "#C69B37";
                      fillColor = "rgba(227, 185, 91, 0.2)";
                      strokeWidth = "1.0";
                    }

                    return (
                      <rect
                        key={l.line_no}
                        x={l.x * 100}
                        y={l.y * 100}
                        width={Math.max(2, l.w * 100)}
                        height={Math.max(2, l.h * 100)}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={isUncertain && !l.user_corrected ? "2,1" : "none"}
                        className="cursor-pointer transition-all hover:opacity-80"
                        onClick={() => {
                          const matchingFinding = findings.find((f) =>
                            f.evidence.some((e) => e.line_id === l.line_no)
                          );
                          if (matchingFinding) {
                            setSelectedFindingId(matchingFinding.id);
                          }
                        }}
                      />
                    );
                  })}
                </svg>
              </>
            ) : (
              <div className="text-xs font-mono text-ink-muted">No photo uploaded</div>
            )}
          </div>

          {/* SVG Legend */}
          <div className="flex flex-wrap gap-3 text-[11px] font-mono text-ink-muted pt-1 border-t border-ink-border">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-oxblood bg-oxblood/30"></span>
              Selected Flag Evidence
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-gold-dark border-dashed bg-gold/20"></span>
              Uncertain (&lt;80% / Edge)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-ink bg-ink/10"></span>
              Read OCR Lines
            </span>
          </div>
        </div>

        {/* Findings List Column (Desktop & Mobile) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs font-mono text-ink-muted px-1">
            <span>Evaluated Dietary Findings ({findings.length})</span>
            <span>Rules: label_safety.py</span>
          </div>

          <div className="space-y-4">
            {findings.map((f) => {
              const isSelected = selectedFindingId === f.id;
              const hasAi = Boolean(aiExplanations[f.id]);
              const isAiLoading = Boolean(loadingAi[f.id]);

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFindingId(f.id)}
                  className={`p-4 rounded-md border transition-all cursor-pointer ${
                    isSelected
                      ? f.result === "conflict_found"
                        ? "border-oxblood bg-parchment-light shadow-md ring-1 ring-oxblood/40"
                        : "border-gold-dark bg-parchment-light shadow-md ring-1 ring-gold/40"
                      : "border-ink-border bg-parchment-light hover:border-ink/40"
                  }`}
                >
                  {/* Finding Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-ink-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-base text-ink capitalize">
                        {f.allergen}
                      </span>
                      {f.result === "conflict_found" && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-oxblood text-parchment">
                          Conflict Found
                        </span>
                      )}
                      {f.result === "unknown" && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink border border-gold-dark/40">
                          Unknown
                        </span>
                      )}
                      {f.result === "no_known_conflict" && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-ink/10 text-ink">
                          No Known Conflict
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isAiLoading || hasAi}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestAiExplain(f);
                      }}
                      className="px-2.5 py-1 text-[11px] font-mono rounded border border-ink-border hover:bg-parchment-dark transition-colors flex items-center gap-1 text-ink-muted hover:text-ink disabled:opacity-60"
                      title="Generate plain-language explanation with Google Gemini"
                    >
                      {isAiLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-oxblood" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-gold-dark" />
                      )}
                      <span>Explain with AI</span>
                    </button>
                  </div>

                  {/* Rule Detail (Pure Python, No AI) */}
                  <div className="mt-2.5">
                    <p className="text-xs font-mono text-ink leading-relaxed">
                      {f.reason}
                    </p>
                  </div>

                  {/* Evidence Items from Real Photo */}
                  {f.evidence.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-ink-border/40 flex flex-col gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                        Label Evidence ({f.evidence.length} line{f.evidence.length > 1 ? "s" : ""}):
                      </span>

                      {f.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-parchment border border-ink-border text-xs font-mono flex items-start justify-between gap-2"
                        >
                          <div className="leading-relaxed text-ink">
                            <span className="text-ink-subtle mr-1.5">#{ev.line_id}</span>
                            <span>"{ev.text}"</span>
                          </div>

                          {/* Certainty Badges */}
                          <div className="shrink-0">
                            {ev.certainty === "confirmed" && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink/10 text-ink">
                                confirmed
                              </span>
                            )}
                            {ev.certainty === "uncertain" && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold text-ink border border-gold-dark/40 font-semibold">
                                uncertain
                              </span>
                            )}
                            {ev.certainty === "user_confirmed" && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-oxblood text-parchment font-semibold">
                                user_confirmed
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Explanation Section (Marked with [AI] tag) */}
                  {hasAi && (
                    <div className="mt-3 p-2.5 bg-parchment-dark border border-ink-border rounded text-xs leading-relaxed text-ink flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-oxblood">
                        <Sparkles className="w-3 h-3 text-oxblood" />
                        <span>AI EXPLANATION (Google Gemini)</span>
                      </div>
                      <p className="font-mono text-ink-muted text-[11px]">
                        {aiExplanations[f.id]}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="mt-2 p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-ink-muted font-mono">
              Need to correct an OCR mistake?
            </span>
            <Link
              href={`/scan/review?id=${scanId}&allergens=${encodeURIComponent(allergensParam)}`}
              className="w-full sm:w-auto px-4 py-2 bg-oxblood text-parchment font-medium font-mono rounded hover:bg-oxblood-hover transition-colors text-center"
            >
              Edit Label & Re-run
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-oxblood" />
          <p className="text-sm font-mono text-ink-muted">Loading results...</p>
        </div>
      }
    >
      <ResultsContent />
    </React.Suspense>
  );
}

