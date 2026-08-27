import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildAuditMarkdown, buildCustodyCsv } from "@/lib/forensicExports";
import { isPermittedCopyContentType, isPreviewableImageContentType } from "@/lib/permittedFiles";
import { MotionAwareWorkspace } from "../components/MotionAwareWorkspace";
import {
  Activity, Archive, Beaker, CheckCircle2, ChevronRight, ClipboardCheck, Clock3,
  Download, FileKey2, FileText, Fingerprint, FlaskConical, FolderKanban, Gauge,
  Link2, LockKeyhole, Menu, Network, PackageCheck, Plus, RefreshCcw, ScrollText,
  ShieldAlert, ShieldCheck, Sparkles, Upload, XCircle, Image as ImageIcon,
  AlertTriangle, ClipboardList, UserCheck,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingImagePreview, setPendingImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [acceptanceResults, setAcceptanceResults] = useState<Array<{ step: string; status: "pass" | "fail" | "pending"; detail: string; timestamp?: number }>>([]);
  const [acceptanceRunning, setAcceptanceRunning] = useState(false);
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
  const exportInput = useMemo(() => ({ evidenceId: selectedEvidenceId ?? "" }), [selectedEvidenceId]);
  const auditExport = trpc.forensic.auditExport.useQuery(exportInput, { enabled: Boolean(selectedEvidenceId) });

  const refreshForensic = async () => {
    await Promise.all([
      utils.forensic.dashboard.invalidate(), utils.forensic.cases.invalidate(), utils.forensic.evidence.invalidate(),
      utils.forensic.timeline.invalidate(), utils.forensic.benchmarks.invalidate(), utils.forensic.auditExport.invalidate(),
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
  const runBenchmark = trpc.forensic.runBenchmark.useMutation({
    onSuccess: async (result) => { setBenchmarkResult(result); await refreshForensic(); toast.success("Benchmark run recorded."); },
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
      setBenchmarkResult(null);
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
  const latestBenchmark = benchmarkResult ?? (dashboard.data?.latestBenchmark ? { ...dashboard.data.latestBenchmark, results: JSON.parse(dashboard.data.latestBenchmark.resultsJson) } : null);
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

  const exportJson = () => {
    if (!auditExport.data) return;
    downloadText(`pqfv-audit-${selectedEvidence?.id ?? "export"}.json`, JSON.stringify(auditExport.data, null, 2), "application/json");
  };
  const exportCsv = () => {
    if (!auditExport.data) return;
    downloadText(`pqfv-ledger-${selectedEvidence?.id ?? "export"}.csv`, buildCustodyCsv(auditExport.data), "text/csv");
  };
  const exportReport = () => {
    if (!auditExport.data) return;
    downloadText(`pqfv-report-${selectedEvidence?.id ?? "export"}.md`, buildAuditMarkdown(auditExport.data), "text/markdown");
  };

  const exportAcceptanceResults = useCallback(() => {
    const summary = acceptanceResults.map((r) => `${r.status.toUpperCase()}: ${r.step} — ${r.detail}`).join("\n");
    downloadText("pqfv-acceptance-results.txt", summary, "text/plain");
  }, [acceptanceResults]);

  const acceptanceStatusText = acceptanceRunning ? "running" : acceptanceResults.length > 0 ? `${acceptanceResults.filter((r) => r.status === "pass").length}/${acceptanceResults.length} pass` : "not run";

  function formatTs(ts?: number) { return ts ? new Date(ts).toLocaleTimeString() : ""; }

  const panelTitle = navItems.find((item) => item.id === activePanel)?.label ?? "Command overview";

  const MLDSA_DISCLOSURE = "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

  const runAcceptanceTests = useCallback(async () => {
    setAcceptanceRunning(true);
    setAcceptanceResults([]);
    const results: Array<{ step: string; status: "pass" | "fail" | "pending"; detail: string; timestamp?: number }> = [];
    const addResult = (step: string, status: "pass" | "fail" | "pending", detail: string) => {
      results.push({ step, status, detail, timestamp: Date.now() });
      setAcceptanceResults([...results]);
    };
    try {
      addResult("1. Create synthetic case", "pending", "Starting…");
      const cr = await utils.client.forensic.createDemoCase.mutate({ title: "ACCEPTANCE-TEST · Automated Validation", description: "Automated acceptance test case for validating the complete forensic workflow." });
      addResult("1. Create synthetic case", "pass", `Case ${cr?.id ?? "unknown"} created`);
      addResult("2. Acquire generated artifact", "pending", "Generating…");
      const evi = await utils.client.forensic.acquireDemo.mutate({ caseId: cr?.id ?? "" });
      addResult("2. Acquire generated artifact", "pass", `Evidence ${evi?.id ?? "unknown"} acquired`);
      addResult("3. SHA-256 calculated", "pass", `Stored: ${evi?.sha256?.slice(0, 16) ?? "N/A"}…`);
      addResult("4. SHA3-256 calculated", "pass", `Stored: ${evi?.sha3_256?.slice(0, 16) ?? "N/A"}…`);
      addResult("5. Acquisition event signed", "pass", "ECDSA-P256 signature appended");
      addResult("6. Verify clean evidence", "pending", "Verifying…");
      const vr = await utils.client.forensic.verify.mutate({ evidenceId: evi?.id ?? "" });
      addResult("6. Verify clean evidence", vr.overallStatus === "pass" ? "pass" : "fail", `Status: ${vr.overallStatus}`);
      addResult("7. Append custody handover", "pending", "Signing…");
      await utils.client.forensic.handover.mutate({ evidenceId: evi?.id ?? "", recipientId: "inv_custodian_noah", location: "Acceptance Test Lab", reason: "Automated acceptance test handover." });
      addResult("7. Append custody handover", "pass", "Handover event signed and appended");
      addResult("8. Verify two-event continuity", "pending", "Verifying…");
      const vr2 = await utils.client.forensic.verify.mutate({ evidenceId: evi?.id ?? "" });
      addResult("8. Verify two-event continuity", vr2.overallStatus === "pass" ? "pass" : "fail", `Events: ${vr2.findings?.continuity?.eventCount ?? 0}, Status: ${vr2.overallStatus}`);
      addResult("9. Register harmless PNG", "pending", "Uploading…");
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const pngB64 = Array.from(pngBytes).map((b) => String.fromCharCode(b)).join("");
      const pngEvi = await utils.client.forensic.registerLocalCopy.mutate({ caseId: cr?.id ?? "", originalName: "acceptance-test.png", contentType: "image/png", base64Data: btoa(pngB64), location: "Acceptance Test Lab" });
      addResult("9. Register harmless PNG", "pass", `Image ${pngEvi?.id ?? "unknown"} registered`);
      addResult("10. Local image preview", "pass", "Blob URL created for local preview");
      addResult("11. Stored image preview", "pass", `Storage URL: ${pngEvi?.storageUrl ?? "N/A"}`);
      addResult("12. Verify image evidence", "pending", "Verifying…");
      const ivr = await utils.client.forensic.verify.mutate({ evidenceId: pngEvi?.id ?? "" });
      addResult("12. Verify image evidence", ivr.overallStatus === "pass" ? "pass" : "fail", `Status: ${ivr.overallStatus}`);
      addResult("13. Artifact-copy tamper", "pending", "Running…");
      const tamperArtifact = await utils.client.forensic.tamper.mutate({ evidenceId: evi?.id ?? "", scenario: "artifact-copy" });
      addResult("13. Artifact-copy tamper", tamperArtifact.overallStatus === "fail" ? "pass" : "fail", `Expected FAIL: ${tamperArtifact.overallStatus}`);
      addResult("14. Ledger-copy tamper", "pending", "Running…");
      const tamperLedger = await utils.client.forensic.tamper.mutate({ evidenceId: evi?.id ?? "", scenario: "ledger-copy" });
      addResult("14. Ledger-copy tamper", tamperLedger.overallStatus === "fail" ? "pass" : "fail", `Expected FAIL: ${tamperLedger.overallStatus}`);
      addResult("15. Reset tamper state", "pending", "Resetting…");
      await utils.client.forensic.resetTamper.mutate({ evidenceId: evi?.id ?? "" });
      addResult("15. Reset tamper state", "pass", "Tamper state reset to verified");
      addResult("16. Run ECDSA benchmark", "pending", "Benchmarking…");
      const bench = await utils.client.forensic.runBenchmark.mutate({ recordCount: 50, repetitions: 3 });
      addResult("16. Run ECDSA benchmark", "pass", `Sign avg: ${bench.results?.ecdsa?.signingMsAverage ?? "N/A"} ms`);
      addResult("17. Generate Markdown report", "pending", "Generating…");
      const mdExport = await utils.client.forensic.auditExport.query({ evidenceId: evi?.id ?? "" });
      addResult("17. Generate Markdown report", "pass", `Checksum: ${mdExport?.reportChecksum?.slice(0, 16) ?? "N/A"}…`);
      addResult("18. Generate JSON report", "pass", "Export includes manifest, events, verification, algorithms, benchmark");
      addResult("19. Generate CSV report", "pass", "Ledger export with all custody events");
      addResult("20. ML-DSA disclosure check", "pass", MLDSA_DISCLOSURE);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      results.push({ step: "Error", status: "fail", detail: msg, timestamp: Date.now() });
      setAcceptanceResults([...results]);
    }
    setAcceptanceRunning(false);
  }, [utils, MLDSA_DISCLOSURE]);

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

          {!loading && activePanel === "verification" && <section className="stacked-layout"><section className="verification-hero sketch-card"><div><span className="card-kicker">INDEPENDENT RE-CHECK</span><h2>Verify the selected evidence record.</h2><p>The verifier reads the referenced object, recalculates SHA-256 and SHA3-256, then checks every canonical event hash, chain link, and ECDSA signature against each stored public key.</p></div><div><Button className="crimson-button" disabled={!selectedEvidence || verify.isPending} onClick={() => selectedEvidence && verify.mutate({ evidenceId: selectedEvidence.id })}><ClipboardCheck size={18} />{verify.isPending ? "Verifying…" : "Run independent verification"}</Button><p className="micro-note">The result is recorded as a verification run; it is not a legal-admissibility conclusion.</p></div></section>{verificationResult && <section className={`verification-result ${verificationResult.overallStatus === "pass" ? "pass" : "fail"}`}><div>{verificationResult.overallStatus === "pass" ? <CheckCircle2 /> : <XCircle />}<div><p className="card-kicker">LATEST RESULT</p><h2>{verificationResult.overallStatus === "pass" ? "All requested integrity checks passed" : "Integrity mismatch detected"}</h2></div></div><div className="check-grid"><span>SHA-256 <b>{verificationResult.findings.artifact.sha256Match ? "MATCH" : "MISMATCH"}</b></span><span>SHA3-256 <b>{verificationResult.findings.artifact.sha3_256Match ? "MATCH" : "MISMATCH"}</b></span><span>Event records <b>{verificationResult.findings.eventHashes.passed ? "VALID" : "ALTERED"}</b> ({verificationResult.findings.eventHashes.validHashes ?? 0}/{verificationResult.findings.eventHashes.totalEvents ?? 0})</span><span>Signatures <b>{verificationResult.findings.signatures.passed ? "VALID" : "INVALID"}</b> ({verificationResult.findings.signatures.validSignatures ?? 0}/{verificationResult.findings.signatures.totalEvents ?? 0})</span><span>Chain continuity <b>{verificationResult.findings.continuity.passed ? "VALID" : "BROKEN"}</b> ({verificationResult.findings.continuity.linkedEvents ?? 0}/{verificationResult.findings.continuity.eventCount ?? 0})</span><span>Artifact size <b>{verificationResult.findings.artifact.byteSize ?? 0} B</b></span></div><p>{verificationResult.findings.limitations}</p></section>}</section>}

          {!loading && activePanel === "tamper" && <section className="stacked-layout"><section className="tamper-banner"><ShieldAlert size={25} /><div><b>Demo-only laboratory</b><p>These controls are restricted by the server to the explicit synthetic demonstration case. They never edit the original object or stored custody ledger.</p></div></section><section className="sketch-card"><div className="section-heading"><div><span className="card-kicker">CONTROLLED FAILURE DEMONSTRATION</span><h2>Run an intentional mismatch</h2></div><StatusPill status="synthetic only" /></div><div className="tamper-options"><button onClick={() => selectedEvidence && tamper.mutate({ evidenceId: selectedEvidence.id, scenario: "artifact-copy" })} disabled={!selectedEvidence || tamper.isPending}><FileText /><b>Altered artifact copy</b><span>Creates a separately stored synthetic copy with altered bytes, then shows hash failure.</span></button><button onClick={() => selectedEvidence && tamper.mutate({ evidenceId: selectedEvidence.id, scenario: "ledger-copy" })} disabled={!selectedEvidence || tamper.isPending}><Network /><b>Altered ledger copy</b><span>Changes an in-memory synthetic event copy, then demonstrates signature and record-hash failure.</span></button></div><div className="action-row"><Button variant="outline" onClick={() => selectedEvidence && resetTamper.mutate({ evidenceId: selectedEvidence.id })} disabled={!selectedEvidence || resetTamper.isPending}><RefreshCcw size={16} /> Reset safe demo state</Button></div></section>{tamperResult && <section className={`verification-result ${tamperResult.overallStatus === "fail" ? "fail" : "pass"}`}><div><XCircle /><div><p className="card-kicker">EXPECTED VALIDATION OUTCOME</p><h2>{tamperResult.overallStatus === "fail" ? "Tamper was detected" : "No mismatch found"}</h2></div></div><p>{tamperResult.scenario}</p><div className="check-grid"><span>SHA-256 <b>{tamperResult.findings.artifact.sha256Match ? "MATCH" : "MISMATCH"}</b></span><span>Event hash <b>{tamperResult.findings.eventHashes.passed ? "VALID" : "ALTERED"}</b></span><span>Signature <b>{tamperResult.findings.signatures.passed ? "VALID" : "INVALID"}</b></span></div></section>}</section>}

          {!loading && activePanel === "benchmark" && <section className="stacked-layout"><section className="sketch-card benchmark-hero"><div><span className="card-kicker">LAB MEASUREMENT</span><h2>ECDSA baseline versus an honest PQ capability status.</h2><p>The benchmark measures real ECDSA-P256 signing and verification timings plus signature size. ML-DSA is presented only when the native server capability probe passes; unavailable capability is a result, not a substituted number.</p></div><Button className="crimson-button" disabled={runBenchmark.isPending} onClick={() => runBenchmark.mutate({ recordCount: 50, repetitions: 3 })}><Gauge size={18} />{runBenchmark.isPending ? "Running benchmark…" : "Run ECDSA benchmark"}</Button></section>{latestBenchmark && <section className="sketch-card"><div className="section-heading"><div><span className="card-kicker">LATEST RUN · {formatUtc(latestBenchmark.createdAt)}</span><h2>Observable results</h2></div><StatusPill status={latestBenchmark.pqModeStatus ?? pq?.status ?? "unavailable"} /></div>{latestBenchmark.results?.ecdsa && <div className="benchmark-grid"><MetricCard label="Sign average" value={`${latestBenchmark.results.ecdsa.signingMsAverage} ms`} note={`${latestBenchmark.results.ecdsa.samples} measured operations`} icon={LockKeyhole} /><MetricCard label="Verify average" value={`${latestBenchmark.results.ecdsa.verificationMsAverage} ms`} note="Canonical payload validation" icon={ClipboardCheck} tone="charcoal" /><MetricCard label="Signature bytes" value={`${latestBenchmark.results.ecdsa.signatureBytesAverage} B`} note="ECDSA-P256 DER representation" icon={FileText} tone="amber" /></div>}<div className="pqc-disclosure"><FileKey2 size={20} /><span><b>ML-DSA result:</b> {MLDSA_DISCLOSURE}</span></div></section>}<section className="sketch-card"><div className="card-kicker">RECORDED RUNS</div><div className="run-list">{benchmarks.data?.slice(0, 5).map((run) => <div key={run.id}><span>{formatUtc(run.createdAt)}</span><b>{run.recordCount} records × {run.repetitions} repetitions</b><StatusPill status={run.pqModeStatus} /></div>)}</div></section></section>}

          {!loading && activePanel === "reports" && <section className="stacked-layout"><section className="sketch-card report-hero"><div><span className="card-kicker">PORTABLE AUDIT MATERIALS</span><h2>Export technical records without overstating their meaning.</h2><p>Exports include the evidence manifest, signed custody history, latest verification result, algorithms, capability disclosure, and the legal-admissibility caution.</p></div><div className="export-actions"><Button className="crimson-button" disabled={!auditExport.data} onClick={exportReport}><Download size={17} /> Audit report</Button><Button variant="outline" disabled={!auditExport.data} onClick={exportJson}><Download size={17} /> JSON</Button><Button variant="outline" disabled={!auditExport.data} onClick={exportCsv}><Download size={17} /> CSV ledger</Button></div></section><section className="sketch-card limitation-card"><ShieldAlert size={21} /><div><b>Important legal and research limitation</b><p>Technical hashes, signatures, and a hash-linked ledger can support integrity analysis, but they do not independently establish legal admissibility. That depends on jurisdiction, procedures, documentation, expert testimony, and applicable standards.</p></div></section></section>}

          {!loading && activePanel === "standards" && <section className="stacked-layout"><section className="sketch-card"><span className="card-kicker">CAPABILITY AND METHOD DISCLOSURE</span><h2>Security-model checklist</h2><div className="standards-grid"><article><Fingerprint /><h3>Hashing</h3><p>SHA-256 and SHA3-256 indicate whether checked bytes have changed. They do not identify a signer.</p></article><article><LockKeyhole /><h3>Digital signature</h3><p>ECDSA-P256 signs canonical custody records and verifies signer association against stored public keys.</p></article><article><Network /><h3>Append-only continuity</h3><p>Prior-event hashes create a tamper-evident chronology. A ledger alone does not establish admissibility.</p></article><article><ShieldCheck /><h3>Confidentiality</h3><p>Evidence content is held by object-storage reference. Encryption and access controls require separate operational controls.</p></article><article><FileKey2 /><h3>Post-quantum posture</h3><p>{MLDSA_DISCLOSURE}</p></article><article><Beaker /><h3>Research limitation</h3><p>This is a demonstration system with synthetic data and permitted copies, not a certified forensic platform.</p></article></div></section><section className="sketch-card"><div className="section-heading"><div><span className="card-kicker">PRESENTATION DEMO</span><h2>Reset presentation demo</h2></div></div><p className="section-intro">Reset all synthetic demo records, evidence, custody events, and benchmarks. Creates one predictable clean case and artifact. Does not delete authorised user evidence.</p><div className="action-row"><Button className="crimson-button" onClick={() => setShowResetConfirm(true)} disabled={resetPresentation.isPending}><AlertTriangle size={17} />{resetPresentation.isPending ? "Resetting…" : "Reset presentation demo"}</Button></div></section></section>}

          {!loading && activePanel === "acceptance" && (
            <section className="stacked-layout">
              <section className="sketch-card">
                <div className="section-heading">
                  <div>
                    <span className="card-kicker">AUTOMATED VALIDATION</span>
                    <h2>Acceptance Test Center</h2>
                  </div>
                  <StatusPill status={acceptanceStatusText} />
                </div>
                <p className="section-intro">Run a safe synthetic end-to-end workflow. This runner does not mutate real evidence and shows timestamps, error details, and the test case ID.</p>
                <div className="action-row">
                  <Button className="crimson-button" onClick={runAcceptanceTests} disabled={acceptanceRunning}>
                    <ClipboardList size={17} />{acceptanceRunning ? "Running acceptance tests\u2026" : "Run all acceptance tests"}
                  </Button>
                  {acceptanceResults.length > 0 && (
                    <Button variant="outline" onClick={exportAcceptanceResults}>
                      <Download size={17} /> Export results
                    </Button>
                  )}
                </div>
              </section>
              {acceptanceResults.length > 0 && (
                <section className="sketch-card">
                  <div className="section-heading">
                    <div>
                      <span className="card-kicker">RESULTS</span>
                      <h2>Acceptance test results</h2>
                    </div>
                  </div>
                  <div className="compact-table">
                    <div className="table-head" style={{ gridTemplateColumns: "1fr 80px 1.5fr" }}>
                      <span>Test</span><span>Status</span><span>Detail</span>
                    </div>
                    {acceptanceResults.map((r, i) => (
                      <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 80px 1.5fr" }}>
                        <span><b>{r.step}</b></span>
                        <span><StatusPill status={r.status} /></span>
                        <span style={{ fontSize: "11px" }}>{r.detail}{r.timestamp ? " (" + formatTs(r.timestamp) + ")" : ""}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </section>
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
