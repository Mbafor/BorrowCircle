import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { HealthResponse } from '../types/health';

type HealthCheckState =
  | { status: 'loading' }
  | { status: 'success'; data: HealthResponse }
  | { status: 'error'; message: string };

export function useHealthCheck(): HealthCheckState {
  const [state, setState] = useState<HealthCheckState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiGet<HealthResponse>('/health')
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
