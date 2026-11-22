import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

export const MAX_IMAGE_MB = 5;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Photo picker for Add/Edit item: upload a file (stored in Cloudinary after
 * save) or paste an image link. A chosen file wins over the link.
 */
export default function ItemImageInput({ url, onUrlChange, file, onFileChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function handlePick(e) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!picked) return;
    if (!ACCEPTED.includes(picked.type)) {
      toast.error("Please choose a JPEG, PNG or WebP image");
      return;
    }
    if (picked.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Image must be ${MAX_IMAGE_MB} MB or smaller`);
      return;
    }
    onFileChange(picked);
  }

  const shown = preview || url.trim();

  return (
    <div className="space-y-1.5">
      <label className="label">Photo</label>
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {shown ? (
            <img src={shown} alt="Item preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <ImagePlus className="h-6 w-6" />
            </div>
          )}
          {file && (
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              aria-label="Remove chosen photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={handlePick}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn btn-ghost w-full border border-gray-200 min-h-[40px] flex items-center justify-center gap-2"
          >
            <ImagePlus className="h-4 w-4" />
            {file ? "Choose another photo" : "Upload photo"}
          </button>
          {file ? (
            <p className="truncate text-xs text-gray-500">
              {file.name} — uploads when you save
            </p>
          ) : (
            <input
              type="url"
              className="input"
              placeholder="…or paste an image link"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
            />
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400">JPEG, PNG or WebP, up to {MAX_IMAGE_MB} MB.</p>
    </div>
  );
}
