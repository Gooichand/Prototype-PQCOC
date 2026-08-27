import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardCheck, FileKey2, FileText, Gauge, LockKeyhole, ShieldAlert } from "lucide-react";

function formatUtc(value?: number | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className = normalized === "pass" || normalized === "verified" || normalized === "available"
    ? "pill pill-good" : normalized === "unavailable" || normalized === "review" || normalized === "active"
      ? "pill pill-warn" : "pill pill-bad";
  return <span className={className}>{status.replaceAll("-", " ")}</span>;
}

function MetricCard({ label, value, note, icon: Icon, tone = "crimson" }: { label: string; value: string | number; note: string; icon: typeof import("lucide-react").Activity; tone?: "crimson" | "charcoal" | "amber" }) {
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

const MLDSA_DISCLOSURE = "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

export default function BenchmarkPanel() {
  const benchmarks = trpc.forensic.benchmarks.useQuery();
  const runBenchmark = trpc.forensic.runBenchmark.useMutation();
  const capability = trpc.forensic.capability.useQuery();
  const pq = capability.data;

  const latestBenchmark = benchmarks.data?.[0] ? { ...benchmarks.data[0], results: JSON.parse(benchmarks.data[0].resultsJson) } : null;

  return (
    <section className="stacked-layout">
      <section className="sketch-card benchmark-hero">
        <div>
          <span className="card-kicker">LAB MEASUREMENT</span>
          <h2>ECDSA baseline versus an honest PQ capability status.</h2>
          <p>The benchmark measures real ECDSA-P256 signing and verification timings plus signature size. ML-DSA is presented only when the native server capability probe passes; unavailable capability is a result, not a substituted number.</p>
        </div>
        <Button className="crimson-button" disabled={runBenchmark.isPending} onClick={() => runBenchmark.mutate({ recordCount: 50, repetitions: 3 })}>
          <Gauge size={18} />{runBenchmark.isPending ? "Running benchmark…" : "Run ECDSA benchmark"}
        </Button>
      </section>
      {latestBenchmark && (
        <section className="sketch-card">
          <div className="section-heading">
            <div>
              <span className="card-kicker">LATEST RUN · {formatUtc(latestBenchmark.createdAt)}</span>
              <h2>Observable results</h2>
            </div>
            <StatusPill status={latestBenchmark.pqModeStatus ?? pq?.status ?? "unavailable"} />
          </div>
          {latestBenchmark.results?.ecdsa && (
            <div className="benchmark-grid">
              <MetricCard label="Sign average" value={`${latestBenchmark.results.ecdsa.signingMsAverage} ms`} note={`${latestBenchmark.results.ecdsa.samples} measured operations`} icon={LockKeyhole} />
              <MetricCard label="Verify average" value={`${latestBenchmark.results.ecdsa.verificationMsAverage} ms`} note="Canonical payload validation" icon={ClipboardCheck} tone="charcoal" />
              <MetricCard label="Signature bytes" value={`${latestBenchmark.results.ecdsa.signatureBytesAverage} B`} note="ECDSA-P256 DER representation" icon={FileText} tone="amber" />
            </div>
          )}
          <div className="pqc-disclosure"><FileKey2 size={20} /><span><b>ML-DSA result:</b> {MLDSA_DISCLOSURE}</span></div>
        </section>
      )}
      <section className="sketch-card">
        <div className="card-kicker">RECORDED RUNS</div>
        <div className="run-list">
          {benchmarks.data?.slice(0, 5).map((run) => (
            <div key={run.id}>
              <span>{formatUtc(run.createdAt)}</span>
              <b>{run.recordCount} records × {run.repetitions} reps</b>
              <StatusPill status={run.pqModeStatus ?? "unavailable"} />
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
