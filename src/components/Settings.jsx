import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Database, UserX, Clock, Link2, Info, Copy, Save, Coins } from 'lucide-react';
import { getFineRules, updateFineRule, initializeSampleData } from '../db/hybridDatabase';
import { notify } from '../utils/toast';
import PageHeading from './common/PageHeading';
import StatCards from './common/StatCards';
import useDashboardStats from '../hooks/useDashboardStats';

const RULE_META = {
  absent: {
    name: 'Absent Fine',
    hint: 'Penalty for students who are marked absent in an event or activity.',
    Icon: UserX,
    tone: 'bg-red-100 text-red-600',
  },
  late: {
    name: 'Late Fine',
    hint: 'Penalty for students who arrive late in an event or activity.',
    Icon: Clock,
    tone: 'bg-amber-100 text-amber-600',
  },
};

function Card({ icon: Icon, title, description, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 ${className}`}>
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Settings() {
  const stats = useDashboardStats();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState(null);
  const studentLink = window.location.origin + '/student';

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
    setSavingType(type);
    try {
      await updateFineRule(type, amount);
      await loadRules();
      notify('Fine rule updated successfully');
    } catch (error) {
      notify('Error updating rule: ' + error.message);
    } finally {
      setSavingType(null);
    }
  };

  const handleAmountChange = (type, value) => {
    setRules(rules.map((rule) => (rule.type === type ? { ...rule, amount: parseFloat(value) || 0 } : rule)));
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
        text: 'Sample event data created successfully! Check the Events and Fines Summary tabs.',
      });
      stats.reload();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error creating sample data: ' + error.message });
    } finally {
      setInitializing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentLink);
      notify('Link copied to clipboard!');
    } catch {
      notify('Could not copy the link. Select it and copy manually.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeading icon={SettingsIcon} title="Settings" subtitle="Manage fine rules and student access" />

      <StatCards stats={stats} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 items-start">
        <div className="xl:col-span-3 space-y-4 sm:space-y-5">
          <Card
            icon={Coins}
            title="Fine Rules"
            description="Set the amount for absent and late fines. These values will be applied to all students."
          >
            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
                {rules.map((rule) => {
                  const meta = RULE_META[rule.type] || {
                    name: `${rule.type} Fine`,
                    hint: '',
                    Icon: Coins,
                    tone: 'bg-slate-100 text-slate-600',
                  };
                  const { Icon } = meta;
                  const saving = savingType === rule.type;
                  return (
                    <div key={rule.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${meta.tone}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{meta.name}</p>
                          <p className="text-xs sm:text-sm text-slate-500">{meta.hint}</p>
                        </div>
                      </div>
                      <div className="flex items-end gap-3">
                        <label className="block">
                          <span className="block text-xs font-medium text-slate-600 mb-1">Amount (₱)</span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₱</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rule.amount}
                              onChange={(e) => handleAmountChange(rule.type, e.target.value)}
                              className="w-32 sm:w-40 pl-7 pr-3 py-2 border border-slate-300 rounded-lg"
                              disabled={savingType !== null}
                            />
                          </div>
                        </label>
                        <button
                          onClick={() => handleUpdate(rule.type, rule.amount)}
                          disabled={savingType !== null}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            icon={Database}
            title="Sample Data"
            description="Initialize sample data to quickly test the system. This creates a sample event with 5 attendance records (2 present, 2 late, 1 absent) and their fines. Useful for development and demonstration."
          >
            {message && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}
            <button
              onClick={handleInitializeSampleData}
              disabled={initializing}
              className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
            >
              <Database className="w-4 h-4" />
              {initializing ? 'Initializing…' : 'Initialize Sample Data'}
            </button>
          </Card>
        </div>

        <Card
          icon={Link2}
          title="Student View Link"
          description="Share this link with students so they can view their attendance, fines, and event status."
          className="xl:col-span-2"
        >
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 mb-5">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              This link provides a read-only view for students. They can check their attendance records, fines, and
              upcoming events.
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-800 mb-2" htmlFor="student-link">
            Student View Link
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="student-link"
                type="text"
                value={studentLink}
                readOnly
                onFocus={(e) => e.target.select()}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={copyLink}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap"
            >
              <Copy className="w-4 h-4" />
              Copy Link
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
