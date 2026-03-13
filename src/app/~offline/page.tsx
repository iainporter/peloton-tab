export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="text-center px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You're offline
        </h1>
        <p className="text-gray-600">
          Check your connection and try again.
        </p>
      </main>
    </div>
  );
}
