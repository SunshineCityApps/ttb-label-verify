import type { FieldResult, MatchStatus, OverallVerdict } from "@/lib/verification/types";

export const FIELD_LABELS: Record<FieldResult["field"], string> = {
  brandName: "Brand Name",
  classType: "Class / Type",
  alcoholContent: "Alcohol Content",
  netContents: "Net Contents",
  governmentWarning: "Government Warning",
};

const STATUS_STYLE: Record<MatchStatus, { icon: string; badge: string; row: string; label: string }> = {
  match: {
    icon: "✓",
    badge: "bg-green-600 text-white",
    row: "border-green-200 bg-green-50",
    label: "Match",
  },
  match_with_note: {
    icon: "!",
    badge: "bg-amber-500 text-white",
    row: "border-amber-200 bg-amber-50",
    label: "Match — needs your review",
  },
  mismatch: {
    icon: "✕",
    badge: "bg-red-600 text-white",
    row: "border-red-200 bg-red-50",
    label: "Mismatch",
  },
};

export const VERDICT_STYLE: Record<OverallVerdict, { text: string; short: string; style: string }> = {
  pass: {
    text: "PASS — label matches the application",
    short: "Pass",
    style: "bg-green-600",
  },
  needs_review: {
    text: "NEEDS REVIEW — matches, but check the noted items",
    short: "Needs review",
    style: "bg-amber-500",
  },
  fail: {
    text: "FAIL — label does not match the application",
    short: "Fail",
    style: "bg-red-600",
  },
};

export function FieldResultList({ fields }: { fields: FieldResult[] }) {
  return (
    <ul className="space-y-3">
      {fields.map((field) => {
        const style = STATUS_STYLE[field.status];
        return (
          <li key={field.field} className={`rounded-xl border-2 p-4 ${style.row}`}>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold ${style.badge}`}
              >
                {style.icon}
              </span>
              <div>
                <p className="text-lg font-semibold">{FIELD_LABELS[field.field]}</p>
                <p className="text-slate-600">{style.label}</p>
              </div>
            </div>
            <dl className="mt-3 grid gap-1 text-lg sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">On the label</dt>
                <dd className="break-words">{field.labelValue ?? "Not found"}</dd>
              </div>
              {field.applicationValue !== null && (
                <div>
                  <dt className="font-medium text-slate-500">On the application</dt>
                  <dd className="break-words">{field.applicationValue}</dd>
                </div>
              )}
            </dl>
            {field.note && <p className="mt-2 text-slate-700">{field.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
