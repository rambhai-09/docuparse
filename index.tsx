// pages/index.tsx
import React, { useCallback, useState, useRef } from "react";

type Field = {
  key: string;
  value: string;
  confidence?: number; // 0..1
};

type ExtractionResult = {
  text?: string;
  fields?: Field[];
  raw?: any;
};

export default function HomePage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const backendUploadUrl = "http://localhost:8000/upload"; // change to your backend

  const onFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setFileName(file.name);
      setUploading(true);
      setProgress(0);

      try {
        const form = new FormData();
        form.append("file", file);

        // Use fetch with XHR-like progress via XMLHttpRequest
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", backendUploadUrl, true);

          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const p = Math.round((ev.loaded / ev.total) * 100);
              setProgress(p);
            }
          };

          xhr.onload = () => {
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const json = JSON.parse(xhr.responseText);
                // Expect backend to return { text, fields: [{key,value,confidence}], raw }
                const parsed: ExtractionResult = {
                  text: json.text ?? "",
                  fields: (json.fields ?? []).map((f: any) => ({
                    key: f.key,
                    value: f.value,
                    confidence:
                      typeof f.confidence === "number" ? f.confidence : undefined,
                  })),
                  raw: json,
                };
                setResult(parsed);
                setProgress(100);
                resolve();
              } else {
                reject(
                  new Error(
                    `Upload failed with status ${xhr.status}: ${xhr.statusText}`
                  )
                );
              }
            } catch (err) {
              reject(err);
            }
          };

          xhr.onerror = () => {
            reject(new Error("Network error during file upload"));
          };

          xhr.send(form);
        });
      } catch (err: any) {
        setError(err?.message ?? "Unknown error");
      } finally {
        setUploading(false);
      }
    },
    [backendUploadUrl]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const handleDownloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.raw ?? result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName ?? "result"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!result) return;
    const rows = [["key", "value", "confidence"]];
    (result.fields ?? []).forEach((f) =>
      rows.push([f.key, f.value, f.confidence?.toString() ?? ""])
    );
    const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName ?? "result"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function escapeCSV(v: string) {
    if (v == null) return "";
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  const updateFieldValue = (index: number, newValue: string) => {
    setResult((r) => {
      if (!r) return r;
      const fields = [...(r.fields ?? [])];
      fields[index] = { ...fields[index], value: newValue };
      return { ...r, fields };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-900">
            AI Document Processor — Front Page
          </h1>
          <p className="text-slate-600 mt-1">
            Upload a PDF/image and view extracted text & structured fields.
          </p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Card */}
          <section className="bg-white rounded-lg shadow p-5">
            <h2 className="text-xl font-medium mb-3">Upload Document</h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-200 rounded-md p-6 text-center cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx"
                className="hidden"
                onChange={handleInputChange}
              />
              <div className="text-slate-600">
                <p className="mb-2">Drag & drop a file here, or click to select</p>
                <p className="text-sm">Supported: PDF, PNG, JPG, JPEG, DOCX</p>
              </div>
            </div>

            <div className="mt-4">
              {fileName && (
                <div className="text-sm text-slate-700">Selected: {fileName}</div>
              )}

              {uploading && (
                <div className="mt-3">
                  <div className="h-3 w-full bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-3 bg-emerald-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Uploading... {progress}%
                  </div>
                </div>
              )}

              {!uploading && result && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                    onClick={handleDownloadJSON}
                  >
                    Download JSON
                  </button>
                  <button
                    className="px-3 py-1 bg-sky-600 text-white rounded text-sm"
                    onClick={handleDownloadCSV}
                  >
                    Download CSV
                  </button>
                </div>
              )}
            </div>

            {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
          </section>

          {/* Results Card */}
          <section className="bg-white rounded-lg shadow p-5">
            <h2 className="text-xl font-medium mb-3">Extraction Results</h2>

            {!result && (
              <div className="text-slate-500">
                No results yet. Upload a document to see extracted text & fields.
              </div>
            )}

            {result && (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Extracted Text
                  </h3>
                  <div className="mt-2 p-3 bg-slate-50 rounded text-sm text-slate-800 max-h-40 overflow-auto whitespace-pre-wrap">
                    {result.text || "—"}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-700">
                    Structured Fields
                  </h3>
                  <div className="mt-2 space-y-2">
                    {(result.fields ?? []).length === 0 && (
                      <div className="text-slate-500 text-sm">No fields found.</div>
                    )}

                    {(result.fields ?? []).map((f, i) => {
                      const conf = typeof f.confidence === "number" ? f.confidence : 1;
                      const confPct = Math.round(conf * 100);
                      const low = conf < 0.6;
                      return (
                        <div
                          key={f.key + i}
                          className="flex items-center gap-3 p-2 border rounded"
                        >
                          <div className="w-36 text-sm text-slate-700 font-medium">
                            {f.key}
                          </div>
                          <input
                            className="flex-1 p-2 border rounded text-sm"
                            value={f.value}
                            onChange={(e) => updateFieldValue(i, e.target.value)}
                          />
                          <div
                            title={`Confidence ${confPct}%`}
                            className={`ml-2 px-2 py-1 text-xs rounded-full ${
                              low ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                            }`}
                          >
                            {confPct}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  Tip: low confidence fields (below 60%) are highlighted in red —
                  please verify.
                </div>
              </>
            )}
          </section>

          {/* Full Raw JSON preview */}
          <section className="col-span-1 md:col-span-2 bg-white rounded-lg shadow p-5">
            <h3 className="text-lg font-medium mb-2">Raw Response (JSON)</h3>
            <div className="bg-slate-50 p-3 rounded max-h-56 overflow-auto text-sm">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(result?.raw ?? result ?? { status: "no data" }, null, 2)}
              </pre>
            </div>
          </section>
        </main>

        <footer className="mt-6 text-sm text-slate-500">
          <div>Backend upload URL: {backendUploadUrl}</div>
          <div className="mt-1">
            Make sure your backend returns JSON: <code>{`{ text, fields: [{key,value,confidence}], raw }`}</code>
          </div>
        </footer>
      </div>
    </div>
  );
}
