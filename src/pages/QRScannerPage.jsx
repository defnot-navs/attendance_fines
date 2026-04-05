import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import QRScanner from '../components/QRScanner';

export default function QRScannerPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <Link 
              to="/admin" 
              className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
              title="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">QR Code Scanner</h1>
              <p className="text-xs sm:text-sm text-gray-600">Scan attendance QR codes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Scanner */}
      <main className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <QRScanner />
      </main>
    </div>
  );
}
