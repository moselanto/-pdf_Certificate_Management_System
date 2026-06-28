import { Sidebar } from "@/components/Sidebar";
import { UserMenu } from "@/components/UserMenu";

// Authenticated app shell. The middleware in src/middleware.ts redirects
// unauthenticated users to /login and refreshes the session cookie on every
// request, so anything rendered here is for a signed-in user.
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
          <UserMenu />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
