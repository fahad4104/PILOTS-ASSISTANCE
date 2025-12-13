import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Pilot Assistance</h1>
        <p className="text-gray-600">AI-powered aviation knowledge assistant</p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/upload"
            className="px-4 py-2 rounded bg-black text-white"
          >
            Upload PDF
          </Link>

          <Link href="/api/health" className="px-4 py-2 rounded border">
            Health Check
          </Link>
        </div>
      </div>
    </main>
  );
}
