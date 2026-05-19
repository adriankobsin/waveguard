import { resizeImageFile } from "@/lib/resizeImage";

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.startsWith("data:")) {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read image as data URL."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Prepare logo for display and storage. Always returns an embedded data URL so
 * previews and the sidebar work without a remote file host.
 */
export async function uploadLogoFile(file) {
  const resized = await resizeImageFile(file);
  return fileToDataUrl(resized);
}
