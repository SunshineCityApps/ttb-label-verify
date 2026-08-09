import { extractLabel } from "@/lib/extraction";
import { sniffImageType } from "@/lib/image-sniff";
import { verifyLabel } from "@/lib/verification";
import type { ApplicationData } from "@/lib/verification";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Vercel rejects request bodies over ~4.5 MB at the platform layer, so the
 * effective ceiling is enforced client-side at 4 MB; this server check keeps
 * local/dev behavior consistent with production. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

  if (!ACCEPTED_TYPES.includes(image.type)) {
    return Response.json(
      { error: "Unsupported image type. Please upload a JPG, PNG, or WebP image." },
      { status: 400 },
    );
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: "Image is too large (over 4 MB). Please resize it and try again." },
      { status: 400 },
    );
  }

  const imageBytes = new Uint8Array(await image.arrayBuffer());

  // The declared MIME type comes from the filename; the bytes are authoritative.
  // Catches renamed/corrupted files before they reach the AI as a confusing error.
  const mediaType = sniffImageType(imageBytes);
  if (!mediaType) {
    return Response.json(
      {
        error:
          "This file doesn't appear to be a valid image — it may be renamed or corrupted. Please upload an actual JPG, PNG, or WebP image.",
      },
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

  const imageBase64 = Buffer.from(imageBytes).toString("base64");

  const extraction = await extractLabel(imageBase64, mediaType);
  if (!extraction.ok) {
    const status = extraction.error === "api_error" ? 502 : 422;
    return Response.json(
      { error: extraction.message, errorType: extraction.error },
      { status },
    );
  }

  const result = verifyLabel(extraction.label, application);

  return Response.json({ extracted: extraction.label, result });
}
