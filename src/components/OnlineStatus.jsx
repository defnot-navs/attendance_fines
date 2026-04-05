import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Database, AlertCircle } from 'lucide-react';
import apiClient from '../services/apiClient';

export default function OnlineStatus() {
  const [backendOnline, setBackendOnline] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkBackend = async () => {
    setChecking(true);
    setError(null);
    try {
      await apiClient.healthCheck();
      setBackendOnline(true);
      console.log('✅ Backend connected');
    } catch (err) {
      setBackendOnline(false);
      setError(err.message);
      console.error('❌ Backend offline:', err.message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (backendOnline === null) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-gray-50 border-gray-200">
        <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
        <span className="text-xs text-gray-600">Checking...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        backendOnline 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        {backendOnline ? (
          <Database className="w-4 h-4 text-green-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-600" />
        )}
        
        <div>
          <p className={`font-medium text-xs ${
            backendOnline ? 'text-green-900' : 'text-red-900'
          }`}>
            {backendOnline ? 'DB Connected' : 'DB Offline'}
          </p>
          {!backendOnline && error && (
            <p className="text-xs text-red-700 mt-0.5 max-w-xs truncate" title={error}>
              {error}
            </p>
          )}
        </div>

        <button
          onClick={checkBackend}
          disabled={checking}
          className="p-1 hover:bg-white rounded disabled:opacity-50"
          title="Refresh connection"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''} ${
            backendOnline ? 'text-green-700' : 'text-red-700'
          }`} />
        </button>
      </div>
    </div>
  );
}
