"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { FieldResultList, VERDICT_STYLE } from "@/components/results";
import type { VerifyResponse } from "@/lib/api-types";

const SAMPLE = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45%",
  netContents: "750 mL",
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fields, setFields] = useState({ brandName: "", classType: "", alcoholContent: "", netContents: "" });
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<VerifyResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function chooseFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setResponse(null);
    setError(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  async function verify() {
    if (!file) {
      setError("Please add a label image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResponse(null);
    const started = performance.now();
    try {
      const form = new FormData();
      form.append("image", file);
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      const res = await fetch("/api/verify", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResponse(body as VerifyResponse);
      setElapsed((performance.now() - started) / 1000);
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle =
    "w-full rounded-lg border-2 border-slate-300 px-4 py-3 text-lg text-slate-900 focus:border-blue-600 focus:outline-none";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 text-slate-900">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">TTB Label Verification</h1>
        <p className="mt-2 text-lg text-slate-600">
          Upload a label, enter the application details, and press Verify.
        </p>
        <p className="mt-2">
          <Link href="/batch" className="text-lg font-medium text-blue-700 underline">
            Have many labels? Use batch mode →
          </Link>
        </p>
      </header>

      {/* Step 1: image */}
      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Step 1 — Label image</h2>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a label image"
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            chooseFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-4 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={previewUrl} alt="Label preview" className="max-h-64 rounded-lg shadow" />
          ) : (
            <>
              <p className="text-lg font-medium">Click here to choose a label image</p>
              <p className="mt-1 text-slate-500">or drag and drop it into this box (JPG, PNG, WebP)</p>
            </>
          )}
        </div>
        {file && (
          <p className="mt-2 text-slate-600">
            Selected: <span className="font-medium">{file.name}</span> — click the box to change it
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
      </section>

      {/* Step 2: application data */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Step 2 — Application details</h2>
          <button
            type="button"
            onClick={() => setFields(SAMPLE)}
            className="rounded-lg border-2 border-blue-600 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50"
          >
            Fill with sample data
          </button>
        </div>
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          {(
            [
              ["brandName", "Brand name", "e.g. OLD TOM DISTILLERY"],
              ["classType", "Class / type", "e.g. Kentucky Straight Bourbon Whiskey"],
              ["alcoholContent", "Alcohol content", "e.g. 45%"],
              ["netContents", "Net contents", "e.g. 750 mL"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-lg font-medium">{label}</span>
              <input
                type="text"
                value={fields[key]}
                placeholder={placeholder}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                className={inputStyle}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-slate-500">
          The government warning is checked automatically against the required legal text — no need to
          type it.
        </p>
      </section>

      {/* Step 3: verify */}
      <section className="mb-8">
        <button
          type="button"
          onClick={verify}
          disabled={busy}
          className="w-full rounded-xl bg-blue-700 px-6 py-4 text-2xl font-bold text-white shadow hover:bg-blue-800 disabled:cursor-wait disabled:bg-slate-400"
        >
          {busy ? "Checking the label…" : "Verify Label"}
        </button>
      </section>

      {error && (
        <div role="alert" className="mb-8 rounded-xl border-2 border-red-300 bg-red-50 p-5 text-lg">
          <p className="font-semibold text-red-800">We couldn&apos;t check this label</p>
          <p className="mt-1 text-red-700">{error}</p>
        </div>
      )}

      {response && (
        <section aria-live="polite">
          <div
            className={`rounded-xl p-5 text-center text-2xl font-bold text-white ${VERDICT_STYLE[response.result.overall].style}`}
          >
            {VERDICT_STYLE[response.result.overall].text}
            {elapsed !== null && (
              <span className="mt-1 block text-base font-normal opacity-90">
                Checked in {elapsed.toFixed(1)} seconds
              </span>
            )}
          </div>
          <div className="mt-4">
            <FieldResultList fields={response.result.fields} />
          </div>
        </section>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-slate-500">
        Prototype — verification results are decision support, not a final compliance determination.
        Images are processed in memory and never stored.
      </footer>
    </main>
  );
}
