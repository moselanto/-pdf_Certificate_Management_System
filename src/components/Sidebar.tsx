import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/templates", label: "Certificate Templates" },
  { href: "/courses", label: "Courses" },
  { href: "/trainers", label: "Trainers" },
  { href: "/trainees", label: "Trainees" },
  { href: "/generate", label: "Generate Certificate" },
  { href: "/history", label: "Certificate History" },
  { href: "/import", label: "Bulk Import" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="h-8 w-8 rounded-lg bg-brand-600" />
        <span className="text-lg font-bold text-gray-900">CertForge</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-700"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-400">
        v0.1 · Core engine
      </div>
    </aside>
  );
}
