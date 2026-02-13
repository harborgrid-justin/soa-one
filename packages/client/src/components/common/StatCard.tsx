import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconColor?: string;
  trend?: {
    value: number;
    label?: string;
  };
  link?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, iconColor = 'text-brand-600 bg-brand-50', trend, onClick }: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick ? { onClick, type: 'button' as const } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`card p-5 text-left w-full ${onClick ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        )}
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.value > 0
                ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
                : trend.value < 0
                ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
                : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'
            }`}
          >
            {trend.value > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend.value < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
        {label}
        {trend?.label && <span className="text-xs ml-1">({trend.label})</span>}
      </div>
    </Wrapper>
  );
}
