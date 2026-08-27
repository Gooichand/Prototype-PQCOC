import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { isPermittedCopyContentType, isPreviewableImageContentType } from "@/lib/permittedFiles";
import { MotionAwareWorkspace } from "../components/MotionAwareWorkspace";
import {
  Activity, Archive, CheckCircle2, ChevronRight, ClipboardCheck, Clock3,
  FileKey2, FileText, Fingerprint, FolderKanban, Gauge,
  Link2, LockKeyhole, Menu, Network, PackageCheck, Plus, RefreshCcw, ScrollText,
  ShieldAlert, ShieldCheck, Sparkles, Upload, XCircle, Image as ImageIcon,
  AlertTriangle, ClipboardList, FlaskConical,
} from "lucide-react";
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const BenchmarkPanel = lazy(() => import("../panels/BenchmarkPanel"));
const ReportsPanel = lazy(() => import("../panels/ReportsPanel"));
const StandardsPanel = lazy(() => import("../panels/StandardsPanel"));
const AcceptancePanel = lazy(() => import("../panels/AcceptancePanel"));

type Panel = "overview" | "evidence" | "timeline" | "verification" | "tamper" | "benchmark" | "reports" | "standards" | "acceptance";

const navItems: Array<{ id: Panel; label: string; icon: typeof Activity; hint: string }> = [
  { id: "overview", label: "Command overview", icon: Activity, hint: "Live integrity posture" },
  { id: "evidence", label: "Evidence vault", icon: Archive, hint: "Acquisition & manifest" },
  { id: "timeline", label: "Custody timeline", icon: Network, hint: "Hash-linked events" },
  { id: "verification", label: "Verification center", icon: ClipboardCheck, hint: "Independent checks" },
  { id: "tamper", label: "Tamper laboratory", icon: FlaskConical, hint: "Synthetic copies only" },
  { id: "benchmark", label: "Benchmark observatory", icon: Gauge, hint: "ECDSA & PQ capability" },
  { id: "reports", label: "Report center", icon: ScrollText, hint: "Audit exports" },
  { id: "standards", label: "Standards & settings", icon: FileKey2, hint: "Methods disclosure" },
  { id: "acceptance", label: "Acceptance tests", icon: ClipboardList, hint: "E2E validation" },
];

