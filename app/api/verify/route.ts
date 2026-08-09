import { extractLabel } from "@/lib/extraction";
import { verifyLabel } from "@/lib/verification";
import type { ApplicationData } from "@/lib/verification";

const ACCEPTED_TYPES = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
} as const;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/verify — multipart form: `image` file + the four application fields.
 * Returns { extracted, result } on success. Stateless: the image is processed
 * in memory and never stored.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: "Expected a multipart form with an image and application fields." },
      { status: 400 },
    );
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "Please attach a label image." }, { status: 400 });
  }

  const mediaType = ACCEPTED_TYPES[image.type as keyof typeof ACCEPTED_TYPES];
  if (!mediaType) {
    return Response.json(
      { error: "Unsupported image type. Please upload a JPG, PNG, or WebP image." },
      { status: 400 },
    );
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: "Image is too large (over 8 MB). Please upload a smaller image." },
      { status: 400 },
    );
  }

  const application: ApplicationData = {
    brandName: String(form.get("brandName") ?? "").trim(),
    classType: String(form.get("classType") ?? "").trim(),
    alcoholContent: String(form.get("alcoholContent") ?? "").trim(),
    netContents: String(form.get("netContents") ?? "").trim(),
  };

  const missing = (Object.keys(application) as (keyof ApplicationData)[]).filter(
    (key) => application[key] === "",
  );
  if (missing.length > 0) {
    return Response.json(
      { error: `Please fill in all application fields (missing: ${missing.join(", ")}).` },
      { status: 400 },
    );
  }

  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  const extraction = await extractLabel(imageBase64, mediaType);
  if (!extraction.ok) {
    const status = extraction.error === "unreadable" ? 422 : 502;
    return Response.json(
      { error: extraction.message, errorType: extraction.error },
      { status },
    );
  }

  const result = verifyLabel(extraction.label, application);

  return Response.json({ extracted: extraction.label, result });
}
