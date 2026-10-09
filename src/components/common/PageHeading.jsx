import React from 'react';

// Shared tab heading: gradient icon tile + title + optional subtitle.
export default function PageHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shrink-0">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}
