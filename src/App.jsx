import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import StudentView from './pages/StudentView';
import QRScannerPage from './pages/QRScannerPage';
import { initializeFineRules } from './db/database';
import { setupAutoSync } from './utils/syncManager';

function App() {
  useEffect(() => {
    // Initialize database with default fine rules
    initializeFineRules();

    // Setup auto-sync when connection is restored
    setupAutoSync((result) => {
      console.log('Auto-sync completed:', result);
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/student" element={<StudentView />} />
        <Route path="/scan" element={<QRScannerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
