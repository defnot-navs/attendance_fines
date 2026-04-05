/**
 * Offline/Online Sync Utility
 * Manages synchronization between IndexedDB and MariaDB
 */

import { getSyncQueue, markAsSynced } from '../db/database';
import apiClient from '../services/apiClient';

/**
 * Check if online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Sync data to server
 */
export async function syncToServer() {
  if (!isOnline()) {
    throw new Error('Cannot sync while offline');
  }

  // Ensure backend is reachable (navigator.onLine can be true while API is down)
  await apiClient.healthCheck();

  localStorage.setItem('lastSyncAttempt', new Date().toISOString());

  const queue = await getSyncQueue();
  
  if (queue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const results = {
    synced: 0,
    failed: 0,
    errors: []
  };

  for (const item of queue) {
    try {
      // Replay the queued operation using existing API endpoints.
      // Currently the app queues offline 'add' actions for: students, attendance, fines.
      if (item.action !== 'add') {
        throw new Error(`Unsupported sync action: ${item.action}`);
      }

      if (item.table === 'students') {
        await apiClient.addStudent(item.data);
      } else if (item.table === 'attendance') {
        await apiClient.recordAttendance({
          studentId: item.data.studentId,
          eventId: item.data.eventId ?? null,
          date: item.data.date,
          type: item.data.type === 'auto' ? 'manual' : item.data.type,
          status: item.data.status,
          session: item.data.session ?? 'AM_IN',
        });
      } else if (item.table === 'fines') {
        await apiClient.recordFine({
          studentId: item.data.studentId,
          eventId: item.data.eventId ?? null,
          amount: item.data.amount,
          reason: item.data.reason,
          date: item.data.date,
        });
      } else {
        throw new Error(`Unsupported sync table: ${item.table}`);
      }

      await markAsSynced(item.id);
      results.synced++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        item: item.id,
        error: error.message
      });
    }
  }

  if (results.failed === 0) {
    localStorage.setItem('lastSuccessfulSync', new Date().toISOString());
  }

  return results;
}

/**
 * Auto-sync when connection is restored
 */
export function setupAutoSync(callback) {
  window.addEventListener('online', async () => {
    console.log('Connection restored, syncing...');
    try {
      const result = await syncToServer();
      if (callback) callback(result);
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  });

  window.addEventListener('offline', () => {
    console.log('Connection lost, working offline');
  });
}

/**
 * Get sync status
 */
export async function getSyncStatus() {
  const queue = await getSyncQueue();
  
  return {
    isOnline: isOnline(),
    pendingItems: queue.length,
    lastSyncAttempt: localStorage.getItem('lastSyncAttempt'),
    lastSuccessfulSync: localStorage.getItem('lastSuccessfulSync')
  };
}

/**
 * Export data for backup
 */
export async function exportData(students, attendance, fines) {
  const data = {
    exportDate: new Date().toISOString(),
    students,
    attendance,
    fines
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export to CSV
 */
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Build CSV content
  let csv = headers.join(',') + '\n';
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
