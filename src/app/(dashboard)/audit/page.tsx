import { AuditLogTable } from "./AuditLogTable";

// Audit log viewer. The data is captured on every meaningful write into the
// audit_logs table (RLS-scoped to the org); this page surfaces it as a
// searchable, paginated activity feed. Read-only.
export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Activity log</h2>
        <p className="text-sm text-gray-500">
          A record of every change in your organisation — certificates issued,
          emailed, revoked or deleted; templates, courses, trainers and trainees
          created or edited; and settings changes. Newest first.
        </p>
      </div>

      <AuditLogTable />
    </div>
  );
}