function formatUtc(value?: number | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function shortHash(value?: string | null, length = 13) {
  return value ? `${value.slice(0, length)}…${value.slice(-5)}` : "GENESIS";
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className = normalized === "pass" || normalized === "verified" || normalized === "available"
    ? "pill pill-good" : normalized === "unavailable" || normalized === "review" || normalized === "active"
      ? "pill pill-warn" : "pill pill-bad";
  return <span className={className}>{status.replaceAll("-", " ")}</span>;
}

function MetricCard({ label, value, note, icon: Icon, tone = "crimson" }: { label: string; value: string | number; note: string; icon: typeof Activity; tone?: "crimson" | "charcoal" | "amber" }) {
  return (
    <section className={`metric-card metric-${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-note">{note}</p>
      </div>
    </section>
  );
}

function PanelLoader() {
  return <div className="loading-sheet"><RefreshCcw className="spin" size={21} /> Loading panel…</div>;
}

export default function Home() {
  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [caseTitle, setCaseTitle] = useState("SYN-26-001 · Research Intake");
  const [caseDescription, setCaseDescription] = useState("Generated training case for testing post-quantum chain-of-custody workflows with synthetic artifacts only.");
  const [handoverLocation, setHandoverLocation] = useState("Evidence Control · Bay 02");
  const [handoverReason, setHandoverReason] = useState("Independent verification review and controlled custody acknowledgement.");
  const [recipientId, setRecipientId] = useState("inv_custodian_noah");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [tamperResult, setTamperResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingImagePreview, setPendingImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const permittedFileInput = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const dashboard = trpc.forensic.dashboard.useQuery();
  const capability = trpc.forensic.capability.useQuery();
  const cases = trpc.forensic.cases.useQuery();
  const investigators = trpc.forensic.investigators.useQuery();
  const evidenceInput = useMemo(() => activeCaseId ? { caseId: activeCaseId } : undefined, [activeCaseId]);
  const evidence = trpc.forensic.evidence.useQuery(evidenceInput);
  const benchmarks = trpc.forensic.benchmarks.useQuery();
  const timelineInput = useMemo(() => ({ evidenceId: selectedEvidenceId ?? "" }), [selectedEvidenceId]);
  const timeline = trpc.forensic.timeline.useQuery(timelineInput, { enabled: Boolean(selectedEvidenceId) });

  const refreshForensic = async () => {
    await Promise.all([
      utils.forensic.dashboard.invalidate(), utils.forensic.cases.invalidate(), utils.forensic.evidence.invalidate(),
      utils.forensic.timeline.invalidate(), utils.forensic.benchmarks.invalidate(),
    ]);
  };

  const acquire = trpc.forensic.acquireDemo.useMutation({
    onSuccess: async (item) => { setSelectedEvidenceId(item?.id ?? null); await refreshForensic(); toast.success("Generated artifact acquired and signed."); },
    onError: (error) => toast.error(error.message),
  });
  const createCase = trpc.forensic.createDemoCase.useMutation({
    onSuccess: async (caseRecord) => {
      setActiveCaseId(caseRecord?.id ?? null);
      setSelectedEvidenceId(null);
      await refreshForensic();
      toast.success("Synthetic training case created. Add an artifact when ready.");
    },
    onError: (error) => toast.error(error.message),
  });
  const handover = trpc.forensic.handover.useMutation({
    onSuccess: async () => { await refreshForensic(); toast.success("Signed custody event appended to the ledger."); },
    onError: (error) => toast.error(error.message),
  });
  const verify = trpc.forensic.verify.useMutation({
    onSuccess: async (result) => { setVerificationResult(result); await refreshForensic(); toast.success(`Verification ${result.overallStatus}.`); },
    onError: (error) => toast.error(error.message),
  });
  const tamper = trpc.forensic.tamper.useMutation({
    onSuccess: async (result) => { setTamperResult(result); await refreshForensic(); toast.warning("Controlled synthetic tamper check completed."); },
    onError: (error) => toast.error(error.message),
  });
  const resetTamper = trpc.forensic.resetTamper.useMutation({
    onSuccess: async () => { setTamperResult(null); await refreshForensic(); toast.success("Original synthetic reference restored for verification."); },
    onError: (error) => toast.error(error.message),
  });
  const uploadCopy = trpc.forensic.registerLocalCopy.useMutation({
    onSuccess: async (item) => {
      setSelectedEvidenceId(item?.id ?? null);
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview.url);
      setPendingImagePreview(null);
      await refreshForensic();
      toast.success("Permitted local copy registered and signed.");
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setUploading(false),
  });
  const resetPresentation = trpc.forensic.resetPresentationDemo.useMutation({
    onSuccess: async (result) => {
      setVerificationResult(null);
      setTamperResult(null);
      setShowResetConfirm(false);
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview.url);
      setPendingImagePreview(null);
      await refreshForensic();
      if (result.caseRecord) setActiveCaseId(result.caseRecord.id);
      if (result.evidence?.[0]) setSelectedEvidenceId(result.evidence[0].id);
      toast.success(result.message);
    },
    onError: (error) => { setShowResetConfirm(false); toast.error(error.message); },
  });

  useEffect(() => {
    if (!activeCaseId && cases.data?.[0]) setActiveCaseId(cases.data[0].id);
  }, [activeCaseId, cases.data]);

  useEffect(() => {
    if (!selectedEvidenceId && evidence.data?.[0]) setSelectedEvidenceId(evidence.data[0].id);
  }, [evidence.data, selectedEvidenceId]);

  useEffect(() => () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview.url);
  }, [pendingImagePreview]);

  useEffect(() => {
    const persistentInput = document.getElementById("persistent-permitted-file-input") as HTMLInputElement | null;
    if (persistentInput) permittedFileInput.current = persistentInput;
  }, [activePanel]);

  const selectedEvidence = evidence.data?.find((item) => item.id === selectedEvidenceId) ?? evidence.data?.[0];
  const activeCase = cases.data?.find((item) => item.id === activeCaseId) ?? cases.data?.[0];
  const loading = dashboard.isLoading || evidence.isLoading;
  const pq = capability.data;

  const handleFile = (file?: File) => {
    if (!file || !activeCase) return;
    if (!isPermittedCopyContentType(file.type)) {
      toast.error("Choose a permitted TXT, PDF, JPEG, PNG, WebP, or GIF copy only.");
      return;
    }
    if (file.size > 2_000_000) { toast.error("For this research demo, select a non-sensitive copy under 2 MB."); return; }
    if (isPreviewableImageContentType(file.type)) {
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview.url);
      setPendingImagePreview({ url: URL.createObjectURL(file), name: file.name });
    }
    const reader = new FileReader();
    setUploading(true);
    reader.onload = () => {
      const source = String(reader.result).split(",")[1] ?? "";
      uploadCopy.mutate({ caseId: activeCase.id, originalName: file.name, contentType: file.type || "application/octet-stream", base64Data: source, location: "User-selected permitted local copy" });
    };
    reader.onerror = () => { setUploading(false); toast.error("The selected local copy could not be read."); };
    reader.readAsDataURL(file);
  };

  const panelTitle = navItems.find((item) => item.id === activePanel)?.label ?? "Command overview";

  const MLDSA_DISCLOSURE = "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

  function formatTs(ts?: number) { return ts ? new Date(ts).toLocaleTimeString() : ""; }

  return (
    <MotionAwareWorkspace>
      <aside className={`vault-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
        <div className="brand-block">
          <div className="brand-mark"><Fingerprint size={24} /></div>
          <div><p className="brand-name">PQ-ForensicVault</p><p className="brand-subtitle">CHAIN OF CUSTODY</p></div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-label">FORENSIC WORKSPACE</div>
        <nav className="nav-stack">
          {navItems.map(({ id, label, icon: Icon, hint }) => (
            <button key={id} className={`nav-item ${activePanel === id ? "active" : ""}`} onClick={() => { setActivePanel(id); setMenuOpen(false); }}>
              <Icon size={18} /><span><b>{label}</b><small>{hint}</small></span>{activePanel === id && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><ShieldCheck size={17} /><span><b>Training-safe mode</b><br />Synthetic data and permitted copies only.</span></div>
      </aside>

      <section className="vault-content">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>WORKSPACE</span><ChevronRight size={15} /><b>{panelTitle.toUpperCase()}</b></div>
          <div className="topbar-actions"><span className="live-dot">LOCAL DEMO</span><StatusPill status={pq?.status ?? "checking"} /></div>
        </header>

        <div className="drafting-corner corner-a" /><div className="drafting-corner corner-b" />
        <div className="content-wrap">
          <input id="persistent-permitted-file-input" className="sr-only-file-input" type="file" accept="text/plain,application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleFile(event.target.files?.[0])} disabled={uploading || !activeCase} aria-label="Choose a permitted local file or image copy" />
          <section className="hero-row">
            <div><p className="eyebrow"><Sparkles size={15} /> POST-QUANTUM RESEARCH PROTOTYPE</p><h1>{activePanel === "overview" ? "Evidence integrity, visibly traceable." : panelTitle}</h1><p className="hero-copy">A presentation-ready workspace for technical integrity demonstrations. Every custody record is hash-linked and ECDSA-signed; ML-DSA capability is disclosed exactly as the server reports it.</p></div>
            <div className="case-chip"><FolderKanban size={18} /><span><small>ACTIVE CASE</small><b>{activeCase?.title ?? "Loading synthetic case…"}</b></span></div>
          </section>

          {loading && <div className="loading-sheet"><RefreshCcw className="spin" size={21} /> Preparing the synthetic case ledger…</div>}

          {!loading && activePanel === "overview" && <>
            <div className="metric-grid">
              <MetricCard label="Evidence artifacts" value={dashboard.data?.evidenceCount ?? 0} note="Object-storage references, not database blobs" icon={PackageCheck} />
              <MetricCard label="Integrity posture" value={`${dashboard.data?.verifiedCount ?? 0} verified`} note={`${dashboard.data?.reviewCount ?? 0} require review or demonstrate tampering`} icon={ShieldCheck} tone="charcoal" />
              <MetricCard label="Custody signatures" value="ECDSA P-256" note="Real server-side baseline signing and verification" icon={LockKeyhole} tone="amber" />
              <MetricCard label="PQ signature mode" value={pq?.status ?? "checking"} note="ML-DSA never falls back silently" icon={FileKey2} />
            </div>

            <div className="overview-grid">
              <section className="sketch-card featured-card"><div className="card-kicker">01 / ACQUIRE</div><h2>Generate a clean, signed training artifact.</h2><p>Creates a new synthetic text artifact in object storage, calculates SHA-256 and SHA3-256, writes a canonical manifest, and appends a real ECDSA-signed acquisition event.</p><div className="action-row"><Button className="crimson-button" onClick={() => activeCase && acquire.mutate({ caseId: activeCase.id })} disabled={acquire.isPending || !activeCase}><Plus size={17} />{acquire.isPending ? "Acquiring…" : "Acquire demo artifact"}</Button><button type="button" className="file-button" onClick={() => permittedFileInput.current?.click()} disabled={uploading || !activeCase} aria-describedby="permitted-copy-safety-note"><Upload size={16} />{uploading ? "Registering…" : "Register permitted file / image"}</button><input ref={permittedFileInput} className="sr-only-file-input" type="file" accept="text/plain,application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleFile(event.target.files?.[0])} disabled={uploading || !activeCase} aria-label="Choose a permitted local file or image copy" /></div><p id="permitted-copy-safety-note" className="micro-note">Upload only a permitted non-sensitive copy: TXT, PDF, JPEG, PNG, WebP, or GIF under 2 MB. Never upload seized, personal, confidential, or unauthorized data.</p></section>
              <section className="sketch-card alert-card"><div className="card-kicker">CAPABILITY DISCLOSURE</div><div className="capability-title">{pq?.status === "available" ? <CheckCircle2 /> : <ShieldAlert />}<h2>ML-DSA-65 / FIPS 204</h2></div><StatusPill status={pq?.status ?? "checking"} /><p>{pq?.detail ?? "Checking the server runtime."}</p><div className="method-note"><b>Always active:</b> ECDSA-P256 provides the functional classical baseline. <b>Never simulated:</b> PQ labels appear only after a native server capability check.</div></section>
            </div>

            <section className="sketch-card case-ledger"><div className="section-heading"><div><span className="card-kicker">RECENTLY REGISTERED</span><h2>Evidence vault ledger</h2></div><button className="text-button" onClick={() => setActivePanel("evidence")}>Open vault <ChevronRight size={16} /></button></div><div className="compact-table"><div className="table-head"><span>Artifact</span><span>Digest / status</span><span>Acquired</span></div>{evidence.data?.slice(0, 4).map((item) => <button key={item.id} className="table-row" onClick={() => { setSelectedEvidenceId(item.id); setActivePanel("verification"); }}><span><b>{item.originalName}</b><small>{item.id}</small></span><span><code>{shortHash(item.sha3_256)}</code><StatusPill status={item.status} /></span><span>{formatUtc(item.acquiredAt)}</span></button>)}</div></section>
          </>}

          {!loading && activePanel === "evidence" && <section className="stacked-layout"><section className="sketch-card case-control-card"><div className="section-heading"><div><span className="card-kicker">SYNTHETIC CASE REGISTER</span><h2>Select or create a research case</h2></div><StatusPill status={`${cases.data?.length ?? 0} cases`} /></div><p className="section-intro">Cases created here are explicitly labelled as synthetic demonstrations. Use only generated training artifacts or permitted non-sensitive copies.</p><div className="form-grid"><label>Active case<select value={activeCaseId ?? ""} onChange={(event) => { setActiveCaseId(event.target.value); setSelectedEvidenceId(null); setVerificationResult(null); setTamperResult(null); }}>{cases.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>New case title<input value={caseTitle} onChange={(event) => setCaseTitle(event.target.value)} maxLength={255} /></label><label className="full-span">Synthetic-case training note<textarea value={caseDescription} onChange={(event) => setCaseDescription(event.target.value)} maxLength={1500} /></label></div><div className="action-row"><Button className="crimson-button" disabled={createCase.isPending || caseTitle.trim().length < 4 || caseDescription.trim().length < 12} onClick={() => createCase.mutate({ title: caseTitle, description: caseDescription })}><Plus size={17} />{createCase.isPending ? "Creating synthetic case…" : "Create synthetic case"}</Button><Button variant="outline" disabled={!activeCase || acquire.isPending} onClick={() => activeCase && acquire.mutate({ caseId: activeCase.id })}><PackageCheck size={17} />{acquire.isPending ? "Acquiring…" : "Add training artifact to active case"}</Button><button type="button" className="file-button" onClick={() => permittedFileInput.current?.click()} disabled={uploading || !activeCase} aria-describedby="vault-image-safety-note"><ImageIcon size={16} />{uploading ? "Registering…" : "Add permitted image / file"}</button></div><p id="vault-image-safety-note" className="micro-note">Images supported: JPEG, PNG, WebP, and GIF. All files are capped at 2 MB and must be permitted non-sensitive copies.</p>{pendingImagePreview && <figure className="local-image-preview"><img src={pendingImagePreview.url} alt={`Local preview of ${pendingImagePreview.name}`} /><figcaption>Local preview only — the selected image is registered as immutable evidence bytes only after you complete the upload.</figcaption></figure>}</section><section className="sketch-card"><div className="section-heading"><div><span className="card-kicker">IMMUTABLE REFERENCES</span><h2>Evidence vault</h2></div><Button className="crimson-button" disabled={!activeCase || acquire.isPending} onClick={() => activeCase && acquire.mutate({ caseId: activeCase.id })}><Plus size={17} /> New synthetic acquisition</Button></div><p className="section-intro">Artifact bytes are held outside the database. The ledger stores identifiers, manifest metadata, two hashes, and immutable object-storage references.</p><div className="evidence-grid">{evidence.data?.map((item) => <button key={item.id} className={`evidence-card ${selectedEvidenceId === item.id ? "selected" : ""}`} onClick={() => setSelectedEvidenceId(item.id)}><div>{isPreviewableImageContentType(item.contentType) ? <ImageIcon size={22} /> : <FileText size={22} />}<StatusPill status={item.status} /></div><h3>{item.originalName}</h3><p>{item.contentType} · {item.byteSize.toLocaleString()} bytes</p><code>{shortHash(item.sha256, 15)}</code><small>Acquired {formatUtc(item.acquiredAt)}</small></button>)}</div>{!evidence.data?.length && <p className="empty-state">No evidence is registered for this synthetic case. Add a generated training artifact or permitted image above to begin its custody ledger.</p>}</section>{selectedEvidence && <section className="sketch-card manifest-card"><div className="card-kicker">SELECTED MANIFEST</div><h2>{selectedEvidence.originalName}</h2>{isPreviewableImageContentType(selectedEvidence.contentType) && <figure className="stored-image-preview"><img src={selectedEvidence.storageUrl} alt={`Stored permitted evidence preview: ${selectedEvidence.originalName}`} loading="lazy" /><figcaption>Stored image preview from the immutable object-storage reference. Visual review does not replace independent hash and signature verification.</figcaption></figure>}<div className="hash-list"><div><span>SHA-256</span><code>{selectedEvidence.sha256}</code></div><div><span>SHA3-256</span><code>{selectedEvidence.sha3_256}</code></div><div><span>Storage reference</span><code>{selectedEvidence.storageKey}</code></div><div><span>Acquisition location</span><b>{selectedEvidence.acquisitionLocation}</b></div></div></section>}</section>}

          {!loading && activePanel === "timeline" && <section className="stacked-layout"><section className="sketch-card"><div className="section-heading"><div><span className="card-kicker">SIGNED EVENT LEDGER</span><h2>Custody timeline</h2></div><StatusPill status={`${timeline.data?.length ?? 0} events`} /></div><p className="section-intro">Each event contains who, what, when, where, why, transfer status, its prior-event hash, and an ECDSA signature over a canonical payload.</p><div className="timeline">{timeline.data?.map((event) => <article key={event.id} className="timeline-event"><div className="timeline-node"><Clock3 size={15} /></div><div className="event-card"><div className="event-top"><span>#{String(event.sequenceNumber).padStart(2, "0")}</span><StatusPill status={event.transferStatus} /></div><h3>{event.action}</h3><p>{event.rationale}</p><div className="event-meta"><span><b>Actor:</b> {event.actorId}</span><span><b>Where:</b> {event.location}</span><span><b>When:</b> {formatUtc(event.happenedAt)}</span></div><div className="link-proof"><Link2 size={14} /><code>prev {shortHash(event.previousEventHash)} → record {shortHash(event.eventRecordHash)}</code></div></div></article>)}</div></section>
            <section className="sketch-card handover-card"><div className="card-kicker">02 / HANDOVER</div><h2>Append an investigator handover</h2><div className="form-grid"><label>Receiving investigator<select value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>{investigators.data?.filter((person) => person.id !== "inv_analyst_aria").map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.role}</option>)}</select></label><label>Transfer location<input value={handoverLocation} onChange={(event) => setHandoverLocation(event.target.value)} /></label><label className="full-span">Reason / purpose<textarea value={handoverReason} onChange={(event) => setHandoverReason(event.target.value)} /></label></div><Button className="crimson-button" disabled={!selectedEvidence || handover.isPending} onClick={() => selectedEvidence && handover.mutate({ evidenceId: selectedEvidence.id, recipientId, location: handoverLocation, reason: handoverReason })}><LockKeyhole size={17} />{handover.isPending ? "Signing handover…" : "Sign & append handover"}</Button></section></section>}

          {!loading && activePanel === "verification" && <section className="stacked-layout"><section className="verification-hero sketch-card"><div><span className="card-kicker">INDEPENDENT RE-CHECK</span><h2>Verify the selected evidence record.</h2><p>The verifier reads the referenced object, recalculates SHA-256 and SHA3-256, then checks every canonical event hash, chain link, and ECDSA signature against each stored public key.</p></div><div><Button className="crimson-button" disabled={!selectedEvidence || verify.isPending} onClick={() => selectedEvidence && verify.mutate({ evidenceId: selectedEvidence.id })}><ClipboardCheck size={18} />{verify.isPending ? "Verifying…" : "Run independent verification"}</Button><p className="micro-note">The result is recorded as a verification run; it is not a legal-admissibility conclusion.</p></div></section>{verificationResult && <section className={`verification-result ${verificationResult.overallStatus === "pass" ? "pass" : "fail"}`}><div>{verificationResult.overallStatus === "pass" ? <CheckCircle2 /> : <XCircle />}<div><p className="card-kicker">LATEST RESULT</p><h2>{verificationResult.overallStatus === "pass" ? "All requested integrity checks passed" : "Integrity mismatch detected"}</h2></div></div><div className="check-grid"><span>SHA-256 <b>{verificationResult.findings.artifact.sha256Match ? "MATCH" : "MISMATCH"}</b></span><span>SHA3-256 <b>{verificationResult.findings.artifact.sha3_256Match ? "MATCH" : "MISMATCH"}</b></span><span>Event records <b>{verificationResult.findings.eventHashes.passed ? "VALID" : "ALTERED"}</b> ({verificationResult.findings.eventHashes.validHashes ?? 0}/{verificationResult.findings.eventHashes.totalEvents ?? 0})</span><span>Signatures <b>{verificationResult.findings.signatures.passed ? "VALID" : "INVALID"}</b> ({verificationResult.findings.signatures.validSignatures ?? 0}/{verificationResult.findings.signatures.totalEvents ?? 0})</span><span>Chain continuity <b>{verificationResult.findings.continuity.passed ? "INTACT" : "BROKEN"}</b> ({verificationResult.findings.continuity.eventCount ?? 0} events)</span></div></section>}</section>}

          {!loading && activePanel === "tamper" && <section className="stacked-layout"><section className="tamper-banner"><ShieldAlert size={25} /><div><b>Demo-only laboratory</b><p>These controls are restricted by the server to the explicit synthetic demonstration case. They never edit the original object or stored custody ledger.</p></div></section><section className="sketch-card"><div className="section-heading"><div><span className="card-kicker">CONTROLLED FAILURE DEMONSTRATION</span><h2>Run an intentional mismatch</h2></div><StatusPill status="synthetic only" /></div><div className="tamper-options"><button onClick={() => selectedEvidence && tamper.mutate({ evidenceId: selectedEvidence.id, scenario: "artifact-copy" })} disabled={!selectedEvidence || tamper.isPending}><FileText /><b>Altered artifact copy</b><span>Creates a separately stored synthetic copy with altered bytes, then shows hash failure.</span></button><button onClick={() => selectedEvidence && tamper.mutate({ evidenceId: selectedEvidence.id, scenario: "ledger-copy" })} disabled={!selectedEvidence || tamper.isPending}><Network /><b>Altered ledger copy</b><span>Changes an in-memory synthetic event copy, then demonstrates signature and record-hash failure.</span></button></div><div className="action-row"><Button variant="outline" onClick={() => selectedEvidence && resetTamper.mutate({ evidenceId: selectedEvidence.id })} disabled={!selectedEvidence || resetTamper.isPending}><RefreshCcw size={16} /> Reset safe demo state</Button></div></section>{tamperResult && <section className={`verification-result ${tamperResult.overallStatus === "fail" ? "fail" : "pass"}`}><div><XCircle /><div><p className="card-kicker">EXPECTED VALIDATION OUTCOME</p><h2>{tamperResult.overallStatus === "fail" ? "Tamper was detected" : "No mismatch found"}</h2></div></div><p>{tamperResult.scenario}</p><div className="check-grid"><span>SHA-256 <b>{tamperResult.findings.artifact.sha256Match ? "MATCH" : "MISMATCH"}</b></span><span>Event records <b>{tamperResult.findings.eventHashes.passed ? "VALID" : "ALTERED"}</b></span><span>Signatures <b>{tamperResult.findings.signatures.passed ? "VALID" : "INVALID"}</b></span><span>Chain continuity <b>{tamperResult.findings.continuity.passed ? "INTACT" : "BROKEN"}</b></span></div></section>}</section>}

          {!loading && activePanel === "benchmark" && (
            <Suspense fallback={<PanelLoader />}>
              <BenchmarkPanel />
            </Suspense>
          )}

          {!loading && activePanel === "reports" && (
            <Suspense fallback={<PanelLoader />}>
              <ReportsPanel selectedEvidenceId={selectedEvidenceId} />
            </Suspense>
          )}

          {!loading && activePanel === "standards" && (
            <Suspense fallback={<PanelLoader />}>
              <StandardsPanel onResetDemo={() => setShowResetConfirm(true)} resetPending={resetPresentation.isPending} />
            </Suspense>
          )}

          {!loading && activePanel === "acceptance" && (
            <Suspense fallback={<PanelLoader />}>
              <AcceptancePanel />
            </Suspense>
          )}
        </div>
      </section>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="Confirm presentation demo reset">
          <div className="sketch-card" style={{ maxWidth: "480px", width: "90%" }}>
            <div className="section-heading"><div><span className="card-kicker"><AlertTriangle size={14} /> CONFIRM RESET</span><h2>Reset presentation demo?</h2></div></div>
            <p style={{ fontSize: "13px", color: "#655147", lineHeight: "1.7", marginBottom: "18px" }}>
              This will remove all synthetic demo records, evidence, custody events, verification runs, and benchmarks.
              A single predictable synthetic case and training artifact will be recreated.
              <b> Authorised user evidence will not be affected.</b>
            </p>
            <div className="action-row">
              <Button className="crimson-button" onClick={() => resetPresentation.mutate()} disabled={resetPresentation.isPending}>
                {resetPresentation.isPending ? "Resetting…" : "Confirm reset"}
              </Button>
              <Button variant="outline" onClick={() => setShowResetConfirm(false)} disabled={resetPresentation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </MotionAwareWorkspace>
  );
}
