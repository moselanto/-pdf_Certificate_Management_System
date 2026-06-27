import { HistoryTable } from "./HistoryTable";

// Certificate History: searchable list of every issued certificate, with
// download/reprint and a link to the public verification page. Data comes from
// GET /api/certificates (org-scoped via RLS, supports ?q= search).
export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Certificate history</h2>
        <p className="text-sm text-gray-500">
          Search by recipient name or certificate number. Download to reprint an
          exact copy.
        </p>
      </div>
      <HistoryTable />
    </div>
  );
}
