import Link from "next/link";

export default function OfflinePage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="card max-w-sm p-6 text-center">
        <h1 className="text-lg font-semibold">You are offline</h1>
        <p className="mt-2 text-sm text-text-2">Capture still works. Anything you record is stored on this device and synced when the connection returns — nothing is lost.</p>
        <Link href="/app/capture" className="btn btn-primary mt-4">
          Open Capture
        </Link>
      </div>
    </main>
  );
}
