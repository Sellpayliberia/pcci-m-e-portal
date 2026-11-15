import React, { useEffect, useState } from "react";
import { api } from "./lib";
import { targets, demoLocations } from "./data";
import { Button } from "./components/ui/button";

const next: Record<string, string[]> = {
  Draft: ["Submitted"], Returned: ["Submitted"], Submitted: ["City Verified", "Returned"],
  "City Verified": ["Admin Approved", "Returned"], "Admin Approved": [],
};
export function Training({ user, onLogin }: any) {
  const [workspace, setWorkspace] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const load = async () => {
    setBusy(true); setError("");
    try { setWorkspace(await api("/training")); setEdit(null); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { setWorkspace(null); setEdit(null); if (user) void load(); }, [user?.id]);
  const mutate = async (path: string, body: any, method = "POST") => {
    setBusy(true); setError(""); setMessage("");
    try {
      setWorkspace(await api("/training/" + path, method, { ...body, version: workspace.version }));
      setEdit(null); setReset(false); setMessage("Practice workspace saved.");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const cities = demoLocations.filter(l => l.type === "City");
  const newReport = () => {
    setEdit({ id: crypto.randomUUID(), team: "", county: cities[0].county, city: cities[0].city,
      periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10),
      notes: "", metrics: Object.fromEntries(targets.map(t => [t.key, 0])) });
    setMessage(""); setError("");
  };
  return <section className="training">
    <div className="training-banner">
      <div><span className="eyebrow">TRAINING WORKSPACE</span><h2>Practice. Review. Start again.</h2>
      <p>Create and update demo reports, then practise submission, verification and approval. Your exercises are private to your account and excluded from official dashboards, maps, exports and weekly summaries.</p></div>
      <span className="badge">Practice data only</span>
    </div>
    {!user ? <div className="panel training-panel"><h3>Sign in to start training</h3><p>Your practice reports are saved separately from operational reports.</p><Button onClick={onLogin}>Sign in</Button></div> : <>
      <div className="panel training-panel">
        <h3>A complete reporting exercise</h3>
        <p>1. Open a draft or create a report. 2. Check the location, dates and indicators. 3. Save and submit. 4. Act as verifier and approver, or return it for corrections.</p>
        <p>All review roles are simulated here. Official permissions and report signatures remain in the operational workspace.</p>
        <div className="training-actions"><Button disabled={busy || !workspace} onClick={newReport}>Create practice report</Button>
        <Button variant="outline" disabled={busy} onClick={load}>Reload workspace</Button>
        <Button variant="outline" disabled={busy || !workspace} onClick={() => setReset(true)}>Reset demo data</Button></div>
      </div>
      {error && <p role="alert" className="training-error">{error} Use Reload workspace if another tab changed these records; unsaved edits are discarded on reload.</p>}
      {message && <p role="status">{message}</p>}
      {!workspace && !error && <p role="status">Loading your training workspace…</p>}
      {reset && <div className="panel training-panel" role="alert"><h3>Replace your practice reports?</h3><p>This removes your training edits and restores eight demo reports. Official records are unaffected.</p><div className="training-actions"><Button disabled={busy} onClick={() => mutate("reset", {})}>Restore demo reports</Button><Button variant="outline" disabled={busy} onClick={() => setReset(false)}>Cancel</Button></div></div>}
      {edit && <form className="panel training-panel" onSubmit={e => { e.preventDefault(); void mutate("report", { report: edit }, "PUT"); }}>
        <h3>{edit.number || "New practice report"}</h3>
        <div className="training-fields">
          <label className="field"><span>Team name</span><input required maxLength={150} value={edit.team} onChange={e => setEdit({ ...edit, team: e.target.value })} /></label>
          <label className="field"><span>Training location</span><select value={edit.city} onChange={e => { const l = cities.find(l => l.city === e.target.value)!; setEdit({ ...edit, city: l.city, county: l.county }); }}>{cities.map(l => <option key={l.id} value={String(l.city)}>{l.city} · {l.county}</option>)}</select></label>
          {["periodStart", "periodEnd"].map((key, i) => <label className="field" key={key}><span>{i ? "Period end" : "Period start"}</span><input type="date" required value={edit[key]} onChange={e => setEdit({ ...edit, [key]: e.target.value })} /></label>)}
          {targets.map(t => <label className="field" key={t.key}><span>{t.label} ({t.unit})</span><input required type="number" min="0" max={t.unit === "%" ? 100 : 10000000} step="any" value={edit.metrics[t.key]} onChange={e => setEdit({ ...edit, metrics: { ...edit.metrics, [t.key]: e.target.value === "" ? "" : Number(e.target.value) } })} /></label>)}
        </div>
        <label className="field"><span>Exercise notes / corrections</span><textarea maxLength={3000} value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
        <div className="training-actions"><Button disabled={busy} type="submit">Save practice report</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setEdit(null)}>Cancel</Button></div>
      </form>}
      <div className="training-records">{workspace?.reports.map((r: any) => <article className="panel training-panel" key={r.id}>
        <div className="training-record-heading"><strong>{r.number} · {r.team}</strong><span className="badge">{r.status}</span></div>
        <p>{r.city}, {r.county} · {r.periodStart} to {r.periodEnd}</p>
        <p>{r.metrics.spaces} spaces · {r.metrics.waste} metric tons · {r.metrics.ppe}% PPE compliance</p>
        <p>{r.notes}</p>
        <div className="training-actions">{["Draft", "Returned"].includes(r.status) && <Button variant="outline" disabled={busy} onClick={() => { setEdit(structuredClone(r)); setError(""); }}>Edit practice report</Button>}
        {(next[r.status] || []).map(status => <Button key={status} variant="outline" disabled={busy} onClick={() => mutate("transition", { id: r.id, status })}>{status === "Returned" ? "Return for correction" : "Practise: " + status}</Button>)}</div>
        {r.history.length > 0 && <details><summary>Practice review history ({r.history.length})</summary>{r.history.map((h: any, i: number) => <p key={i}>{h.from} → {h.to} · {new Date(h.at).toLocaleString()}</p>)}</details>}
      </article>)}</div>
    </>}
  </section>;
}
