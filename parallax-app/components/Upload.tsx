"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { parseBhavcopy, ParseResult } from "@/lib/parse";
import { useAuth } from "./AuthProvider";

export function Upload({ serverReady }: { serverReady: boolean }) {
  const { enabled, user, signIn, authed } = useAuth();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [state, setState] = useState<{ busy: boolean; msg: string; ok?: boolean }>({ busy: false, msg: "" });

  const read = async (f: File) => {
    const text = await f.text();
    setFile({ name: f.name, text });
    try {
      setPreview(parseBhavcopy(text));
    } catch {
      setPreview({ date: null, rows: [], totalRows: 0, issues: ["This file could not be read as a bhavcopy."] });
    }
    setState({ busy: false, msg: "" });
  };

  const submit = async () => {
    if (!file) return;
    setState({ busy: true, msg: "Checking and saving…" });
    const res = await authed("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, text: file.text }) });
    const j = await res.json().catch(() => ({ error: "Unexpected response" }));
    setState({ busy: false, ok: res.ok, msg: res.ok ? j.message : j.error });
    if (res.ok) {
      setFile(null);
      setPreview(null);
      router.refresh();
    }
  };

  if (!enabled || !serverReady)
    return <p className="muted">Uploads are saved to the shared database, which has not been connected for this deployment yet. The bundled history above still works in full.</p>;
  if (!user)
    return (
      <p className="muted">
        Sign in to add a bhavcopy that everyone using Parallax will see.{" "}
        <button className="link" onClick={() => signIn()}>
          Sign in with Google
        </button>
      </p>
    );

  return (
    <div>
      <div
        className={`drop ${over ? "over" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) read(f);
        }}
      >
        <div className="h3" style={{ fontWeight: 500 }}>
          {file ? file.name : "Drop a bhavcopy here"}
        </div>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          The CSV or XLS you download from mcxindia.com, one trading day per file.
        </p>
        <input ref={input} type="file" accept=".csv,.xls,.json,.htm,.html,.txt" hidden onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      </div>
      {preview && (
        <div style={{ marginTop: 22 }}>
          {preview.date ? (
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 600 }}>{new Date(preview.date + "T00:00:00Z").toDateString()}</span>
              <span className="muted">
                {" "}
                · {preview.rows.length} gold futures rows found among {preview.totalRows}
              </span>
            </p>
          ) : null}
          {preview.issues.map((m, k) => (
            <p key={k} className="small red" style={{ margin: "6px 0 0" }}>
              {m}
            </p>
          ))}
          {preview.rows.length > 0 && (
            <p style={{ marginTop: 16 }}>
              <button className="link link-lg" onClick={submit} disabled={state.busy}>
                Add this day to Parallax
              </button>
            </p>
          )}
        </div>
      )}
      {state.msg && (
        <p className={`small ${state.ok ? "green" : state.busy ? "muted" : "red"}`} style={{ marginTop: 12 }}>
          {state.msg}
        </p>
      )}
    </div>
  );
}
