import { useHealthCheck } from '../hooks/useHealthCheck';

export default function Home() {
  const health = useHealthCheck();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-slate-900">
      <h1 className="text-3xl font-semibold">BorrowCircle</h1>
      <p className="text-slate-600">Campus marketplace for KNUST students</p>

      <div className="rounded-lg border border-slate-200 px-6 py-4 text-sm">
        {health.status === 'loading' && <p>Checking backend connection…</p>}

        {health.status === 'success' && (
          <div className="space-y-1">
            <p>
              API: <span className="font-medium text-green-600">{health.data.status}</span>
            </p>
            <p>
              Database:{' '}
              <span className={health.data.db ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                {health.data.db ? 'connected' : 'unreachable'}
              </span>
            </p>
          </div>
        )}

        {health.status === 'error' && (
          <p className="text-red-600">Could not reach the API: {health.message}</p>
        )}
      </div>
    </div>
  );
}
