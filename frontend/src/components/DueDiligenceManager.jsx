import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import Badge from './ui/Badge';

export default function DueDiligenceManager({ apiFetch, validationResults, sessionData, onPreFill }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clearances');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, [validationResults, sessionData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fetcher = typeof apiFetch === 'function' ? apiFetch : window.fetch;
      const res = await fetcher('/api/due_diligence');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load due diligence data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFormA = () => {
    if (!data?.form_a_certificate?.certificate_text) return;
    navigator.clipboard.writeText(data.form_a_certificate.certificate_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center text-gray-500 font-medium">
        Loading Due Diligence & Form A Audit parameters…
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.has_data;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-card-title">Lead Manager Due Diligence & Form A Audit</h3>
              <Badge variant="success" size="xs" className="font-mono">SEBI ICDR REG 246(1)</Badge>
            </div>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Statutory clearances checklist & Form A Lead Manager Due Diligence Certificate generator
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('clearances')}
            className={`px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
              activeTab === 'clearances'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Statutory Clearances ({data.verified_clearances}/{data.total_clearances})
          </button>
          <button
            onClick={() => setActiveTab('form_a')}
            className={`px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
              activeTab === 'form_a'
                ? 'bg-accent-500 text-white shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            SEBI Form A Certificate
          </button>
        </div>
      </div>

      {/* Empty State Banner if workspace reset/no data */}
      {!hasData && (
        <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-[14px] text-amber-950">Awaiting Corporate & Financial Inputs</h4>
            <p className="text-[12px] text-amber-800/80 max-w-md mx-auto">
              Upload your corporate documents (MCA Certificate, GST, Financials) or enter company details in the wizard to calculate real-time due diligence completion.
            </p>
          </div>
          {onPreFill && (
            <button
              onClick={() => onPreFill('complete')}
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300/80 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Load Sample Company Data</span>
            </button>
          )}
        </div>
      )}

      {/* Tab 1: Statutory Clearances Checklist */}
      {activeTab === 'clearances' && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 font-mono">
                Clearance Completion
              </span>
              <p className="text-[13px] font-bold text-emerald-950">
                {data.verified_clearances} of {data.total_clearances} Statutory Mandates Verified ({data.completion_percentage}%)
              </p>
            </div>
            <div className="w-32 h-2.5 bg-emerald-200 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${data.completion_percentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.clearances.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.status === 'verified'
                    ? 'bg-emerald-50/30 border-emerald-200/80'
                    : 'bg-amber-50/30 border-amber-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {item.status === 'verified' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="text-[12px] font-bold text-gray-900">{item.title}</span>
                  </div>
                  <Badge variant={item.status === 'verified' ? 'success' : 'warning'} size="xs" className="font-mono">
                    {item.status === 'verified' ? 'VERIFIED' : 'PENDING'}
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">{item.notes}</p>
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>Authority: {item.authority}</span>
                  <span>{item.required_for}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: SEBI Form A Due Diligence Certificate */}
      {activeTab === 'form_a' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-bold text-gray-700">
              Generated Form A Certificate for Lead Merchant Banker Sign-Off
            </div>
            <button
              onClick={handleCopyFormA}
              className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Form A Text'}</span>
            </button>
          </div>

          <pre className="p-5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800 whitespace-pre-wrap select-text">
            {data.form_a_certificate.certificate_text}
          </pre>
        </div>
      )}
    </div>
  );
}
