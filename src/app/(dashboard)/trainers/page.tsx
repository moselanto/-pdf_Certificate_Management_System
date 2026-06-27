import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function listTrainers() {
  const db = createSupabaseServerClient();
  const { data } = await db
    .from("trainers")
    .select("id, name, title, signature_path")
    .order("name");
  return data ?? [];
}

export default async function TrainersPage() {
  let trainers: Awaited<ReturnType<typeof listTrainers>> = [];
  try {
    trainers = await listTrainers();
  } catch {
    trainers = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trainers</h2>
          <p className="text-sm text-gray-500">
            Add trainers and upload their signatures to appear on certificates.
          </p>
        </div>
        <Link
          href="/trainers/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New trainer
        </Link>
      </div>

      {trainers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          No trainers yet. Add one to assign on certificates.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
            <Link
              key={t.id}
              href={`/trainers/${t.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
                {t.name}
              </h3>
              {t.title && <p className="mt-1 text-xs text-gray-500">{t.title}</p>}
              <p className="mt-3 text-xs font-medium">
                {t.signature_path ? (
                  <span className="text-green-600">Signature uploaded</span>
                ) : (
                  <span className="text-amber-600">No signature yet</span>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
