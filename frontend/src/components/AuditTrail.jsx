import React, { useState, useEffect } from 'react';
import { ScrollText, Package, Search, Link2, AlertTriangle, FileEdit, ShieldCheck, RotateCw, History, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';
import Badge from './ui/Badge';
import StatTile from './ui/StatTile';

const ACTION_TYPES = [
  { value: '', label: 'All Action Types' },
  { value: 'section.certify', label: 'section.certify' },
  { value: 'section.review', label: 'section.review' },
  { value: 'export.docx', label: 'export.docx' },
  { value: 'export.blocked', label: 'export.blocked' },
  { value: 'validation.run', label: 'validation.run' },
  { value: 'contradiction.found', label: 'contradiction.found' },
  { value: 'blockchain.anchor', label: 'blockchain.anchor' },
];

export default function AuditTrail() {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState('');

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      const query = selectedAction ? `?action=${encodeURIComponent(selectedAction)}` : '';
      const res = await apiFetch(`/api/audit${query}`);
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAction]);

  const entries = auditData?.entries || [];
  const summary = auditData?.summary || {};

  const getActionIcon = (action) => {
    if (action.startsWith('section.certify')) return ScrollText;
    if (action.startsWith('export')) return Package;
    if (action.startsWith('validation')) return Search;
    if (action.startsWith('blockchain')) return Link2;
    if (action.startsWith('contradiction')) return AlertTriangle;
    return FileEdit;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-title flex items-center gap-2.5">
            <History className="w-7 h-7 text-accent-500" /> Audit Trail
          </h1>
          <p className="text-body mt-1">
            Immutable append-only log recording every user action, validation check, certification event, and export attempt.
          </p>
        </div>
        <button onClick={fetchAuditLog} className="btn-secondary shrink-0">
          <RotateCw className="w-3.5 h-3.5" /> Refresh Log
        </button>
      </div>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile icon={ShieldCheck} value={summary.total_events || 0} label="Total Audit Events" tone="accent" />
        <StatTile icon={AlertTriangle} value={summary.total_contradictions_found || 0} label="Contradictions Flagged" tone="warning" />
        <StatTile icon={ScrollText} value={summary.total_sections_certified || 0} label="Banker Certifications" tone="success" />
      </div>

      {/* Filter control */}
      <div className="card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-caption font-bold">Filter by Event Type</span>
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="form-input-base !w-auto !py-2 !text-[12.5px]"
        >
          {ACTION_TYPES.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Event timeline */}
      <div className="card rounded-2xl p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading log entries…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No audit events found for selected criteria.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry, idx) => {
              const isSuccess = entry.outcome === 'success';
              const isDenied = entry.outcome === 'denied';
              const ActionIcon = getActionIcon(entry.action);
              const borderColor = isSuccess ? 'border-l-emerald-500' : isDenied ? 'border-l-red-500' : 'border-l-amber-400';
              return (
                <div key={idx} className={`flex items-start gap-3.5 p-4 rounded-xl bg-gray-50 border border-gray-100 border-l-4 ${borderColor}`}>
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                    <ActionIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-gray-800">{entry.action}</span>
                        <Badge variant={isSuccess ? 'success' : isDenied ? 'danger' : 'warning'} size="xs">
                          {entry.outcome || 'logged'}
                        </Badge>
                      </div>
                      <span className="text-caption shrink-0">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[12px] text-gray-500">
                      Resource: <code className="text-accent-600 font-mono">{entry.resource}</code>
                    </div>
                    {entry.detail && Object.keys(entry.detail).length > 0 && (
                      <pre className="bg-slate-900 text-slate-300 px-3 py-2 rounded-lg text-[11px] mt-2 overflow-x-auto">
                        {JSON.stringify(entry.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
