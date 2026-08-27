import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildAuditMarkdown, buildCustodyCsv } from "@/lib/forensicExports";
import { Download, ScrollText, ShieldAlert } from "lucide-react";
import React, { useMemo } from "react";

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ReportsPanel({ selectedEvidenceId }: { selectedEvidenceId: string | null }) {
  const exportInput = useMemo(() => ({ evidenceId: selectedEvidenceId ?? "" }), [selectedEvidenceId]);
  const auditExport = trpc.forensic.auditExport.useQuery(exportInput, { enabled: Boolean(selectedEvidenceId) });

  const exportJson = () => {
    if (!auditExport.data) return;
    downloadText(`pqfv-audit-${selectedEvidenceId ?? "export"}.json`, JSON.stringify(auditExport.data, null, 2), "application/json");
  };
  const exportCsv = () => {
    if (!auditExport.data) return;
    downloadText(`pqfv-ledger-${selectedEvidenceId ?? "export"}.csv`, buildCustodyCsv(auditExport.data), "text/csv");
  };
  const exportReport = () => {
    if (!auditExport.data) return;
    downloadText(`pqfv-report-${selectedEvidenceId ?? "export"}.md`, buildAuditMarkdown(auditExport.data), "text/markdown");
  };

  return (
    <section className="stacked-layout">
      <section className="sketch-card report-hero">
        <div>
          <span className="card-kicker">PORTABLE AUDIT MATERIALS</span>
          <h2>Export technical records without overstating their meaning.</h2>
          <p>Exports include the evidence manifest, signed custody history, latest verification result, algorithms, capability disclosure, and the legal-admissibility caution.</p>
        </div>
        <div className="export-actions">
          <Button className="crimson-button" disabled={!auditExport.data} onClick={exportReport}><Download size={17} /> Audit report</Button>
          <Button variant="outline" disabled={!auditExport.data} onClick={exportJson}><Download size={17} /> JSON</Button>
          <Button variant="outline" disabled={!auditExport.data} onClick={exportCsv}><Download size={17} /> CSV ledger</Button>
        </div>
      </section>
      <section className="sketch-card limitation-card">
        <ShieldAlert size={21} />
        <div>
          <b>Important legal and research limitation</b>
          <p>Technical hashes, signatures, and a hash-linked ledger can support integrity analysis, but they do not independently establish legal admissibility. That depends on jurisdiction, procedures, documentation, expert testimony, and applicable standards.</p>
        </div>
      </section>
    </section>
  );
}
