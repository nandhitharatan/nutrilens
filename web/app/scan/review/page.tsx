"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Edit2,
  Save,
  ArrowRight,
  RefreshCw,
  Camera,
} from "lucide-react";

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

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("id");
  const allergensParam = searchParams.get("allergens") || "peanut,milk";
  const userAllergens = allergensParam.split(",").filter(Boolean);

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<BoxLine[]>([]);
  const [editingLineNo, setEditingLineNo] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [activeLineNo, setActiveLineNo] = useState<number | null>(null);
  const [savingLine, setSavingLine] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!scanId) return;

    fetch(`${apiUrl}/scan/${scanId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load scan");
        return res.json();
      })
      .then((data) => {
        setImageUrl(data.image_url ? `${apiUrl}${data.image_url}` : null);
        setLines(data.lines || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [scanId, apiUrl]);

  // Determine next_action based on lines
  const uncertainLines = lines.filter((l) => l.uncertain || (l.touches_edge && !l.user_corrected));
  const ingredientLines = lines.filter((l) => l.field === "ingredient");
  const ingredientUncertain =
    ingredientLines.length === 0 ||
    ingredientLines.some((l) => l.uncertain || (l.touches_edge && !l.user_corrected));
  const ocrPoor = lines.length < 5 || (lines.length > 0 && uncertainLines.length / lines.length > 0.4);

  const requiresRetake = ocrPoor;
  const requiresConfirmation = !requiresRetake && ingredientUncertain;

  const handleStartEdit = (line: BoxLine) => {
    setEditingLineNo(line.line_no);
    setEditText(line.corrected_text || line.text);
    setActiveLineNo(line.line_no);
  };

  const handleSaveEdit = async (lineNo: number) => {
    if (!scanId) return;
    setSavingLine(true);
    try {
      const res = await fetch(`${apiUrl}/scan/${scanId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_no: lineNo,
          corrected_text: editText,
        }),
      });

      if (!res.ok) throw new Error("Failed to save correction");

      // Update local state
      setLines((prev) =>
        prev.map((l) => {
          if (l.line_no === lineNo) {
            return {
              ...l,
              user_corrected: true,
              corrected_text: editText,
              uncertain: false,
              certainty: "user_confirmed",
            };
          }
          return l;
        })
      );
      setEditingLineNo(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save correction");
    } finally {
      setSavingLine(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!scanId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: scanId,
          user_allergens: userAllergens,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      router.push(`/results/${scanId}?allergens=${encodeURIComponent(allergensParam)}`);
    } catch (err) {
      console.error(err);
      alert("Failed to run analysis. Check backend console.");
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-oxblood" />
        <p className="text-sm font-mono text-ink-muted">Loading OCR review data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-2">
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-ink-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink">
            Review Extracted Label
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Verify OCR reading accuracy. Lines below 80% confidence or touching photo edges are flagged.
          </p>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="w-full sm:w-auto px-6 py-2.5 bg-oxblood text-parchment font-medium rounded hover:bg-oxblood-hover transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-parchment" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>Run Safety Analysis</span>
              <ArrowRight className="w-4 h-4 text-parchment" />
            </>
          )}
        </button>
      </div>

      {/* Action Prompts based on next_action() */}
      {requiresRetake && (
        <div className="p-4 bg-oxblood-light border-2 border-oxblood rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-oxblood shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-bold text-sm text-oxblood">
                Clearer Photo Recommended
              </p>
              <p className="text-xs text-ink mt-0.5">
                Over 40% of OCR lines have low confidence or fewer than 5 lines were found. You can retake the photo or edit lines manually below.
              </p>
            </div>
          </div>
          <Link
            href="/scan"
            className="px-4 py-2 bg-oxblood text-parchment rounded text-xs font-mono font-medium hover:bg-oxblood-hover transition-colors shrink-0 flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-parchment" />
            <span>Retake Photo</span>
          </Link>
        </div>
      )}

      {requiresConfirmation && (
        <div className="p-4 bg-gold-light border-2 border-gold-dark rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-gold-dark shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-bold text-sm text-ink">
                Manual Confirmation Required: Ingredient List
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                The ingredient list contains uncertain text or touches the photo border (possibly cut off). Please confirm or correct the text below.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-gold text-ink rounded shrink-0">
            Confirm fields below
          </span>
        </div>
      )}

      {/* Main Review Grid: Photo with SVG Bounding Boxes + Interactive Line Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image with SVG overlays */}
        <div className="lg:col-span-6 bg-parchment-light border border-ink-border rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-ink-muted font-mono border-b border-ink-border pb-2">
            <span>Packaging Photo & SVG Boxes</span>
            <span>{lines.length} lines detected</span>
          </div>

          <div className="relative w-full rounded overflow-hidden border border-ink-border bg-parchment-dark aspect-square flex items-center justify-center">
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Scanned packaging label"
                  className="w-full h-full object-contain"
                />
                {/* SVG Layer for Exact Bounding Boxes */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {lines.map((l) => {
                    const isSelected = activeLineNo === l.line_no;
                    const isUncertain = l.uncertain || (l.touches_edge && !l.user_corrected);
                    const strokeColor = l.user_corrected
                      ? "#A23B32"
                      : isUncertain
                      ? "#C69B37"
                      : "#26231F";

                    return (
                      <rect
                        key={l.line_no}
                        x={l.x * 100}
                        y={l.y * 100}
                        width={Math.max(2, l.w * 100)}
                        height={Math.max(2, l.h * 100)}
                        fill={
                          isSelected
                            ? "rgba(162, 59, 50, 0.25)"
                            : isUncertain
                            ? "rgba(227, 185, 91, 0.2)"
                            : "rgba(38, 35, 31, 0.05)"
                        }
                        stroke={strokeColor}
                        strokeWidth={isSelected ? "1.2" : "0.8"}
                        strokeDasharray={isUncertain && !l.user_corrected ? "2,1" : "none"}
                        className="transition-all"
                      />
                    );
                  })}
                </svg>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-muted p-6 text-center">
                <Camera className="w-8 h-8 text-ink-subtle" />
                <p className="text-xs font-mono">Image preview unavailable</p>
              </div>
            )}
          </div>

          {/* SVG Legend */}
          <div className="flex flex-wrap gap-3 text-[11px] font-mono text-ink-muted pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-ink bg-ink/5"></span>
              Confirmed OCR
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-gold-dark border-dashed bg-gold/20"></span>
              Uncertain (&lt;80% / Edge)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-oxblood bg-oxblood/20"></span>
              User Corrected
            </span>
          </div>
        </div>

        {/* Right Column: Editable OCR Lines List */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-mono text-ink-muted px-1">
            <span>Extracted Lines & Corrections</span>
            <span>Click any line to edit</span>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {lines.length === 0 ? (
              <div className="p-6 bg-parchment-light border border-ink-border rounded text-center text-ink-muted text-xs">
                No OCR lines detected on this label.
              </div>
            ) : (
              lines.map((l) => {
                const isEditing = editingLineNo === l.line_no;
                const isSelected = activeLineNo === l.line_no;
                const isUncertain = l.uncertain || (l.touches_edge && !l.user_corrected);

                return (
                  <div
                    key={l.line_no}
                    onClick={() => setActiveLineNo(l.line_no)}
                    className={`p-3 rounded border transition-all ${
                      isSelected
                        ? "border-oxblood bg-parchment-light shadow-sm"
                        : isUncertain
                        ? "border-gold-dark bg-gold-light/60"
                        : "border-ink-border bg-parchment-light hover:border-ink/50"
                    }`}
                  >
                    {/* Line Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-ink/10 text-ink">
                          Line #{l.line_no}
                        </span>
                        {l.field && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-parchment-dark text-ink-muted border border-ink-border">
                            {l.field}
                          </span>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5">
                        {l.user_corrected ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-oxblood text-parchment">
                            User Confirmed
                          </span>
                        ) : isUncertain ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-gold text-ink border border-gold-dark/40 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-ink" />
                            Uncertain ({Math.round(l.ocr_confidence * 100)}%)
                            {l.touches_edge && " • Edge"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink/10 text-ink-muted">
                            Confirmed ({Math.round(l.ocr_confidence * 100)}%)
                          </span>
                        )}

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(l);
                            }}
                            className="p-1 text-ink-muted hover:text-oxblood transition-colors rounded hover:bg-parchment-dark"
                            title="Edit this line"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Line Text or Edit Form */}
                    {isEditing ? (
                      <div
                        className="flex flex-col gap-2 mt-2 pt-2 border-t border-ink-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="w-full text-xs font-mono p-2 bg-parchment border border-oxblood rounded text-ink focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingLineNo(null)}
                            className="px-2.5 py-1 text-xs font-mono text-ink-muted hover:text-ink transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingLine}
                            onClick={() => handleSaveEdit(l.line_no)}
                            className="px-3 py-1 bg-oxblood text-parchment rounded text-xs font-mono font-medium hover:bg-oxblood-hover transition-colors flex items-center gap-1"
                          >
                            {savingLine ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-parchment" />
                            ) : (
                              <Save className="w-3 h-3 text-parchment" />
                            )}
                            <span>Save Correction</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-ink leading-relaxed break-words">
                        {l.corrected_text ? (
                          <div>
                            <span className="font-semibold text-oxblood">{l.corrected_text}</span>
                            <span className="text-[10px] text-ink-muted block mt-0.5">
                              (Original: {l.text})
                            </span>
                          </div>
                        ) : (
                          <span>{l.text}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-2 pt-3 border-t border-ink-border flex justify-between items-center text-xs font-mono text-ink-muted">
            <span>Allergen checks: {userAllergens.join(", ")}</span>
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="px-4 py-2 bg-oxblood text-parchment rounded font-medium hover:bg-oxblood-hover transition-colors flex items-center gap-1.5"
            >
              <span>Analyze Label</span>
              <ArrowRight className="w-3.5 h-3.5 text-parchment" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-oxblood" />
          <p className="text-sm font-mono text-ink-muted">Loading review data...</p>
        </div>
      }
    >
      <ReviewContent />
    </React.Suspense>
  );
}

