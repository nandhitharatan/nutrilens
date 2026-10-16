import Link from "next/link";
import { Camera, ShieldAlert, HelpCircle, ArrowRight, Eye } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 py-4 sm:py-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="text-center flex flex-col items-center gap-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-parchment-dark border border-ink-border rounded-full text-xs font-mono font-medium text-ink">
          <Eye className="w-3.5 h-3.5 text-oxblood" />
          <span>Nutrilens v1.0 • Packaged Food Safety</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-heading font-bold text-ink tracking-tight max-w-3xl leading-tight">
          Look Beyond the Label.
        </h1>

        <p className="text-base sm:text-lg text-ink-muted max-w-2xl leading-relaxed">
          Photo verification for packaged food. We read the real ingredient print, check against your allergies, and tie every finding to exact proof on the packaging.
        </p>

        {/* 3 Core Rules Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mt-4 text-left">
          <div className="p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col gap-1">
            <span className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-oxblood"></span>
              Shows its proof
            </span>
            <p className="text-xs text-ink-muted">
              Every flag is tied to the exact bounding box and text on the physical label.
            </p>
          </div>

          <div className="p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col gap-1">
            <span className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gold-dark"></span>
              Honest about gaps
            </span>
            <p className="text-xs text-ink-muted">
              Missing, blurry, or low-confidence data is marked Unknown. Never "safe".
            </p>
          </div>

          <div className="p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col gap-1">
            <span className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ink"></span>
              Human in the loop
            </span>
            <p className="text-xs text-ink-muted">
              Review OCR readings, fix curved or unclear lines, and re-run rules instantly.
            </p>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 w-full sm:w-auto">
          <Link
            href="/scan"
            className="w-full sm:w-auto px-6 py-3.5 bg-oxblood text-parchment rounded hover:bg-oxblood-hover transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
          >
            <Camera className="w-5 h-5 text-parchment" />
            <span>Scan a Label Now</span>
          </Link>
          <Link
            href="/profile"
            className="w-full sm:w-auto px-6 py-3.5 bg-parchment-light border border-ink-border text-ink rounded hover:bg-parchment-dark transition-colors font-medium flex items-center justify-center gap-2"
          >
            <span>Set Dietary Profile</span>
          </Link>
        </div>
      </section>

      {/* Signature Feature Showcase Card */}
      <section className="bg-parchment-light border border-ink-border rounded-md p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-ink-border pb-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-ink">
              Signature Label Highlight Preview
            </h2>
            <p className="text-xs text-ink-muted font-mono">
              Real photo overlay with fractional SVG bounding boxes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs rounded bg-oxblood/10 border border-oxblood/30 text-oxblood font-mono font-medium">
              Conflict Found
            </span>
            <span className="px-2.5 py-1 text-xs rounded bg-gold/20 border border-gold/40 text-ink font-mono font-medium">
              Uncertain OCR
            </span>
          </div>
        </div>

        {/* Sample Interactive Demo Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Simulated Label Photo with SVG Highlights */}
          <div className="relative aspect-[4/3] bg-parchment-dark border border-ink-border rounded overflow-hidden flex flex-col justify-between p-4 select-none">
            <div className="space-y-2 opacity-80">
              <div className="h-4 bg-ink/20 rounded w-1/3"></div>
              <div className="h-3 bg-ink/10 rounded w-3/4"></div>
            </div>

            {/* Simulated Highlight Box for Conflict */}
            <div className="relative border-2 border-oxblood bg-oxblood/10 p-2.5 rounded shadow-sm">
              <span className="absolute -top-3 left-2 bg-oxblood text-parchment text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                EVIDENCE #1 • CONFIRMED
              </span>
              <p className="text-xs font-mono text-ink font-semibold">
                INGREDIENTS: Wheat flour, sugar, whey powder (milk), salt.
              </p>
            </div>

            {/* Simulated Highlight Box for Uncertain */}
            <div className="relative border-2 border-gold-dark bg-gold/15 p-2 rounded">
              <span className="absolute -top-3 left-2 bg-gold-dark text-parchment-light text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                EVIDENCE #2 • UNCERTAIN OCR
              </span>
              <p className="text-xs font-mono text-ink">
                CONTAINS: S0Y, M1LK (OCR confidence 0.71 &lt; 0.80)
              </p>
            </div>

            <div className="text-[10px] text-ink-subtle font-mono text-right">
              Fractional Coordinates: x=0.12, y=0.45, w=0.76, h=0.18
            </div>
          </div>

          {/* Finding Explanation Column */}
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-parchment border border-ink-border rounded">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-oxblood flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-oxblood" />
                  Milk Allergy Conflict
                </span>
                <span className="text-[11px] font-mono uppercase bg-oxblood text-parchment px-1.5 py-0.5 rounded">
                  conflict_found
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-2">
                'milk' or a related term appears on the label: "whey powder (milk)".
              </p>
            </div>

            <div className="p-4 bg-parchment border border-ink-border rounded">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-gold-dark" />
                  Peanut Allergy
                </span>
                <span className="text-[11px] font-mono uppercase bg-gold/30 text-ink px-1.5 py-0.5 rounded">
                  unknown
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-2">
                Cannot rule out 'peanut': ingredient list is unclear or may be cut off. Never assumed safe.
              </p>
            </div>

            <Link
              href="/scan"
              className="inline-flex items-center gap-2 text-xs font-mono font-medium text-oxblood hover:underline self-start mt-1"
            >
              <span>Test with your own food label photo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
