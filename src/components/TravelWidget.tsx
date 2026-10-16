import React from 'react';
import { Train, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { TRAVEL_ALERTS } from '../data/mockArticles';

export const TravelWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white border border-[#E2DDD5] rounded p-4 shadow-xs ${className}`}>
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <Train className="w-4 h-4 text-[#005EB8]" />
          <h4 className="font-headline font-bold text-sm text-[#0B2545]">
            Clyde & Subway Travel Live
          </h4>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
          Updated 2m ago
        </span>
      </div>

      <div className="space-y-2.5">
        {TRAVEL_ALERTS.map((alert) => (
          <div key={alert.id} className="text-xs bg-[#FAF7F2] p-2.5 rounded border border-neutral-200/80">
            <div className="flex items-center justify-between font-bold mb-1">
              <span className="text-neutral-900">{alert.line}</span>
              <span className={`text-[10px] text-white px-1.5 py-0.5 rounded font-medium ${alert.badgeColor}`}>
                {alert.status}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 leading-snug">
              {alert.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
        <span>Subway: 06:30 - 23:45</span>
        <span className="text-[#005EB8] font-medium hover:underline cursor-pointer">
          SPT Timetables
        </span>
      </div>
    </div>
  );
};
