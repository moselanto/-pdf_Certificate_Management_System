import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TrainerCard, type TrainerCardData } from "./TrainerCard";

async function listTrainers(): Promise<TrainerCardData[]> {
  const db = createSupabaseServerClient();
  const { data } = await db
    .from("trainers")
    .select("id, name, title, institution, signature_path")
    .order("name");
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    title: (t.title as string | null) ?? null,
    institution: (t.institution as string | null) ?? null,
    hasSignature: Boolean(t.signature_path),
  }));
}

export default async function TrainersPage() {
  let trainers: TrainerCardData[] = [];
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
            <TrainerCard key={t.id} trainer={t} />
          ))}
        </div>
      )}
    </div>
  );
}
