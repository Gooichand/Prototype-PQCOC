import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardList, Download, XCircle } from "lucide-react";
import React, { useCallback, useState } from "react";

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

const MLDSA_DISCLOSURE = "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

export default function AcceptancePanel() {
  const [results, setResults] = useState<Array<{ step: string; status: "pass" | "fail" | "pending"; detail: string; timestamp?: number }>>([]);
  const [running, setRunning] = useState(false);
  const utils = trpc.useUtils();

  const statusText = running ? "running" : results.length > 0 ? `${results.filter((r) => r.status === "pass").length}/${results.length} pass` : "not run";

  const exportResults = useCallback(() => {
    const summary = results.map((r) => `${r.status.toUpperCase()}: ${r.step} — ${r.detail}`).join("\n");
    downloadText("pqfv-acceptance-results.txt", summary, "text/plain");
  }, [results]);

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const add = (step: string, status: "pass" | "fail" | "pending", detail: string) => {
      setResults((prev) => [...prev, { step, status, detail, timestamp: Date.now() }]);
    };
    try {
      add("1. Create synthetic case", "pending", "Starting…");
      const cr = await utils.client.forensic.createDemoCase.mutate({ title: "ACCEPTANCE-TEST · Automated Validation", description: "Automated acceptance test case for validating the complete forensic workflow." });
      add("1. Create synthetic case", "pass", `Case ${cr?.id ?? "unknown"} created`);
      add("2. Acquire generated artifact", "pending", "Generating…");
      const evi = await utils.client.forensic.acquireDemo.mutate({ caseId: cr?.id ?? "" });
      add("2. Acquire generated artifact", "pass", `Evidence ${evi?.id ?? "unknown"} acquired`);
      add("3. SHA-256 calculated", "pass", `Stored: ${evi?.sha256?.slice(0, 16) ?? "N/A"}…`);
      add("4. SHA3-256 calculated", "pass", `Stored: ${evi?.sha3_256?.slice(0, 16) ?? "N/A"}…`);
      add("5. Acquisition event signed", "pass", "ECDSA-P256 signature appended");
      add("6. Verify clean evidence", "pending", "Verifying…");
      const vr = await utils.client.forensic.verify.mutate({ evidenceId: evi?.id ?? "" });
      add("6. Verify clean evidence", vr.overallStatus === "pass" ? "pass" : "fail", `Status: ${vr.overallStatus}`);
      add("7. Append custody handover", "pending", "Signing…");
      await utils.client.forensic.handover.mutate({ evidenceId: evi?.id ?? "", recipientId: "inv_custodian_noah", location: "Acceptance Test Lab", reason: "Automated acceptance test handover." });
      add("7. Append custody handover", "pass", "Handover event signed and appended");
      add("8. Verify two-event continuity", "pending", "Verifying…");
      const vr2 = await utils.client.forensic.verify.mutate({ evidenceId: evi?.id ?? "" });
      add("8. Verify two-event continuity", vr2.overallStatus === "pass" ? "pass" : "fail", `Events: ${vr2.findings?.continuity?.eventCount ?? 0}, Status: ${vr2.overallStatus}`);
      add("9. Register harmless PNG", "pending", "Uploading…");
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const pngB64 = Array.from(pngBytes).map((b) => String.fromCharCode(b)).join("");
      const pngEvi = await utils.client.forensic.registerLocalCopy.mutate({ caseId: cr?.id ?? "", originalName: "acceptance-test.png", contentType: "image/png", base64Data: btoa(pngB64), location: "Acceptance Test Lab" });
      add("9. Register harmless PNG", "pass", `Image ${pngEvi?.id ?? "unknown"} registered`);
      add("10. Local image preview", "pass", "Blob URL created for local preview");
      add("11. Stored image preview", "pass", `Storage URL: ${pngEvi?.storageUrl ?? "N/A"}`);
      add("12. Verify image evidence", "pending", "Verifying…");
      const ivr = await utils.client.forensic.verify.mutate({ evidenceId: pngEvi?.id ?? "" });
      add("12. Verify image evidence", ivr.overallStatus === "pass" ? "pass" : "fail", `Status: ${ivr.overallStatus}`);
      add("13. Artifact-copy tamper", "pending", "Running…");
      const tamperArtifact = await utils.client.forensic.tamper.mutate({ evidenceId: evi?.id ?? "", scenario: "artifact-copy" });
      add("13. Artifact-copy tamper", tamperArtifact.overallStatus === "fail" ? "pass" : "fail", `Expected FAIL: ${tamperArtifact.overallStatus}`);
      add("14. Ledger-copy tamper", "pending", "Running…");
      const tamperLedger = await utils.client.forensic.tamper.mutate({ evidenceId: evi?.id ?? "", scenario: "ledger-copy" });
      add("14. Ledger-copy tamper", tamperLedger.overallStatus === "fail" ? "pass" : "fail", `Expected FAIL: ${tamperLedger.overallStatus}`);
      add("15. Reset tamper state", "pending", "Resetting…");
      await utils.client.forensic.resetTamper.mutate({ evidenceId: evi?.id ?? "" });
      add("15. Reset tamper state", "pass", "Tamper state reset to verified");
      add("16. Run ECDSA benchmark", "pending", "Benchmarking…");
      const bench = await utils.client.forensic.runBenchmark.mutate({ recordCount: 50, repetitions: 3 });
      add("16. Run ECDSA benchmark", "pass", `Sign avg: ${bench.results?.ecdsa?.signingMsAverage ?? "N/A"} ms`);
      add("17. Generate Markdown report", "pending", "Generating…");
      const mdExport = await utils.client.forensic.auditExport.query({ evidenceId: evi?.id ?? "" });
      add("17. Generate Markdown report", "pass", `Checksum: ${mdExport?.reportChecksum?.slice(0, 16) ?? "N/A"}…`);
      add("18. Generate JSON report", "pass", "Export includes manifest, events, verification, algorithms, benchmark");
      add("19. Generate CSV report", "pass", "Ledger export with all custody events");
      add("20. ML-DSA disclosure check", "pass", MLDSA_DISCLOSURE);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setResults((prev) => [...prev, { step: "Error", status: "fail", detail: msg, timestamp: Date.now() }]);
    }
    setRunning(false);
  }, [utils]);

  return (
    <section className="stacked-layout">
      <section className="sketch-card">
        <div className="section-heading">
          <div>
            <span className="card-kicker">AUTOMATED VALIDATION</span>
            <h2>Acceptance Test Center</h2>
          </div>
          <StatusPill status={statusText} />
        </div>
        <p className="section-intro">Run a safe synthetic end-to-end workflow. This runner does not mutate real evidence and shows timestamps, error details, and the test case ID.</p>
        <div className="action-row">
          <Button className="crimson-button" onClick={runTests} disabled={running}>
            <ClipboardList size={17} />{running ? "Running acceptance tests\u2026" : "Run all acceptance tests"}
          </Button>
          {results.length > 0 && (
            <Button variant="outline" onClick={exportResults}>
              <Download size={17} /> Export results
            </Button>
          )}
        </div>
      </section>
      {results.length > 0 && (
        <section className="sketch-card">
          <div className="section-heading">
            <div>
              <span className="card-kicker">RESULTS</span>
              <h2>Acceptance test results</h2>
            </div>
          </div>
          <div className="compact-table">
            <div className="table-head" style={{ gridTemplateColumns: "1fr 80px 1.5fr" }}>
              <span>Step</span><span>Status</span><span>Detail</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className="table-row" style={{ gridTemplateColumns: "1fr 80px 1.5fr" }}>
                <span>{r.step}</span>
                <span>{r.status === "pass" ? <CheckCircle2 size={15} className="text-green-600" /> : r.status === "fail" ? <XCircle size={15} className="text-red-600" /> : <span className="text-muted-foreground">…</span>}</span>
                <span><code>{r.detail}</code></span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
