import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Beaker, FileKey2, Fingerprint, LockKeyhole, Network, ShieldCheck } from "lucide-react";

const MLDSA_DISCLOSURE = "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

export default function StandardsPanel({ onResetDemo, resetPending }: { onResetDemo: () => void; resetPending: boolean }) {
  return (
    <section className="stacked-layout">
      <section className="sketch-card">
        <span className="card-kicker">CAPABILITY AND METHOD DISCLOSURE</span>
        <h2>Security-model checklist</h2>
        <div className="standards-grid">
          <article><Fingerprint /><h3>Hashing</h3><p>SHA-256 and SHA3-256 indicate whether checked bytes have changed. They do not identify a signer.</p></article>
          <article><LockKeyhole /><h3>Digital signature</h3><p>ECDSA-P256 signs canonical custody records and verifies signer association against stored public keys.</p></article>
          <article><Network /><h3>Append-only continuity</h3><p>Prior-event hashes create a tamper-evident chronology. A ledger alone does not establish admissibility.</p></article>
          <article><ShieldCheck /><h3>Confidentiality</h3><p>Evidence content is held by object-storage reference. Encryption and access controls require separate operational controls.</p></article>
          <article><FileKey2 /><h3>Post-quantum posture</h3><p>{MLDSA_DISCLOSURE}</p></article>
          <article><Beaker /><h3>Research limitation</h3><p>This is a demonstration system with synthetic data and permitted copies, not a certified forensic platform.</p></article>
        </div>
      </section>
      <section className="sketch-card">
        <div className="section-heading">
          <div>
            <span className="card-kicker">PRESENTATION DEMO</span>
            <h2>Reset presentation demo</h2>
          </div>
        </div>
        <p className="section-intro">Reset all synthetic demo records, evidence, custody events, and benchmarks. Creates one predictable clean case and artifact. Does not delete authorised user evidence.</p>
        <div className="action-row">
          <Button className="crimson-button" onClick={onResetDemo} disabled={resetPending}>
            <AlertTriangle size={17} />{resetPending ? "Resetting…" : "Reset presentation demo"}
          </Button>
        </div>
      </section>
    </section>
  );
}
