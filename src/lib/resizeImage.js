/**
 * Resize an image file to fit within maxSize×maxSize (preserves aspect ratio, no upscale).
 * @returns {Promise<File>} PNG file suitable for upload
 */
function resolveMimeType(file) {
  if (file.type) return file.type;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] || "";
}

export async function resizeImageFile(file, maxSize = 128) {
  const mime = resolveMimeType(file);
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(mime)) {
    throw new Error("Please upload a PNG, JPG, WebP, or SVG image.");
  }

  if (mime === "image/svg+xml") {
    return file;
  }

  try {
    return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not compress image."));
            return;
          }
          const base = file.name.replace(/\.[^.]+$/, "") || "logo";
          resolve(new File([blob], `${base}.png`, { type: "image/png" }));
        },
        "image/png",
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image file."));
    };

    img.src = url;
    });
  } catch {
    return file;
  }
}
