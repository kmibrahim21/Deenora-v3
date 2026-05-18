import React, { useState, useEffect } from 'react';
import { requestManager } from '../services/RequestManager';
import { SyncEngine } from '../services/syncEngine';
import { Activity, Database, RefreshCw, XCircle, Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export const PerformanceDashboard: React.FC = () => {
  const [syncStats, setSyncStats] = useState<any>(null);
  const [metrics, setMetrics] = useState(requestManager.metrics);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const stats = await SyncEngine.getStats();
        setSyncStats(stats);
        setMetrics({ ...requestManager.metrics });
      } catch (err) {
        console.error("Dashboard update failed", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button 
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2 bg-slate-800 text-white rounded-full shadow-lg z-50 opacity-50 hover:opacity-100 transition-opacity"
        title="Open Performance Dashboard"
      >
        <Activity size={20} />
      </button>
    );
  }

  return (
    <motion.div 
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 right-4 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden font-sans"
    >
      <div className="bg-slate-900 p-3 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          <span className="font-semibold text-sm">System Performance</span>
        </div>
        <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-white">
          <XCircle size={18} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Sync Queue */}
        <section>
          <div className="flex items-center gap-2 mb-2 text-slate-600">
            <RefreshCw size={14} className={syncStats?.isSyncing ? "animate-spin text-blue-500" : ""} />
            <h3 className="text-xs font-bold uppercase tracking-wider">Sync Engine</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Pending" value={syncStats?.pending || 0} color={syncStats?.pending > 20 ? "text-orange-500" : "text-slate-900"} />
            <StatCard label="Retries" value={syncStats?.failureCount || 0} color={syncStats?.failureCount > 0 ? "text-red-500" : "text-slate-900"} />
          </div>
          {syncStats?.isCircuitOpen && (
            <div className="mt-2 text-[10px] bg-red-50 text-red-600 p-1 rounded text-center border border-red-100">
              Circuit Breaker Open: Auto-Sync Paused
            </div>
          )}
        </section>

        {/* Cache Metrics */}
        <section>
          <div className="flex items-center gap-2 mb-2 text-slate-600">
            <Database size={14} />
            <h3 className="text-xs font-bold uppercase tracking-wider">Request Cache</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Hits" value={metrics.hits} color="text-green-600" />
            <StatCard label="Misses" value={metrics.misses} color="text-slate-400" />
            <StatCard label="Refetches" value={metrics.refetches} color="text-blue-500" />
            <StatCard label="Throttled" value={metrics.throttled} color="text-orange-400" />
          </div>
        </section>

        {/* Database Load (Simulated Health) */}
        <section>
          <div className="flex items-center gap-2 mb-2 text-slate-600">
            <Clock size={14} />
            <h3 className="text-xs font-bold uppercase tracking-wider">IO Protection</h3>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-100">
            <div className="flex justify-between text-[10px] mb-1">
              <span>Concurrent Jobs</span>
              <span className="font-mono text-slate-500">{syncStats?.isSyncing ? "1 / 3" : "0 / 3"}</span>
            </div>
            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: syncStats?.isSyncing ? '33%' : '0%' }}
              />
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

const StatCard = ({ label, value, color = "text-slate-900" }: { label: string, value: any, color?: string }) => (
  <div className="bg-slate-50 p-2 rounded border border-slate-100">
    <div className="text-[10px] text-slate-500 uppercase tracking-tighter">{label}</div>
    <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
  </div>
);
