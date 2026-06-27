import { redirect } from "next/navigation";

// Root: send people into the dashboard (middleware redirects to /login if
// they are not authenticated).
export default function Home() {
  redirect("/dashboard");
}
