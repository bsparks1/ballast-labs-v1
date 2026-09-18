"use client";

import { useRef, useState } from "react";

export type RepoIngestValues = {
  url: string;
  subdir: string;
  files: File[];
};

export function RepoIngestFields({
  values,
  onChange,
  disabled,
}: {
  values: RepoIngestValues;
  onChange: (next: RepoIngestValues) => void;
  disabled?: boolean;
}) {
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);

  function setFiles(list: FileList | null, label: string) {
    const files = list ? [...list] : [];
    setFileLabel(files.length > 0 ? `${label} (${files.length} file${files.length === 1 ? "" : "s"})` : null);
    onChange({ ...values, files });
  }

  return (
    <div className="space-y-3">
      <label htmlFor="repo-url" className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
        Public GitHub URL
      </label>
      <input
        id="repo-url"
        className="w-full rounded-sm border border-edge bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        placeholder="https://github.com/owner/repo or owner/repo/tree/main/backend"
        value={values.url}
        onChange={(e) => onChange({ ...values, url: e.target.value })}
        disabled={disabled}
      />
      <label htmlFor="repo-subdir" className="block font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
        Agent subdirectory <span className="font-normal normal-case tracking-normal text-faint">(optional)</span>
      </label>
      <input
        id="repo-subdir"
        className="w-full rounded-sm border border-edge bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        placeholder="backend or src/agent"
        value={values.subdir}
        onChange={(e) => onChange({ ...values, subdir: e.target.value })}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground disabled:opacity-40"
          disabled={disabled}
          onClick={() => zipRef.current?.click()}
        >
          Upload zip
        </button>
        <button
          type="button"
          className="rounded-sm border border-edge px-3 py-1.5 text-xs text-muted hover:border-edge-strong hover:text-foreground disabled:opacity-40"
          disabled={disabled}
          onClick={() => folderRef.current?.click()}
        >
          Upload folder
        </button>
        {fileLabel && <span className="text-[11px] text-faint">{fileLabel}</span>}
        <input
          ref={zipRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => setFiles(e.target.files, "zip")}
        />
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          multiple
          // @ts-expect-error webkitdirectory is not in React's types
          webkitdirectory=""
          onChange={(e) => setFiles(e.target.files, "folder")}
        />
      </div>
      <p className="text-[11px] text-faint">
        Public repos only. Private GitHub access is not in this build — upload the agent directory instead.
      </p>
    </div>
  );
}

export function appendRepoFormData(form: FormData, values: RepoIngestValues) {
  if (values.url.trim()) form.set("url", values.url.trim());
  if (values.subdir.trim()) form.set("subdir", values.subdir.trim());
  for (const file of values.files) {
    const path = file.webkitRelativePath || file.name;
    form.append("files", file, path);
  }
}
