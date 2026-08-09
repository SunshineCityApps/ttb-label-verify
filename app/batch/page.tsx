"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { FieldResultList, VERDICT_STYLE } from "@/components/results";
import { parseCsv } from "@/lib/csv";
import type { VerifyResponse } from "@/lib/api-types";
import type { ApplicationData } from "@/lib/verification/types";

/** Parallel requests to /api/verify — keeps a 300-label batch fast without hammering the API. */
const CONCURRENCY = 4;

const CSV_COLUMNS = ["filename", "brand_name", "class_type", "alcohol_content", "net_contents"] as const;

interface BatchRow {
  filename: string;
  application: ApplicationData;
  file: File | null;
  status: "waiting" | "checking" | "done" | "error";
  response?: VerifyResponse;
  error?: string;
  /** Seconds for this label's round trip — the <5s requirement, visible per row. */
  elapsed?: number;
}

export default function BatchPage() {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [unmatchedImages, setUnmatchedImages] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const imagesRef = useRef<Map<string, File>>(new Map());

  function loadImages(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      imagesRef.current.set(file.name, file);
    }
    setImageCount(imagesRef.current.size);
    rematch();
  }

  async function loadCsv(file: File | undefined) {
    if (!file) return;
    setCsvError(null);
    const parsed = parseCsv(await file.text());
    if (parsed.length === 0) {
      setCsvError("The CSV appears to be empty. It needs a header row plus one row per label.");
      return;
    }
    const missingColumns = CSV_COLUMNS.filter((c) => !(c in parsed[0]));
    if (missingColumns.length > 0) {
      setCsvError(
        `The CSV is missing these columns: ${missingColumns.join(", ")}. Expected columns: ${CSV_COLUMNS.join(", ")}.`,
      );
      return;
    }
    setRows(
      parsed.map((row) => ({
        filename: row.filename,
        application: {
          brandName: row.brand_name,
          classType: row.class_type,
          alcoholContent: row.alcohol_content,
          netContents: row.net_contents,
        },
        file: imagesRef.current.get(row.filename) ?? null,
        status: "waiting",
      })),
    );
    const listed = new Set(parsed.map((row) => row.filename));
    setUnmatchedImages(Array.from(imagesRef.current.keys()).filter((name) => !listed.has(name)));
    setExpanded(null);
  }

  function rematch() {
    setRows((current) =>
      current.map((row) => ({ ...row, file: imagesRef.current.get(row.filename) ?? row.file })),
    );
    setUnmatchedImages(() => {
      const known = new Set(rows.map((r) => r.filename));
      return Array.from(imagesRef.current.keys()).filter((name) => !known.has(name));
    });
  }

  async function runBatch() {
    setRunning(true);
    setExpanded(null);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        status: row.file ? "waiting" : "error",
        error: row.file ? undefined : "No uploaded image matches this filename.",
        response: undefined,
      })),
    );

    const queue = rows.map((_, index) => index).filter((i) => rows[i].file);

    async function worker() {
      while (queue.length > 0) {
        const index = queue.shift();
        if (index === undefined) return;
        setRows((current) =>
          current.map((row, i) => (i === index ? { ...row, status: "checking" } : row)),
        );
        const started = performance.now();
        try {
          const row = rows[index];
          const form = new FormData();
          form.append("image", row.file!);
          form.append("brandName", row.application.brandName);
          form.append("classType", row.application.classType);
          form.append("alcoholContent", row.application.alcoholContent);
          form.append("netContents", row.application.netContents);
          const res = await fetch("/api/verify", { method: "POST", body: form });
          let body: unknown = null;
          try {
            body = await res.json();
          } catch {}
          const message =
            body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
              ? ((body as { error: string }).error)
              : res.status === 413
                ? "Image too large to upload (limit 4 MB)."
                : "Verification failed. Please try again.";
          const elapsed = (performance.now() - started) / 1000;
          setRows((current) =>
            current.map((r, i) =>
              i === index
                ? res.ok && body
                  ? { ...r, status: "done", response: body as VerifyResponse, elapsed }
                  : { ...r, status: "error", error: message }
                : r,
            ),
          );
        } catch {
          setRows((current) =>
            current.map((r, i) =>
              i === index ? { ...r, status: "error", error: "Could not reach the server." } : r,
            ),
          );
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  const doneCount = rows.filter((r) => r.status === "done" || r.status === "error").length;
  const matchedCount = rows.filter((r) => r.file).length;
  const ready = rows.length > 0 && matchedCount > 0 && !running;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 text-slate-900">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Batch Label Verification</h1>
        <p className="mt-2 text-lg text-slate-600">
          Upload all the label images, then a CSV listing each label&apos;s application details.
        </p>
        <p className="mt-2">
          <Link href="/" className="text-lg font-medium text-blue-700 underline">
            ← Back to single label
          </Link>
        </p>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block rounded-xl border-4 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-400">
          <span className="block text-lg font-semibold">1. Choose label images</span>
          <span className="mt-1 block text-slate-500">
            You can select many at once ({imageCount} loaded)
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="mt-3 w-full text-slate-600"
            onChange={(e) => loadImages(e.target.files)}
          />
        </label>
        <label className="block rounded-xl border-4 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-400">
          <span className="block text-lg font-semibold">2. Choose the application CSV</span>
          <span className="mt-1 block text-slate-500">
            Columns: {CSV_COLUMNS.join(", ")}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-3 w-full text-slate-600"
            onChange={(e) => loadCsv(e.target.files?.[0])}
          />
        </label>
      </section>

      {csvError && (
        <div role="alert" className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-lg text-red-800">
          {csvError}
        </div>
      )}
      {rows.length > 0 && matchedCount < rows.length && (
        <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
          {rows.length - matchedCount} of {rows.length} CSV rows have no matching uploaded image —
          check that the filenames in the CSV match the image files you selected.
          {matchedCount === 0 && " Upload the images to enable verification."}
        </div>
      )}
      {unmatchedImages.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900">
          {unmatchedImages.length} uploaded image(s) are not listed in the CSV:{" "}
          {unmatchedImages.slice(0, 5).join(", ")}
          {unmatchedImages.length > 5 && "…"}
        </div>
      )}

      {rows.length > 0 && (
        <section className="mb-6">
          <button
            type="button"
            onClick={runBatch}
            disabled={!ready}
            className="w-full rounded-xl bg-blue-700 px-6 py-4 text-2xl font-bold text-white shadow hover:bg-blue-800 disabled:cursor-wait disabled:bg-slate-400"
          >
            {running
              ? `Checking… ${doneCount} of ${rows.length} finished`
              : `Verify ${rows.length} Labels`}
          </button>
        </section>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const verdict = row.response ? VERDICT_STYLE[row.response.result.overall] : null;
            return (
              <li key={`${row.filename}-${index}`} className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  disabled={!row.response}
                  onClick={() => setExpanded(expanded === index ? null : index)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left disabled:cursor-default"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{row.filename}</p>
                    <p className="truncate text-slate-600">{row.application.brandName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {row.status === "waiting" && <span className="text-slate-500">Waiting…</span>}
                    {row.status === "checking" && (
                      <span className="font-medium text-blue-700">Checking…</span>
                    )}
                    {row.status === "error" && (
                      <span className="font-semibold text-red-700">{row.error}</span>
                    )}
                    {row.status === "done" && verdict && (
                      <>
                        {row.elapsed !== undefined && (
                          <span className="mr-2 text-slate-500">{row.elapsed.toFixed(1)}s</span>
                        )}
                        <span
                          className={`inline-block rounded-full px-4 py-1 font-bold text-white ${verdict.style}`}
                        >
                          {verdict.short}
                        </span>
                      </>
                    )}
                    {row.response && (
                      <span className="ml-2 text-slate-500">{expanded === index ? "▲" : "▼"}</span>
                    )}
                  </div>
                </button>
                {expanded === index && row.response && (
                  <div className="border-t border-slate-200 p-4">
                    <FieldResultList fields={row.response.result.fields} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-slate-500">
        Labels are checked {CONCURRENCY} at a time. Results stay on this page — nothing is stored.
      </footer>
    </main>
  );
}
