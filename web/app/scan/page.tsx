"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, AlertTriangle, RefreshCw, Check, ArrowRight, Info } from "lucide-react";

const COMMON_ALLERGENS = ["peanut", "milk", "soy", "wheat", "egg"];

export default function ScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(["peanut", "milk"]);
  const [customAllergen, setCustomAllergen] = useState("");
  const [loading, setLoading] = useState(false);
  const [retakeError, setRetakeError] = useState<{
    reasons: string[];
    blur_score?: number;
    brightness?: number;
  } | null>(null);

  const toggleAllergen = (a: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(a) ? prev.filter((item) => item !== a) : [...prev, a]
    );
  };

  const addCustomAllergen = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customAllergen.trim().toLowerCase();
    if (trimmed && !selectedAllergens.includes(trimmed)) {
      setSelectedAllergens((prev) => [...prev, trimmed]);
      setCustomAllergen("");
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setRetakeError(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setRetakeError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/scan`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Scan request failed");
      }

      const data = await res.json();

      if (data.action === "retake") {
        setRetakeError({
          reasons: data.reasons || ["image_unreadable"],
          blur_score: data.blur_score,
          brightness: data.brightness,
        });
        setLoading(false);
        return;
      }

      // If proceed or confirm_manually, go to /scan/review
      const allergensQuery = encodeURIComponent(selectedAllergens.join(","));
      router.push(`/scan/review?id=${data.scan_id}&allergens=${allergensQuery}`);
    } catch (err) {
      console.error(err);
      setRetakeError({
        reasons: ["Could not connect to API server. Please verify backend is running on port 8000."],
      });
      setLoading(false);
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "blurry":
        return "Image is blurry. Hold your phone steady or place the item on a flat surface.";
      case "too_dark":
        return "Image is too dark. Increase room lighting or avoid strong shadows.";
      case "glare":
        return "Severe glare detected on glossy packaging. Angle slightly away from light.";
      case "too_small":
        return "Resolution is too low. Move closer to the ingredient text (minimum 600px).";
      case "ocr_poor":
        return "OCR engine found insufficient or unreadable text. Retake closer to the ingredients.";
      default:
        return reason;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink">
          Scan Packaging Label
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Capture or upload the ingredient panel. We check quality and OCR confidence before safety analysis.
        </p>
      </div>

      {/* Allergens to check */}
      <div className="bg-parchment-light border border-ink-border rounded-md p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
            <Info className="w-4 h-4 text-oxblood" />
            Active Allergens to Flag
          </span>
          <span className="text-[11px] font-mono text-ink-muted">
            {selectedAllergens.length} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {COMMON_ALLERGENS.map((alg) => {
            const active = selectedAllergens.includes(alg);
            return (
              <button
                key={alg}
                type="button"
                onClick={() => toggleAllergen(alg)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors border flex items-center gap-1.5 ${
                  active
                    ? "bg-oxblood text-parchment border-oxblood"
                    : "bg-parchment text-ink border-ink-border hover:bg-parchment-dark"
                }`}
              >
                {active && <Check className="w-3 h-3 text-parchment" />}
                <span className="capitalize">{alg}</span>
              </button>
            );
          })}
          {selectedAllergens
            .filter((a) => !COMMON_ALLERGENS.includes(a))
            .map((alg) => (
              <button
                key={alg}
                type="button"
                onClick={() => toggleAllergen(alg)}
                className="px-3 py-1.5 rounded text-xs font-mono font-medium bg-oxblood text-parchment border border-oxblood flex items-center gap-1.5"
              >
                <Check className="w-3 h-3 text-parchment" />
                <span className="capitalize">{alg}</span>
              </button>
            ))}
        </div>

        {/* Add custom allergen */}
        <form onSubmit={addCustomAllergen} className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder="Add custom allergen (e.g. sesame)..."
            value={customAllergen}
            onChange={(e) => setCustomAllergen(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs bg-parchment border border-ink-border rounded text-ink focus:outline-none focus:border-oxblood font-mono"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-ink text-parchment rounded text-xs font-medium hover:bg-ink-muted transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {/* Retake Prompt Error Banner */}
      {retakeError && (
        <div className="p-4 bg-oxblood-light border-2 border-oxblood rounded-md flex flex-col gap-2">
          <div className="flex items-center gap-2 text-oxblood font-heading font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-oxblood shrink-0" />
            <span>Retake Photo Needed</span>
          </div>
          <div className="text-xs text-ink space-y-1 pl-7">
            {retakeError.reasons.map((r, i) => (
              <p key={i} className="font-medium">• {getReasonLabel(r)}</p>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted pl-7 mt-1 font-mono">
            Safety rule: Missing or unreadable data can never be evaluated as safe.
          </p>
        </div>
      )}

      {/* Upload & Camera Box */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-md p-6 sm:p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors text-center ${
          previewUrl
            ? "border-oxblood/50 bg-parchment-light"
            : "border-ink-border hover:border-oxblood/60 bg-parchment-light hover:bg-parchment-dark/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        {previewUrl ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="relative max-h-64 max-w-full rounded overflow-hidden border border-ink-border shadow-sm">
              <img
                src={previewUrl}
                alt="Selected label preview"
                className="max-h-64 object-contain"
              />
            </div>
            <p className="text-xs font-mono text-ink-muted">
              {selectedFile?.name} (Click or drop to replace)
            </p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-parchment-dark border border-ink-border flex items-center justify-center text-oxblood">
              <Camera className="w-6 h-6 text-oxblood" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-heading font-bold text-ink">
                Tap to open camera or upload label photo
              </p>
              <p className="text-xs text-ink-muted font-mono">
                Supports JPG, PNG • capture="environment" on mobile
              </p>
            </div>
          </>
        )}
      </div>

      {/* Shooting tips */}
      <div className="p-3 bg-parchment border border-ink-border rounded text-[11px] font-mono text-ink-muted flex items-start gap-2">
        <Info className="w-4 h-4 text-gold-dark shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-ink">Capture Guidance: </span>
          Keep the package flat, avoid harsh ceiling glare, and ensure the full ingredient and allergen list is within the frame.
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          disabled={!selectedFile || loading}
          onClick={handleSubmit}
          className="w-full py-3.5 px-6 bg-oxblood text-parchment font-medium rounded hover:bg-oxblood-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-parchment" />
              <span>Analyzing photo & reading text...</span>
            </>
          ) : (
            <>
              <span>Review Extracted Label</span>
              <ArrowRight className="w-4 h-4 text-parchment" />
            </>
          )}
        </button>

        {previewUrl && (
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setPreviewUrl(null);
              setRetakeError(null);
            }}
            className="w-full sm:w-auto px-4 py-3 bg-parchment-light border border-ink-border text-xs font-medium rounded hover:bg-parchment-dark transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
