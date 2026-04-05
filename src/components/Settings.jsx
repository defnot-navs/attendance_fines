import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, DollarSign, Database } from 'lucide-react';
import { getFineRules, updateFineRule, initializeSampleData } from '../db/hybridDatabase';
import { formatCurrency } from '../utils/finesCalculator';

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const fineRules = await getFineRules();
      setRules(fineRules);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (type, amount) => {
    setSaving(true);
    try {
      await updateFineRule(type, amount);
      await loadRules();
      alert('Fine rule updated successfully');
    } catch (error) {
      alert('Error updating rule: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAmountChange = (type, value) => {
    setRules(rules.map(rule => 
      rule.type === type 
        ? { ...rule, amount: parseFloat(value) || 0 }
        : rule
    ));
  };

  const handleInitializeSampleData = async () => {
    if (!confirm('This will create a sample event with attendance and fines data. Continue?')) {
      return;
    }

    setInitializing(true);
    setMessage(null);
    
    try {
      await initializeSampleData();
      setMessage({
        type: 'success',
        text: 'Sample event data created successfully! Check the Events and Fines Summary tabs.'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error creating sample data: ' + error.message
      });
    } finally {
      setInitializing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const getRuleName = (type) => {
    const names = {
      absent: 'Absent',
      late: 'Late'
    };
    return names[type] || type;
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        Settings
      </h2>

      {/* Fine Rules */}
      <div className="mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          Fine Rules
        </h3>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getRuleName(rule.type)} Fine
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">₱</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rule.amount}
                      onChange={(e) => handleAmountChange(rule.type, e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={saving}
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleUpdate(rule.type, rule.amount)}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student View Link */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Student View Link</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-2">
            Share this link with students to view their attendance and fines:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={window.location.origin + '/student'}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + '/student');
                alert('Link copied to clipboard!');
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>

      {/* Sample Data Initialization */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Sample Data
        </h3>

        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Initialize sample event data with attendance and fines for testing purposes.
            This will create a sample event with 5 student attendance records (2 present, 2 late, 1 absent).
          </p>
          
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}
          
          <button
            onClick={handleInitializeSampleData}
            disabled={initializing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            {initializing ? 'Initializing...' : 'Initialize Sample Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
