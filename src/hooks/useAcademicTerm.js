import { useCallback, useEffect, useState } from 'react';
import { getAcademicTerm } from '../db/hybridDatabase';
import { getInitialTerm } from '../utils/academicTerm';

/**
 * The system-wide current academic term (Settings > Academic Year).
 * Starts from the device cache, then is replaced by the server value.
 * `loaded` becomes true once the server (or its offline fallback) has answered.
 */
export default function useAcademicTerm() {
  const [term, setTerm] = useState(() => ({ ...getInitialTerm(), membershipAmount: 100, academicYears: [] }));
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const fresh = await getAcademicTerm();
      setTerm(fresh);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { term, loaded, reload };
}
