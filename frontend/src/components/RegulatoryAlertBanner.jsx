import React, { useState, useEffect } from 'react';
import { Bell, ShieldAlert, ExternalLink, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import Badge from './ui/Badge';

const SEBI_CIRCULARS_URL = 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0';

export default function RegulatoryAlertBanner({ apiFetch }) {
  const [alertsData, setAlertsData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      try {
        const fetcher = typeof apiFetch === 'function' ? apiFetch : window.fetch;
        const res = await fetcher('/api/regulatory_alerts');
        if (res.ok && isMounted) {
          const data = await res.json();
          setAlertsData(data);
        }
      } catch (err) {
        console.error('Failed to fetch regulatory alerts:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAlerts();
    return () => { isMounted = false; };
  }, [apiFetch]);

  if (loading || !alertsData || !alertsData.alerts || alertsData.alerts.length === 0) {
    return null;
  }

  const impactedAlerts = alertsData.alerts.filter(a => a.is_session_impacted);
  const primaryAlert = impactedAlerts.length > 0 ? impactedAlerts[0] : alertsData.alerts[0];
  const liveCount = alertsData.alerts.filter(a => a.is_live).length;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900/5 border border-amber-200/80 rounded-2xl p-4 shadow-sm animate-fade-in select-none">
      {/* Top Banner Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 bg-amber-500/15 border border-amber-300 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="warning" size="xs" className="uppercase tracking-widest font-mono">
                SEBI Circular Update
              </Badge>
              <span className="text-caption font-bold font-mono">
                {alertsData.alerts.length} Active Circulars
              </span>
              {liveCount > 0 && (
                <Badge variant="success" size="xs" icon={Radio} className="font-mono">
                  {liveCount} Live from SEBI
                </Badge>
              )}
            </div>
            <h4 className="font-bold text-[13px] text-gray-800 truncate mt-0.5">
              {primaryAlert.title}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Open specific circular or SEBI listing page */}
          <a
            href={primaryAlert.sebi_url || SEBI_CIRCULARS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>Open SEBI Circular</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>{expanded ? 'Hide Details' : 'View All Circulars'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Circular Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-amber-200/60 space-y-3.5 animate-fade-in">

          {/* Link to full SEBI circulars page */}
          <a
            href={SEBI_CIRCULARS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span className="text-[12px] font-bold text-blue-800">View all SEBI Circulars on sebi.gov.in</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {alertsData.alerts.map((circ) => (
            <div
              key={circ.id}
              className={`p-4 rounded-xl border transition-all ${
                circ.is_session_impacted
                  ? 'bg-amber-500/10 border-amber-300 shadow-xs'
                  : 'bg-white/80 border-gray-200/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {circ.is_live ? (
                    <Badge variant="success" size="xs" icon={Radio} className="font-mono">LIVE</Badge>
                  ) : (
                    <Badge variant="warning" size="xs" className="font-mono">{circ.circular_no}</Badge>
                  )}
                  <span className="text-[10px] text-gray-500 font-semibold font-mono">
                    {circ.date}
                  </span>
                  {circ.is_session_impacted && (
                    <Badge variant="danger" size="xs" pulse className="uppercase">Action Needed on DRHP</Badge>
                  )}
                </div>

                <a
                  href={circ.sebi_url || SEBI_CIRCULARS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10.5px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1 shrink-0"
                >
                  {circ.is_live ? 'Read Circular' : 'Official PDF'} <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <h5 className="font-bold text-[13px] text-gray-900 mb-1">{circ.title}</h5>
              {!circ.is_live && (
                <p className="text-[11.5px] text-gray-600 leading-relaxed font-medium mb-2">{circ.summary}</p>
              )}

              {circ.is_session_impacted && (
                <div className="mt-2.5 p-3 rounded-lg bg-red-50/90 border border-red-200 text-[11.5px] text-red-900 font-medium space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-800 text-[11px] uppercase tracking-wide">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    <span>Statutory Impact Analysis</span>
                  </div>
                  <p className="leading-snug">{circ.impact_analysis}</p>
                  <p className="text-red-700 font-bold mt-1">Required Fix: {circ.action_required}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
