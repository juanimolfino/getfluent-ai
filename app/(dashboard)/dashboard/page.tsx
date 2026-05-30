import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardAutoRefresh } from "@/components/dashboard/dashboard-auto-refresh";
import { JobCreateForm } from "@/components/dashboard/job-create-form";
import { JobHistory } from "@/components/dashboard/job-history";
import { ensureUserProfile, getDashboard } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await ensureUserProfile(user);
  const dashboard = await getDashboard(profile.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <DashboardAutoRefresh statuses={dashboard.jobs.map((job) => job.status)} />
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">{profile.email}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/pricing"><Wallet className="h-4 w-4" /> Buy credits</Link>
          </Button>
          <form action="/api/stripe/portal" method="post">
            <Button variant="outline"><CreditCard className="h-4 w-4" /> Billing portal</Button>
          </form>
          <form action="/logout" method="post">
            <Button variant="ghost"><LogOut className="h-4 w-4" /> Log out</Button>
          </form>
        </div>
      </div>
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Credit balance</p>
          <p className="mt-2 text-4xl font-semibold">{dashboard.credits}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Subscription</p>
          <p className="mt-2 text-2xl font-semibold capitalize">{dashboard.subscription?.plan ?? "free"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{dashboard.subscription?.status ?? "active"}</p>
        </div>
      </section>
      <JobCreateForm />
      <h2 className="mb-4 mt-8 text-2xl font-semibold">History</h2>
      <JobHistory jobs={dashboard.jobs} />
    </main>
  );
}
