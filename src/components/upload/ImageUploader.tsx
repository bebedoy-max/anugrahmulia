import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";


export function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} lebih dari 8MB.`);
          continue;
        }
        const saved = await uploadFile(file, { kind: "image", folder: "properti" });
        uploaded.push(saved.url);
      }
      if (uploaded.length) {
        onChange([...value, ...uploaded]);
        toast.success(`${uploaded.length} foto diunggah.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(index: number, delta: number) {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? "Mengunggah…" : "Unggah foto"}
        </Button>
        <span className="text-sm text-muted-foreground">
          JPG/PNG/WEBP, maksimal 8MB per foto. Foto pertama menjadi foto utama.
        </span>
      </div>

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((url, index) => (
            <div key={url} className="overflow-hidden rounded-lg border bg-muted/30">
              <img src={url} alt={`Foto properti ${index + 1}`} loading="lazy" className="h-28 w-full object-cover" />
              <div className="flex items-center justify-between gap-1 p-1.5">
                <span className="text-xs text-muted-foreground">{index === 0 ? "Utama" : index + 1}</span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(index, -1)}>
                    ↑
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(index, 1)}>
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
