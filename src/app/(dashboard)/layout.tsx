import { Sidebar } from "@/components/Sidebar";

// Authenticated app shell. In production, wrap this with an auth guard that
// redirects unauthenticated users to /login (Supabase Auth). The middleware
// in src/middleware.ts refreshes the session cookie on every request.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h1 className="text-sm font-semibold text-gray-700">
            Certificate Management
          </h1>
          <div className="h-8 w-8 rounded-full bg-gray-200" />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
