import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function counts() {
  const db = createSupabaseServerClient();
  const tables = ["certificates", "templates", "courses", "trainers"] as const;
  const entries = await Promise.all(
    tables.map(async (t) => {
      const { count } = await db.from(t).select("*", { count: "exact", head: true });
      return [t, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<(typeof tables)[number], number>;
}

export default async function DashboardPage() {
  let stats: Record<string, number> = {};
  try {
    stats = await counts();
  } catch {
    stats = { certificates: 0, templates: 0, courses: 0, trainers: 0 };
  }

  const cards = [
    { label: "Certificates issued", value: stats.certificates, href: "/history" },
    { label: "Templates", value: stats.templates, href: "/templates" },
    { label: "Courses", value: stats.courses, href: "/courses" },
    { label: "Trainers", value: stats.trainers, href: "/trainers" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-sm text-gray-500">
            Generate a professional certificate in under a minute.
          </p>
        </div>
        <Link
          href="/generate"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Generate certificate
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm"
          >
            <div className="text-3xl font-bold text-gray-900">{c.value}</div>
            <div className="mt-1 text-sm text-gray-500">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
