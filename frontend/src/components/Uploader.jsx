import React, { useRef, useState } from 'react';
import {
  Eye, EyeOff, Loader2, X, ShieldCheck, ShieldAlert,
  BarChart3, Receipt, ScrollText, IdCard, BookOpen, Calculator, UserCog, Scale, LineChart, Sparkles, Clock,
} from 'lucide-react';
import Badge from './ui/Badge';

export default function Uploader({
  sessionData,
  onUploadSuccess,
  apiFetch,
}) {

  const DOC_TYPES = [
    'financials', 'gst', 'incorporation', 'compliance',
    'moa_aoa', 'cap_table', 'dir12', 'litigation_schedule', 'industry_report', 'sales_register',
  ];
  const initFalse = () => Object.fromEntries(DOC_TYPES.map(t => [t, false]));
  const initEmptyStr = () => Object.fromEntries(DOC_TYPES.map(t => [t, '']));
  const initNull = () => Object.fromEntries(DOC_TYPES.map(t => [t, null]));

  const [uploading, setUploading] = useState(initFalse());

  const [error, setError] = useState(initEmptyStr());

  const [dragging, setDragging] = useState(initFalse());

  // Collapsed by default in the row layout — each row stays compact and
  // scannable; clicking the eye icon expands just that row's extracted
  // fields in place, rather than every row permanently taking extra height.
  const [expandedJson, setExpandedJson] = useState(initFalse());

  const [vcModal, setVcModal] = useState(null);

  const fetchAndShowVC = async (docType) => {
    try {
      const res = await apiFetch(`/api/credentials/${docType}`);
      if (res.ok) {
        const data = await res.json();
        setVcModal(data);
      }
    } catch (err) {
      console.error("Failed to fetch W3C VC:", err);
    }
  };

  const fileInputs = {
    financials: useRef(null),
    gst: useRef(null),
    incorporation: useRef(null),
    compliance: useRef(null),
    moa_aoa: useRef(null),
    cap_table: useRef(null),
    dir12: useRef(null),
    litigation_schedule: useRef(null),
    industry_report: useRef(null),
    sales_register: useRef(null),
  };

  const [jobState, setJobState] = useState(initNull());

  // Uploads exactly one document and resolves only once its background job has
  // fully finished (completed or failed) — unlike a plain fetch, so the queue
  // below can safely await it before starting the next one.
  const uploadOne = (docType, file) => new Promise((resolve) => {
    setUploading(prev => ({ ...prev, [docType]: true }));
    setError(prev => ({ ...prev, [docType]: '' }));
    setJobState(prev => ({
      ...prev,
      [docType]: { progress: 15, stage: 'Validating document integrity & hash...', status: 'processing', filename: file.name }
    }));

    const finish = () => {
      setUploading(prev => ({ ...prev, [docType]: false }));
      setJobState(prev => ({ ...prev, [docType]: null }));
      resolve();
    };

    (async () => {
      const formData = new FormData();
      formData.append('doc_type', docType);
      formData.append('file', file);

      try {
        const response = await apiFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to upload and parse document.');
        }

        const result = await response.json();
        const jobId = result.job_id;

        if (!jobId) {
          onUploadSuccess(docType, result.extracted, { filename: result.filename, size: file.size, extraction_status: result.extraction_status, extraction_error: result.extraction_error });
          finish();
          return;
        }

        // Poll background job status endpoint (/api/jobs/{id}/status)
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await apiFetch(`/api/jobs/${jobId}/status`);
            if (statusRes.ok) {
              const jobData = await statusRes.json();
              setJobState(prev => ({
                ...prev,
                [docType]: {
                  progress: jobData.progress || 15,
                  stage: jobData.stage || 'Processing document...',
                  status: jobData.status,
                  filename: file.name
                }
              }));

              if (jobData.status === 'completed') {
                clearInterval(pollInterval);
                onUploadSuccess(
                  docType,
                  jobData.extracted_data || {},
                  {
                    filename: file.name,
                    size: file.size,
                    extraction_status: 'completed',
                    extraction_error: null
                  }
                );
                setTimeout(finish, 1200);
              } else if (jobData.status === 'failed') {
                clearInterval(pollInterval);
                setError(prev => ({ ...prev, [docType]: jobData.error || 'Extraction failed.' }));
                finish();
              }
            }
          } catch (pollErr) {
            console.error("Polling job status error:", pollErr);
          }
        }, 750);

      } catch (err) {
        console.error(err);
        setError(prev => ({ ...prev, [docType]: err.message || 'An error occurred.' }));
        finish();
      }
    })();
  });

  // ── Upload queue ──────────────────────────────────────────────────────────
  // Documents extract one at a time instead of all firing concurrently.
  // Concurrent extraction jobs each do their own load-session -> merge ->
  // save-session round trip; running several at once let a slower job's stale
  // in-memory session snapshot overwrite fields a faster job had just saved
  // (e.g. a stale company_name surviving a fresh batch upload). A backend lock
  // now also guards that critical section, but queuing here keeps only one
  // OCR/LLM extraction — and one card's "Analyzing…" spinner — active at a
  // time, which is both the fix and the honest UI for what's happening.
  const [queuedTypes, setQueuedTypes] = useState(initFalse());
  const uploadQueueRef = useRef([]);
  const isDrainingQueueRef = useRef(false);

  const drainQueue = async () => {
    if (isDrainingQueueRef.current) return;
    isDrainingQueueRef.current = true;
    while (uploadQueueRef.current.length > 0) {
      const { docType, file } = uploadQueueRef.current.shift();
      setQueuedTypes(prev => ({ ...prev, [docType]: false }));
      await uploadOne(docType, file);
    }
    isDrainingQueueRef.current = false;
  };

  const handleUpload = (docType, file) => {
    if (!file) return;
    // Re-selecting a doc_type already waiting in the queue just replaces the
    // pending file rather than queuing a second entry for the same card.
    uploadQueueRef.current = uploadQueueRef.current.filter(item => item.docType !== docType);
    uploadQueueRef.current.push({ docType, file });
    setQueuedTypes(prev => ({ ...prev, [docType]: true }));
    drainQueue();
  };

  const [loadingDemo, setLoadingDemo] = useState(false);

  // One-click demo loader — pulls the bundled sample document set from the
  // server (backend/demo_files/) and feeds each one through the exact same
  // handleUpload() path a manual click-to-select would use, so it gets the
  // same progress bar, job polling, and extracted-field display per card.
  // Skips any doc_type that already has a document, so it only ever fills
  // empty slots rather than clobbering something already uploaded.
  const handleLoadDemoFiles = async () => {
    setLoadingDemo(true);
    try {
      const res = await apiFetch('/api/demo/manifest');
      if (!res.ok) throw new Error('Failed to load demo document manifest.');
      const { files } = await res.json();

      const uploadedTypes = new Set((sessionData.uploaded_files || []).map(f => f.type));
      const pending = files.filter(f => !uploadedTypes.has(f.doc_type));

      // Fetch each sample file's bytes and hand it to the same queue a manual
      // upload uses — handleUpload() only enqueues, so this loop just fills
      // the queue; drainQueue() (already running from the first call) works
      // through it one document at a time.
      for (const { doc_type, filename } of pending) {
        try {
          const fileRes = await apiFetch(`/api/demo/file/${doc_type}`);
          if (!fileRes.ok) throw new Error(`Failed to fetch demo file for ${doc_type}`);
          const blob = await fileRes.blob();
          const file = new File([blob], filename, { type: 'application/pdf' });
          handleUpload(doc_type, file);
        } catch (err) {
          console.error(`Demo load failed for ${doc_type}:`, err);
          setError(prev => ({ ...prev, [doc_type]: 'Failed to load demo document.' }));
        }
      }
    } catch (err) {
      console.error('Failed to load demo documents:', err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const triggerFileInput = (docType) => {
    fileInputs[docType].current?.click();
  };

  const handleDragOver = (e, docType) => {
    e.preventDefault();
    setDragging(prev => ({ ...prev, [docType]: true }));
  };

  const handleDragLeave = (docType) => {
    setDragging(prev => ({ ...prev, [docType]: false }));
  };

  const handleDrop = (e, docType) => {
    e.preventDefault();
    setDragging(prev => ({ ...prev, [docType]: false }));
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(docType, file);
  };

  const docConfig = {
    financials: {
      title: 'Financial Statements',
      desc: 'Restated financial statements for the past 3 fiscal years (PDF/Image).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: BarChart3,
      extractedKeys: {
        fy_years: 'Fiscal Years',
        revenue_fy_latest: 'Latest Revenue',
        pat_fy_latest: 'Latest Net Profit',
        borrowings_latest: 'Outstanding Borrowings',
        auditor_name: 'Statutory Auditor',
        auditor_membership: 'Auditor Membership'
      }
    },
    gst: {
      title: 'GST Registration & Returns',
      desc: 'GSTR-3B summary or GSTIN Certificate.',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: Receipt,
      extractedKeys: {
        gstin: 'GSTIN Registration',
        company_name: 'Taxpayer Legal Name',
        gst_annual_turnover: 'GST Turnover',
        registration_date: 'Registration Date',
        filing_status: 'Filing Status'
      }
    },
    incorporation: {
      title: 'Incorporation Docs',
      desc: 'Certificate of Incorporation Issued by Registrar of Companies (PDF/Image).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: ScrollText,
      extractedKeys: {
        cin: 'RoC Corporate ID (CIN)',
        company_name: 'RoC Registered Name',
        incorporation_date: 'Incorporation Date',
        registered_office: 'Registered Office Address',
        company_type: 'Company Category'
      }
    },
    compliance: {
      title: 'PAN & TAN Licenses',
      desc: 'Statutory company PAN, TAN or local operating licenses (PDF/Image).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: IdCard,
      extractedKeys: {
        pan: 'Company PAN No.',
        pan_name: 'Name on PAN',
        tan: 'Company TAN No.'
      }
    },
    moa_aoa: {
      title: 'MOA / AOA',
      desc: 'Memorandum and Articles of Association (PDF).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: BookOpen,
      extractedKeys: {
        authorized_capital: 'Authorized Capital',
        face_value_per_share: 'Face Value / Share',
        objects_clause: 'Objects Clause'
      }
    },
    cap_table: {
      title: 'Register of Members / Cap Table',
      desc: 'Shareholder register for pre-offer shareholding and promoter group (PDF).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: Calculator,
      extractedKeys: {
        promoter_shareholding_pre_pct: 'Promoter Shareholding %',
        pre_offer_shareholding: 'Pre-Offer Shareholding Rows',
        promoter_group_members: 'Promoter Group Members'
      }
    },
    dir12: {
      title: 'DIR-12 / Board Resolutions',
      desc: 'Director/KMP appointment filings (PDF).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: UserCog,
      extractedKeys: {
        directors: 'Directors Found',
        kmp: 'KMP Found'
      }
    },
    litigation_schedule: {
      title: 'Litigation Schedule',
      desc: 'Structured litigation schedule from legal counsel (PDF) — not free-text scraped.',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: Scale,
      extractedKeys: {
        litigation_summary: 'Litigation Summary Rows'
      }
    },
    industry_report: {
      title: 'Industry Report',
      desc: 'CRISIL / CARE / ICRA industry report (PDF) — best-effort, low-confidence extraction.',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: LineChart,
      extractedKeys: {
        industry_market_size: 'Market Size',
        industry_cagr: 'CAGR',
        industry_report_source: 'Report Source'
      }
    },
    sales_register: {
      title: 'Sales Register / GST Sales',
      desc: 'Sales ledger or GST sales register for customer concentration (PDF).',
      accentColor: 'text-blue-600',
      accentBg: 'bg-blue-50/60',
      accentBorder: 'border-blue-200/80',
      iconBg: 'bg-blue-100/80',
      icon: Receipt,
      extractedKeys: {
        top5_customer_revenue_table: 'Top-5 Customer Rows',
        key_geographies_served: 'Geographies',
        gst_annual_turnover: 'GST Turnover'
      }
    }
  };

  const formatValue = (key, val) => {
    if (val === null || val === undefined || val === '') {
      return <Badge variant="danger" size="xs" className="uppercase">Missing</Badge>;
    }
    if (typeof val === 'number') {
      return `₹ ${val.toFixed(2)} Cr`;
    }
    if (Array.isArray(val)) {
      return val.length === 0 ? (
        <span className="text-red-500 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md text-[9px] uppercase select-none">
          Missing
        </span>
      ) : `${val.length} row${val.length === 1 ? '' : 's'} found`;
    }
    return String(val);
  };

  return (
    <div className="w-full space-y-3 animate-fade-in-up">
      {/* Page header — compact single line, no wasted vertical space */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-page-title">Document Vault</h1>
          <p className="text-[11.5px] text-gray-400 font-medium">10 statutory documents · click a card to upload</p>
        </div>
        <button
          type="button"
          onClick={handleLoadDemoFiles}
          disabled={loadingDemo}
          title="Fills every empty card with the bundled sample document set — for demos only."
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent-700 hover:text-accent-800 transition-all cursor-pointer bg-accent-50 hover:bg-accent-100 border border-accent-200 hover:border-accent-300 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loadingDemo ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Loading Demo Set…</span></>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /><span>Load Demo Documents</span></>
          )}
        </button>
      </div>

      {/* 2×5 layout — two wide columns, five rows, so every item still reads
          as a horizontal row (not a narrow stacked card) but the vault is
          half the scroll height of a single full-width column. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {Object.entries(docConfig).map(([type, config]) => {
          const isUploading = uploading[type];
          const isQueued = queuedTypes[type] && !isUploading;
          const hasError = error[type];
          const isDragging = dragging[type];
          const extractedData = sessionData.extracted_data?.[type] || {};
          const uploadedFileObj = sessionData.uploaded_files?.find(f => f.type === type);
          const extractionCompleted = uploadedFileObj?.extraction_status === 'completed';
          const isUploaded = Object.keys(extractedData).length > 0 || !!uploadedFileObj;
          const showJson = expandedJson[type];
          const extractedCount = Object.keys(config.extractedKeys).filter(k => {
            const v = extractedData[k];
            return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
          }).length;
          const isEmptyInteractive = !isUploaded && !isUploading && !isQueued;

          return (
            <div
              key={type}
              className={`bg-white border rounded-2xl shadow-card overflow-hidden transition-colors animate-fade-in-up ${
                isUploaded ? 'border-gray-200' : 'border-gray-100'
              }`}
            >
              <div
                onClick={isEmptyInteractive ? () => triggerFileInput(type) : undefined}
                onDragOver={isEmptyInteractive ? (e) => handleDragOver(e, type) : undefined}
                onDragLeave={isEmptyInteractive ? () => handleDragLeave(type) : undefined}
                onDrop={isEmptyInteractive ? (e) => handleDrop(e, type) : undefined}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                  isEmptyInteractive ? 'cursor-pointer' : ''
                } ${isDragging ? `${config.accentBg}` : 'hover:bg-gray-50/70'}`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 ${config.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                  <config.icon className={`w-4 h-4 ${config.accentColor}`} />
                </div>

                {/* Title + status/description — flexible, fills the row */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[12.5px] font-bold text-gray-800 leading-tight truncate">{config.title}</h3>
                    {isUploaded && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${extractionCompleted ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        title={extractionCompleted ? 'Extracted — review required' : 'Manual review required'}
                      />
                    )}
                    {(uploadedFileObj?.forensics?.level === 'flag' || uploadedFileObj?.forensics?.level === 'review') && (
                      <Badge
                        variant={uploadedFileObj.forensics.level === 'flag' ? 'danger' : 'warning'}
                        size="xs"
                        icon={ShieldAlert}
                        title={`Structural forensics: ${uploadedFileObj.forensics.summary}`}
                      >
                        {uploadedFileObj.forensics.level === 'flag' ? 'Verify source' : 'Review'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10.5px] text-gray-400 leading-snug truncate mt-0.5">
                    {hasError ? (
                      <span className="text-red-500 font-semibold">{hasError}</span>
                    ) : isUploaded ? (
                      extractionCompleted ? `${uploadedFileObj?.filename || 'Uploaded'} · ${extractedCount} field${extractedCount === 1 ? '' : 's'}` : (uploadedFileObj?.filename || 'Uploaded')
                    ) : isQueued ? (
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Queued — waiting…</span>
                    ) : isUploading ? (
                      `${jobState[type]?.stage || 'Analyzing…'} ${jobState[type]?.progress ? `(${jobState[type].progress}%)` : ''}`
                    ) : (
                      config.desc
                    )}
                  </p>
                  {isUploading && (
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden border border-gray-200 mt-1.5">
                      <div
                        className="bg-gradient-to-r from-accent-500 via-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${jobState[type]?.progress || 15}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="file"
                    ref={fileInputs[type]}
                    onChange={(e) => handleUpload(type, e.target.files[0])}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                  />

                  {hasError && (
                    <button
                      onClick={() => setError(prev => ({ ...prev, [type]: '' }))}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Dismiss error"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isUploaded && !isUploading && (
                    <>
                      <button
                        onClick={() => fetchAndShowVC(type)}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 px-1.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                        title="Inspect W3C Verifiable Credential"
                      >
                        VC ↗
                      </button>
                      <button
                        onClick={() => setExpandedJson(prev => ({ ...prev, [type]: !prev[type] }))}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        title="Inspect extracted fields"
                      >
                        {showJson ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => triggerFileInput(type)} className="btn-secondary !text-[10px] !py-1.5 !px-2.5">
                        Re-upload
                      </button>
                    </>
                  )}

                  {!isUploaded && (
                    <button
                      onClick={() => triggerFileInput(type)}
                      disabled={isUploading || isQueued}
                      className={`text-[10px] font-bold transition-all py-1.5 px-2.5 rounded-lg cursor-pointer border shrink-0 ${
                        isUploading || isQueued
                          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                          : `${config.accentBg} ${config.accentColor} ${config.accentBorder} hover:opacity-80`
                      }`}
                    >
                      {isUploading ? 'Analyzing…' : isQueued ? 'Queued…' : 'Select File'}
                    </button>
                  )}
                </div>
              </div>

              {/* Extracted Properties — expands in place under the row, its own
                  scroll if long, so opening it never disturbs other items. */}
              {isUploaded && showJson && (
                <div className={`mx-4 mb-3.5 p-3 rounded-xl ${config.accentBg} border ${config.accentBorder} max-h-48 overflow-y-auto space-y-1.5 animate-fade-in-up`}>
                  {Object.entries(config.extractedKeys).map(([key, label]) => {
                    const val = extractedData[key];
                    return (
                      <div key={key} className="flex justify-between items-start gap-2">
                        <span className="text-[10px] text-gray-500 font-semibold shrink-0">{label}</span>
                        <span className="text-[10px] text-gray-800 font-bold text-right truncate font-mono">
                          {formatValue(key, val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* W3C Verifiable Credential Inspection Modal */}
      {vcModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-gray-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">W3C Verifiable Credential (VC) v1.1</h3>
                  <p className="text-[10.5px] text-gray-400 font-medium">Interoperable National Digital Infrastructure Record</p>
                </div>
              </div>
              <button onClick={() => setVcModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80 shadow-inner">
              <pre>{JSON.stringify(vcModal.verifiable_credential || vcModal, null, 2)}</pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
              <span className="font-mono text-indigo-600 font-bold truncate max-w-[320px]">
                Issuer DID: {vcModal.verifiable_credential?.issuer?.id || 'did:polygon:amoy:0x71C7...'}
              </span>
              <button
                onClick={() => setVcModal(null)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
