import React, { useState, useEffect } from 'react';
import { Lock, Landmark, CheckCircle2, Loader2, Download } from 'lucide-react';
import { apiFetch } from '../api';
import Badge from './ui/Badge';

const CERTIFIABLE_SECTIONS = [
  { key: "cover_page", name: "Cover Page & Issue Particulars" },
  { key: "business_overview", name: "Business Overview & Operations" },
  { key: "risk_factors", name: "Risk Factors & Disclosures" },
  { key: "capital_structure", name: "Capital Structure & Promoter Shareholding" },
  { key: "objects_of_issue", name: "Objects of the Issue & GCP Allocation" },
  { key: "financial_summary", name: "Financial Statements & Restated Performance" },
  { key: "promoter_details", name: "Promoter Details & Management" },
  { key: "litigation", name: "Outstanding Litigation & Regulatory Approvals" },
  { key: "management_discussion", name: "Management Discussion & Analysis (MD&A)" },
  { key: "industry_overview", name: "Industry Overview & Sector Trends" },
  { key: "regulatory_approvals", name: "Government & Statutory Approvals" },
];

export default function BankerDashboard() {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bankerName, setBankerName] = useState('Senior Merchant Banker');
  const [actionNotes, setActionNotes] = useState({});

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/certification/status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (err) {
      console.error('Failed to fetch certification status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleReview = async (secKey) => {
    const note = actionNotes[secKey] || '';
    try {
      const res = await apiFetch(`/api/certification/${secKey}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_note: note })
      });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCertify = async (secKey) => {
    const note = actionNotes[secKey] || '';
    try {
      const res = await apiFetch(`/api/certification/${secKey}/certify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banker_name: bankerName, banker_notes: note })
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUncertify = async (secKey) => {
    try {
      const res = await apiFetch(`/api/certification/${secKey}/uncertify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Reopened for revisions' })
      });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadBundle = async () => {
    try {
      const res = await apiFetch('/api/export/bundle');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SEBI_SME_IPO_Efiling_Bundle.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const errData = await res.json();
        alert(`Export Blocked: ${errData.message || 'All sections must be certified.'}`);
      }
    } catch {
      alert('Error initiating bundle export');
    }
  };

  if (loading && !statusData) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-24 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading Banker Dashboard…
      </div>
    );
  }

  const states = statusData?.states || {};
  const certifiedCount = statusData?.certified_count || 0;
  const totalRequired = statusData?.total_required || 11;
  const isAllowed = statusData?.export_allowed || false;
  const progressPct = Math.round((certifiedCount / totalRequired) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-title flex items-center gap-2.5">
            <Landmark className="w-7 h-7 text-accent-500" /> Banker Certification
          </h1>
          <p className="text-body mt-1 max-w-2xl">
            SEBI Chapter IX Mandate: DRHP export is strictly gated until all {totalRequired} statutory prospectus sections are certified by an authorized intermediary.
          </p>
        </div>
        {isAllowed ? (
          <Badge variant="success" icon={CheckCircle2} className="!text-[12px] !px-3.5 !py-2 shrink-0">EXPORT READY</Badge>
        ) : (
          <Badge variant="danger" icon={Lock} className="!text-[12px] !px-3.5 !py-2 shrink-0">
            EXPORT BLOCKED ({certifiedCount}/{totalRequired} Certified)
          </Badge>
        )}
      </div>

      {/* Progress card */}
      <div className="card rounded-2xl p-6">
        <div className="flex items-center justify-between text-caption font-bold mb-2">
          <span>Certification Progress</span>
          <span>{certifiedCount} of {totalRequired} Sections ({progressPct}%)</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isAllowed ? 'bg-emerald-500' : 'bg-accent-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Banker particulars + export */}
      <div className="card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <span className="text-caption font-bold shrink-0">Signing Merchant Banker Name</span>
        <input
          type="text"
          value={bankerName}
          onChange={(e) => setBankerName(e.target.value)}
          className="form-input-base !w-64 !py-2 !text-[12.5px]"
        />
        <button
          onClick={handleDownloadBundle}
          disabled={!isAllowed}
          className={`ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-bold transition-all ${
            isAllowed
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5" /> Download Export Bundle (.ZIP)
        </button>
      </div>

      {/* Certifiable sections table */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-caption uppercase tracking-wide">
                <th className="px-5 py-3.5 font-bold">Section</th>
                <th className="px-5 py-3.5 font-bold w-28">Status</th>
                <th className="px-5 py-3.5 font-bold">Certified By / Notes</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CERTIFIABLE_SECTIONS.map((sec) => {
                const st = states[sec.key] || { status: 'draft' };
                const isCertified = st.status === 'certified';
                const isReviewed = st.status === 'reviewed';

                return (
                  <tr key={sec.key} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-4 font-semibold text-gray-800">{sec.name}</td>
                    <td className="px-5 py-4">
                      {isCertified && <Badge variant="success" size="xs">CERTIFIED</Badge>}
                      {isReviewed && <Badge variant="info" size="xs">REVIEWED</Badge>}
                      {st.status === 'draft' && <Badge variant="neutral" size="xs">DRAFT</Badge>}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {isCertified ? (
                        <div>
                          <div className="text-gray-800 font-medium">{st.certified_by}</div>
                          <div className="text-caption">{st.certified_at ? new Date(st.certified_at).toLocaleString() : ''}</div>
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Add review note…"
                          value={actionNotes[sec.key] || ''}
                          onChange={(e) => setActionNotes({ ...actionNotes, [sec.key]: e.target.value })}
                          className="form-input-base !py-1.5 !text-[12px] !w-full"
                        />
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {!isCertified && (
                          <>
                            <button
                              onClick={() => handleReview(sec.key)}
                              className="px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                              Mark Reviewed
                            </button>
                            <button
                              onClick={() => handleCertify(sec.key)}
                              className="px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-white bg-accent-500 hover:bg-accent-600 transition-colors cursor-pointer"
                            >
                              Certify
                            </button>
                          </>
                        )}
                        {isCertified && (
                          <button
                            onClick={() => handleUncertify(sec.key)}
                            className="px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                          >
                            Revoke Certification
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
