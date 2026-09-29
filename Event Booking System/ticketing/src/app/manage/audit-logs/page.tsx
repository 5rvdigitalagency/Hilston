import StaffShell from "../staff-shell";
import ComingSoon from "../coming-soon";

export default function AuditLogsPage() {
  return (
    <StaffShell active="audit-logs" title="Audit logs">
      <ComingSoon
        eyebrow="Administration"
        heading="Audit logs"
        description="A full, searchable ledger of staff actions across the system (event changes, check-ins, admin edits)."
        bullets={["Filter by staff member, action type, or date", "Full history, not just the last 20 actions", "Export for compliance review"]}
      />
    </StaffShell>
  );
}
