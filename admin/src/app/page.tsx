import { AdminDashboard } from "./ui/AdminDashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Mangalam Admin</h1>
            <p className="text-sm text-zinc-500">Moderation & verification</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AdminDashboard />
      </main>
    </div>
  );
}
