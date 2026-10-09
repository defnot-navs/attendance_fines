import { useCallback, useEffect, useState } from 'react';
import { getAllStudents, getAllEvents, getAllAttendance, getAllFines } from '../db/hybridDatabase';

const localISODate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const sameDay = (value, iso) => !!value && String(value).slice(0, 10) === iso;

// Loads the headline numbers shown on the dashboard and settings pages.
export default function useDashboardStats() {
  const [stats, setStats] = useState({
    loading: true,
    totalStudents: 0,
    attendanceRate: null, // null = no attendance recorded today
    pendingFines: 0,
    pendingAmount: 0,
    activeEvents: 0,
    upcomingEvents: [],
  });

  const load = useCallback(async () => {
    try {
      const [students, events, attendance, fines] = await Promise.all([
        getAllStudents(),
        getAllEvents(),
        getAllAttendance(),
        getAllFines(),
      ]);
      const today = localISODate();

      const todays = attendance.filter((a) => sameDay(a.date || a.timestamp, today));
      const attended = todays.filter((a) => a.status === 'present' || a.status === 'late').length;
      const attendanceRate = todays.length ? Math.round((attended / todays.length) * 100) : null;

      const unpaid = fines.filter((f) => !f.paid);
      const upcomingEvents = events
        .filter((e) => e.date && String(e.date).slice(0, 10) >= today)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

      setStats({
        loading: false,
        totalStudents: students.length,
        attendanceRate,
        pendingFines: unpaid.length,
        pendingAmount: unpaid.reduce((sum, f) => sum + (f.amount || 0), 0),
        activeEvents: upcomingEvents.length,
        upcomingEvents,
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      setStats((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...stats, reload: load };
}
