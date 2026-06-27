import { TraineesDirectory } from "./TraineesDirectory";

// Trainees directory: searchable list with inline create. Trainees can also be
// created on the fly from the generate screen via the same POST /api/trainees.
export default function TraineesPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Trainees</h2>
        <p className="text-sm text-gray-500">
          Keep a directory of recipients. Add an email to enable certificate
          delivery (coming in a later phase).
        </p>
      </div>
      <TraineesDirectory />
    </div>
  );
}
