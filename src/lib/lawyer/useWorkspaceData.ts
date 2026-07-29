'use client';

import { useEffect, useState } from 'react';
import type { LawyerWorkspaceData } from './types';

export function useWorkspaceData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<LawyerWorkspaceData | null>(null);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/lawyer/workspace', { cache: 'no-store' });
      const payload: unknown = await res.json();

      if (!res.ok) {
        throw new Error('Unable to load workspace');
      }

      setData(payload as LawyerWorkspaceData);
    } catch {
      setError('Could not load live ShieldHer data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  return { data, loading, error, reload: loadWorkspaceData };
}
