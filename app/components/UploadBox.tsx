"use client";

import { useRef, useState } from "react";

interface UploadBoxProps {
  file: File | null;
  onFileSelected: (file: File | null) => void;
}

const ACCEPTED_TYPES = ["application/pdf", "image/png"];
const MAX_SIZE_MB = 10;

export default function UploadBox({ file, onFileSelected }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function validateAndSet(f: File | null) {
    setLocalError(null);
    if (!f) {
      onFileSelected(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setLocalError("Only PDF or PNG files are allowed.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setLocalError(`File must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }
    onFileSelected(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    validateAndSet(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
          transition-colors
          ${isDragging
            ? "border-accent bg-orange-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,application/pdf,image/png"
          className="hidden"
          onChange={(e) => validateAndSet(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-black">📄 {file.name}</p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB · click to change
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-base font-medium text-gray-700">
              Drag &amp; drop your resume here
            </p>
            <p className="text-sm text-gray-500">
              or <span className="underline">click to browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-3">
              PDF or PNG · Max {MAX_SIZE_MB}MB
            </p>
          </div>
        )}
      </div>
      {localError && <p className="mt-2 text-sm text-red-600">{localError}</p>}
    </div>
  );
}
