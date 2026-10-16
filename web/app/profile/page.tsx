"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { User, ShieldCheck, Dumbbell, Save, Camera, Check } from "lucide-react";

const ALLERGEN_OPTIONS = ["peanut", "milk", "soy", "wheat", "egg", "fish", "shellfish", "tree nuts"];

export default function ProfilePage() {
  const [allergies, setAllergies] = useState<string[]>(["peanut", "milk"]);
  const [diet, setDiet] = useState<string>("none");
  const [proteinGoal, setProteinGoal] = useState<number>(60);
  const [age, setAge] = useState<number>(24);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("nutrilens_profile");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.allergies) setAllergies(parsed.allergies);
        if (parsed.diet) setDiet(parsed.diet);
        if (parsed.proteinGoal) setProteinGoal(parsed.proteinGoal);
        if (parsed.age) setAge(parsed.age);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const toggleAllergen = (a: string) => {
    setAllergies((prev) =>
      prev.includes(a) ? prev.filter((item) => item !== a) : [...prev, a]
    );
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      "nutrilens_profile",
      JSON.stringify({ allergies, diet, proteinGoal, age })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-2">
      <div className="flex flex-col gap-1 border-b border-ink-border pb-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink flex items-center gap-2">
          <User className="w-6 h-6 text-oxblood" />
          Dietary Profile
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Your personal dietary restrictions and goals. Used to evaluate scanned packaged-food labels.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        {/* Allergens selection */}
        <div className="p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-oxblood" />
              Allergens to Avoid
            </span>
            <span className="text-[11px] font-mono text-ink-muted">
              {allergies.length} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALLERGEN_OPTIONS.map((alg) => {
              const active = allergies.includes(alg);
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
          </div>
          <p className="text-[11px] text-ink-muted font-mono mt-1">
            "Used only to flag labels for you. Nutrilens is not medical advice."
          </p>
        </div>

        {/* Diet Type */}
        <div className="p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col gap-3">
          <span className="font-heading font-bold text-sm text-ink">
            Dietary Preferences
          </span>
          <div className="grid grid-cols-3 gap-2">
            {["none", "vegetarian", "vegan"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDiet(d);
                  setSaved(false);
                }}
                className={`py-2 px-3 rounded text-xs font-mono font-medium capitalize border text-center transition-colors ${
                  diet === d
                    ? "bg-ink text-parchment border-ink"
                    : "bg-parchment text-ink border-ink-border hover:bg-parchment-dark"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Fitness / Gym protein goal */}
        <div className="p-4 bg-parchment-light border border-ink-border rounded-md flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-oxblood" />
            <span className="font-heading font-bold text-sm text-ink">
              Daily Protein Target (Gym Goal)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={10}
              max={300}
              value={proteinGoal}
              onChange={(e) => {
                setProteinGoal(Number(e.target.value));
                setSaved(false);
              }}
              className="w-24 px-3 py-1.5 bg-parchment border border-ink-border rounded text-ink text-sm font-mono focus:outline-none focus:border-oxblood"
            />
            <span className="text-xs font-mono text-ink-muted">grams / day</span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/scan"
            className="px-4 py-2 bg-parchment-light border border-ink-border rounded text-xs font-mono text-ink hover:bg-parchment-dark transition-colors flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-oxblood" />
            <span>Ready to Scan</span>
          </Link>

          <button
            type="submit"
            className="px-6 py-2.5 bg-oxblood text-parchment font-medium text-xs font-mono rounded hover:bg-oxblood-hover transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-parchment" />
            <span>{saved ? "Saved Successfully!" : "Save Profile"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
