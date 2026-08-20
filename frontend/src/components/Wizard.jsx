import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import {
  Building2, Users, DollarSign, Briefcase, AlertTriangle, HelpCircle,
  CheckCircle2, BookOpen, AlertCircle, FileText, Loader2,
  ChevronRight, ChevronLeft, Info, Sparkles, Lock, Plus, Trash2, Scale, TrendingUp,
  Landmark, Gavel, ClipboardList, Link2, PenLine
} from 'lucide-react';
import Badge from './ui/Badge';

// BACKEND_URL is exported from config.js as API_URL

// Sector-specific KPI field templates (SME IPO KPI disclosure — sector-dependent by design,
// mirrors backend/schema.json's kpi_sector_templates so the wizard doesn't need a schema fetch
// wired up just for this one picker; keep both in sync if a sector's KPI list changes).
const KPI_SECTOR_TEMPLATES = {
  'Manufacturing': [
    { kpi_name: 'Revenue from Operations', unit: '₹ in Cr' },
    { kpi_name: 'EBITDA', unit: '₹ in Cr' },
    { kpi_name: 'EBITDA Margin', unit: '%' },
    { kpi_name: 'PAT Margin', unit: '%' },
    { kpi_name: 'Return on Equity', unit: '%' },
    { kpi_name: 'Return on Capital Employed', unit: '%' },
    { kpi_name: 'Trade Receivable Days', unit: 'Days' },
    { kpi_name: 'Inventory Days', unit: 'Days' },
    { kpi_name: 'Trade Payable Days', unit: 'Days' },
    { kpi_name: 'Cash Conversion Cycle', unit: 'Days' },
    { kpi_name: 'Debt to Equity', unit: 'Times' },
    { kpi_name: 'Net Debt to EBITDA', unit: 'Times' },
    { kpi_name: 'Order Book', unit: '₹ in Cr' },
    { kpi_name: 'Manufacturing Area / Installed Capacity', unit: 'sq.m / units' },
  ],
  'NBFC': [
    { kpi_name: 'Loans (AUM)', unit: '₹ in Cr' },
    { kpi_name: 'Loans (AUM) Growth', unit: '%' },
    { kpi_name: 'Disbursements', unit: '₹ in Cr' },
    { kpi_name: 'Net Worth', unit: '₹ in Cr' },
    { kpi_name: 'Yield on Average Loans (AUM)', unit: '%' },
    { kpi_name: 'Average Cost of Borrowings', unit: '%' },
    { kpi_name: 'Spread', unit: '%' },
    { kpi_name: 'Net Interest Margin', unit: '%' },
    { kpi_name: 'Cost to Income Ratio', unit: '%' },
    { kpi_name: 'Gross Stage 3 (GNPA)', unit: '%' },
    { kpi_name: 'Net Stage 3 (NNPA)', unit: '%' },
    { kpi_name: 'Provision Coverage Ratio', unit: '%' },
    { kpi_name: 'CRAR', unit: '%' },
    { kpi_name: 'Debt to Equity', unit: 'Times' },
    { kpi_name: 'Return on Equity', unit: '%' },
    { kpi_name: 'Credit Rating', unit: 'Rating' },
  ],
  'Jewellery & Trading': [
    { kpi_name: 'Revenue from Operations', unit: '₹ in Cr' },
    { kpi_name: 'EBITDA Margin', unit: '%' },
    { kpi_name: 'PAT Margin', unit: '%' },
    { kpi_name: 'Return on Equity', unit: '%' },
    { kpi_name: 'Return on Capital Employed', unit: '%' },
    { kpi_name: 'Debtor Days', unit: 'Days' },
    { kpi_name: 'Creditor Days', unit: 'Days' },
    { kpi_name: 'Inventory Days', unit: 'Days' },
    { kpi_name: 'Working Capital Cycle', unit: 'Days' },
    { kpi_name: 'Inventory Turnover Ratio', unit: 'Times' },
    { kpi_name: 'Sales to Retained Customers', unit: '₹ in Cr' },
    { kpi_name: 'Ratio of Sales through Retained Customers', unit: '%' },
    { kpi_name: 'Sales Volume', unit: 'Kg' },
  ],
  'Services': [
    { kpi_name: 'Revenue from Operations', unit: '₹ in Cr' },
    { kpi_name: 'EBITDA Margin', unit: '%' },
    { kpi_name: 'PAT Margin', unit: '%' },
    { kpi_name: 'Return on Equity', unit: '%' },
    { kpi_name: 'Return on Capital Employed', unit: '%' },
    { kpi_name: 'Trade Receivable Days', unit: 'Days' },
    { kpi_name: 'Employee Attrition Rate', unit: '%' },
    { kpi_name: 'Revenue per Employee', unit: '₹ in Lakh' },
    { kpi_name: 'Client Retention Rate', unit: '%' },
    { kpi_name: 'Debt to Equity', unit: 'Times' },
  ],
};

const FY_TABLE_COLUMNS = [
  { key: 'fy', label: 'Fiscal Year', type: 'text', placeholder: 'FY26' },
  { key: 'value', label: 'Value', type: 'number', placeholder: '0.00' },
];

// Tab order mirrors backend/generator.py's actual Draft Abridged Prospectus output exactly:
// Cover Page, then the 12 numbered "salient features" sections, then a catch-all for
// statutory/coverage fields the abridged format itself never renders (PAN, GSTIN, capital
// structure, declaration, etc.) but which SEBI_REQUIREMENTS in coverage.py still tracks.
export const WIZARD_TAB_ORDER = [
  'cover', 'business', 'industry', 'promoters', 'objects', 'shareholding',
  'financials', 'kpis', 'risks', 'waca', 'board', 'auditor', 'litigation', 'compliance',
];

export const WIZARD_STEPS = [
  { id: 'cover', label: 'Cover Page', code: 'Page 1' },
  { id: 'business', label: '1. Primary Business', code: 'Sec 1' },
  { id: 'industry', label: '2. Industry Summary', code: 'Sec 2' },
  { id: 'promoters', label: '3. Promoters', code: 'Sec 3' },
  { id: 'objects', label: '4. Objects of the Offer', code: 'Sec 4' },
  { id: 'shareholding', label: '5. Shareholding', code: 'Sec 5' },
  { id: 'financials', label: '6. Financial Information', code: 'Sec 6' },
  { id: 'kpis', label: '7. Key Performance Indicators', code: 'Sec 7' },
  { id: 'risks', label: '8. Risk Factors', code: 'Sec 8' },
  { id: 'waca', label: '9. WACA', code: 'Sec 9' },
  { id: 'board', label: '10. Board & KMP', code: 'Sec 10' },
  { id: 'auditor', label: '11. Auditor Qualifications', code: 'Sec 11' },
  { id: 'litigation', label: '12. Outstanding Litigation', code: 'Sec 12' },
  { id: 'compliance', label: 'Statutory & Compliance', code: 'Extra' },
];

export default function Wizard({ formData, onChange, activeTab, onNext, onPrev, extractedData, inconsistencies }) {
  const [draftingFields, setDraftingFields] = useState({});

  // Which schema.json keys are `required: true` — drives the red-border empty-field
  // treatment below. Fetched once; schema.json doesn't change at runtime.
  const [requiredFields, setRequiredFields] = useState(() => new Set());
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/schema')
      .then(res => (res.ok ? res.json() : null))
      .then(schema => {
        if (cancelled || !schema?.sections) return;
        const keys = new Set();
        for (const section of schema.sections) {
          for (const field of section.fields || []) {
            if (field.required) keys.add(field.key);
          }
        }
        setRequiredFields(keys);
      })
      .catch(err => console.error('Failed to load schema for required-field indicators:', err));
    return () => { cancelled = true; };
  }, []);

  // Build a flat map of all extracted values for source detection
  const extractedFlat = React.useMemo(() => {
    const flat = {};
    if (extractedData) {
      for (const docType of Object.values(extractedData)) {
        if (docType && typeof docType === 'object') {
          Object.assign(flat, docType);
        }
      }
    }
    return flat;
  }, [extractedData]);

  // Maps each field key to the active SEBI compliance conflict(s) that name it
  // in their `related_fields` (see consistency_checker.py / financial_ratio_checker.py)
  // — lets a field's own input get a red border, not just the Dashboard's list.
  const fieldConflicts = React.useMemo(() => {
    const map = {};
    for (const inc of inconsistencies || []) {
      for (const key of inc.related_fields || []) {
        if (!map[key]) map[key] = [];
        map[key].push(inc);
      }
    }
    return map;
  }, [inconsistencies]);

  // `label` is the field's actual on-screen heading and `currentValue` is
  // whatever's currently typed in that textbox — both get sent to the backend
  // so it knows exactly which section it's drafting and expands on what's
  // already there instead of ignoring it and writing generic filler.
  const handleAIDraft = async (key, label, currentValue) => {
    setDraftingFields(prev => ({ ...prev, [key]: true }));
    try {
      const response = await apiFetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_key: key,
          field_label: label,
          existing_text: currentValue || '',
          form_data: formData
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.draft) onChange(key, data.draft);
      }
    } catch (err) {
      console.error('Error contacting draft API:', err);
    } finally {
      setDraftingFields(prev => ({ ...prev, [key]: false }));
    }
  };

  const [generatingRisks, setGeneratingRisks] = useState(false);

  const handleGenerateRiskFactors = async () => {
    setGeneratingRisks(true);
    try {
      const res = await apiFetch('/api/generate-risk-factors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: formData.company_name || 'Master Chains N Jewels Limited',
          industry_name: formData.industry_name || 'Specialty Chemicals',
          revenue: String((formData.revenue_from_operations && formData.revenue_from_operations[0]?.value) || '45.0'),
          issue_size: String(formData.issue_size || '18.5'),
          business_overview: formData.products_services_description || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.internal_risks && data.internal_risks.length > 0) {
          const internalStr = data.internal_risks.map((r, i) => `${i + 1}. ${r}`).join('\n\n');
          onChange('internal_risks', internalStr);
        }
        if (data.external_risks && data.external_risks.length > 0) {
          const externalStr = data.external_risks.map((r, i) => `${i + 1}. ${r}`).join('\n\n');
          onChange('external_risks', externalStr);
        }
      }
    } catch (err) {
      console.error('Failed to generate SEBI risk factors:', err);
    } finally {
      setGeneratingRisks(false);
    }
  };

  const renderTooltip = (regText) => (
    <div className="group relative inline-block ml-1.5 cursor-pointer align-middle select-none">
      <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-accent-500 transition-colors" />
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-72 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-[11.5px] font-normal leading-relaxed text-gray-200 opacity-0 shadow-2xl transition-opacity duration-200 group-hover:opacity-100 border border-gray-800">
        <div className="font-bold text-accent-400 uppercase tracking-wider mb-1.5 text-[9.5px]">SEBI ICDR Requirement</div>
        {regText}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );

  const getFieldValidation = (key, value) => {
    if (value === undefined || value === null || value === '') return { status: 'empty' };

    if (key === 'pan') {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(value)) return { status: 'error', message: 'Invalid PAN structure. Must be 5 letters, 4 digits, 1 letter (e.g. AAACA1234A).' };
      if (formData.pan_name && formData.company_name && formData.pan_name.toLowerCase() !== formData.company_name.toLowerCase()) {
        return { status: 'warning', message: 'Company name on PAN does not match RoC registered name.' };
      }
    }
    if (key === 'authorized_capital') {
      if (formData.paid_up_capital_pre && Number(formData.paid_up_capital_pre) > Number(value)) {
        return { status: 'error', message: 'Pre-Issue Paid-up Capital cannot exceed Authorized Share Capital.' };
      }
    }
    if (key === 'promoter_shareholding_pre_pct') {
      if (Number(value) < 20) return { status: 'warning', message: 'SEBI ICDR Reg 246 requires promoters to hold at least 20% post-issue. Please verify.' };
      if (Number(value) > 100) return { status: 'error', message: 'Percentage value cannot exceed 100%.' };
    }
    if (key === 'auditor_membership') {
      if (value.length < 5) return { status: 'error', message: 'Membership number appears too short — please verify.' };
    }
    const objectFields = ['expansion_amount', 'working_capital_amount', 'debt_repayment_amount', 'general_corp_amount', 'issue_expenses'];
    if (objectFields.includes(key) && formData.issue_size) {
      const sum = objectFields.reduce((acc, f) => acc + (Number(formData[f]) || 0), 0);
      if (Math.abs(sum - Number(formData.issue_size)) > 0.01) {
        return { status: 'warning', message: `Objects sum ₹${sum.toFixed(2)} Cr ≠ Issue Size ₹${Number(formData.issue_size).toFixed(2)} Cr.` };
      }
    }
    return { status: 'valid' };
  };

  /* ── Character counter helper ── */
  const CharCounter = ({ value, soft = 300, hard = 600 }) => {
    const len = (value || '').length;
    if (len === 0) return null;
    const cls = len > hard ? 'text-red-500' : len > soft ? 'text-amber-500' : 'text-gray-400';
    return (
      <span className={`text-[10px] font-mono font-semibold tabular-nums transition-colors ${cls}`}>
        {len.toLocaleString()} chars
      </span>
    );
  };

  /* ── Section sub-group header ── */
  const SubGroupHeader = ({ icon: Icon, label, note }) => (
    <div className="flex items-center gap-2 mt-6 mb-4 pb-2.5 border-b border-gray-100">
      {Icon && <Icon className="w-4 h-4 text-accent-500 shrink-0" />}
      <span className="text-[11px] font-bold uppercase tracking-widest text-accent-600">{label}</span>
      {note && <span className="text-[10.5px] text-gray-400 font-medium ml-1">{note}</span>}
    </div>
  );

  /* ── Manual-only inline note — shown instead of any AI-draft/extract affordance ── */
  const ManualNote = ({ children }) => (
    <div className="flex items-start gap-1.5 mt-1.5 mb-1 text-[11px] text-gray-400 font-medium leading-relaxed">
      <Lock className="w-3 h-3 mt-0.5 shrink-0 text-gray-300" />
      <span>{children}</span>
    </div>
  );

  /* ── Generic list/table row editor — backs every `data_type: list|table` schema field.
     `columns`: [{key,label,type,placeholder}]. Value stored as an array of row objects. ── */
  const renderRows = (key, label, tooltip, columns, opts = {}) => {
    const rows = Array.isArray(formData[key]) ? formData[key] : [];
    const { manualNote, addLabel = 'Add row' } = opts;
    const extractedRows = extractedFlat[key];
    const hasExtracted = Array.isArray(extractedRows) && extractedRows.length > 0;
    const isRequired = requiredFields.has(key);
    const showRequiredEmpty = isRequired && rows.length === 0;
    const fieldConflictList = fieldConflicts[key];
    const hasConflict = fieldConflictList && fieldConflictList.length > 0;

    const updateRow = (idx, colKey, val) => {
      const next = rows.map((r, i) => (i === idx ? { ...r, [colKey]: val } : r));
      onChange(key, next);
    };
    const addRow = () => {
      const blank = Object.fromEntries(columns.map(c => [c.key, '']));
      onChange(key, [...rows, blank]);
    };
    const removeRow = (idx) => {
      onChange(key, rows.filter((_, i) => i !== idx));
    };
    const applyExtracted = () => onChange(key, extractedRows);

    return (
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2 select-none">
          <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-0.5">
            {label}
            {isRequired && <span className="text-red-500 font-bold" title="Required">*</span>}
            {tooltip && renderTooltip(tooltip)}
          </label>
          <div className="flex items-center gap-1.5">
            {hasExtracted && (
              <Badge variant="accent" size="xs" icon={Link2} title="Rows available from an uploaded document">
                {extractedRows.length} row{extractedRows.length === 1 ? '' : 's'} extracted
              </Badge>
            )}
            {hasConflict && (
              <Badge
                variant="danger"
                size="xs"
                icon={AlertCircle}
                pulse
                title={fieldConflictList.map(c => c.title).join(' · ')}
              >
                Conflict
              </Badge>
            )}
            <span className="text-[10px] text-gray-400 font-mono font-semibold">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        {manualNote && <ManualNote>{manualNote}</ManualNote>}
        {hasExtracted && rows.length === 0 && (
          <button
            type="button"
            onClick={applyExtracted}
            className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-accent-700 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
          >
            <Link2 className="w-3 h-3" /> Use {extractedRows.length} extracted row{extractedRows.length === 1 ? '' : 's'}
          </button>
        )}

        <div className={`rounded-2xl border overflow-hidden ${(showRequiredEmpty || hasConflict) ? 'border-red-300' : 'border-gray-200'}`}>
          {rows.length === 0 ? (
            <div className="p-4 text-center text-[11.5px] text-gray-400 font-medium bg-gray-50">No entries yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <div key={idx} className="p-3 bg-white hover:bg-gray-50/60 transition-colors flex flex-wrap gap-2.5 items-end">
                  {columns.map(col => (
                    <div key={col.key} className="flex-1 min-w-[110px]">
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">{col.label}</label>
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        className="form-input-base !py-1.5 !text-[12px]"
                        placeholder={col.placeholder || ''}
                        value={row[col.key] ?? ''}
                        onChange={(e) => updateRow(idx, col.key, col.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                    title="Remove row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-accent-600 hover:text-accent-700 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      </div>
    );
  };

  const renderInput = (key, label, type = 'text', tooltip = '', placeholder = '', options = null, defaultValue = '', aiAssist = true) => {
    // defaultValue pre-fills the field with standard boilerplate text (e.g. SEBI's fixed
    // regulatory language) without writing it to formData — the generator falls back to the
    // same text server-side, so an untouched field still renders correctly. Only editing it
    // actually saves an override, which is the point: editable, but never "hardcoded until
    // the user acts" the way fabricated company data would be.
    const value = formData[key] !== undefined && formData[key] !== null ? formData[key] : defaultValue;
    const validation = getFieldValidation(key, value);
    const isTextarea = type === 'textarea';
    const isNumber = type === 'number';
    const isCheckbox = type === 'checkbox';
    // AI Assist only makes sense for freely-drafted narrative text — fixed SEBI statutory
    // boilerplate paragraphs (aiAssist=false at the call site) must stay as regulation-standard
    // wording, not something an LLM silently rewrites.
    const showAIAssist = isTextarea && aiAssist;

    // Required + still empty -> red border on the input itself, not just a badge, so a gap
    // is visible at a glance while scanning the form (checkboxes get their own visual, so
    // they're excluded rather than red-bordering the whole confirm-box).
    const isRequired = requiredFields.has(key);
    const isEmpty = value === '' || value === undefined || value === null;
    const showRequiredEmpty = isRequired && !isCheckbox && isEmpty;

    // Active SEBI compliance conflict naming this exact field (see fieldConflicts
    // above) — red-borders the input the same way a missing required field does,
    // so the conflict is visible right where you'd fix it, not just in the
    // Dashboard's conflicts list.
    const fieldConflictList = fieldConflicts[key];
    const hasConflict = !isCheckbox && fieldConflictList && fieldConflictList.length > 0;
    const requiredBorderClass = (showRequiredEmpty || hasConflict) ? '!border-red-300 focus:!border-red-400' : '';

    // Determine rows dynamically for textareas based on content
    const textLen = isTextarea ? String(value).length : 0;
    const dynamicRows = Math.max(4, Math.min(12, Math.ceil(textLen / 60) + 1));

    return (
      <div className="mb-5">
        {/* Label row */}
        <div className="flex justify-between items-center mb-2 select-none">
          <label
            htmlFor={key}
            className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
          >
            {label}
            {isRequired && <span className="text-red-500 font-bold" title="Required">*</span>}
            {tooltip && renderTooltip(tooltip)}
          </label>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Source indicator badge */}
            {(() => {
              const extractedVal = extractedFlat[key];
              const hasExtracted = extractedVal !== undefined && extractedVal !== null && extractedVal !== '';
              const currentVal = formData[key];
              const hasCurrent = currentVal !== undefined && currentVal !== null && currentVal !== '';
              if (!hasCurrent) return null;
              if (hasExtracted && String(currentVal) === String(extractedVal)) {
                return (
                  <Badge variant="accent" size="xs" icon={Link2} title="Value auto-extracted from uploaded document">
                    Auto-extracted
                  </Badge>
                );
              }
              return (
                <Badge variant="neutral" size="xs" icon={PenLine} title="Manually entered by user">
                  Manual
                </Badge>
              );
            })()}
            {/* Character counter for textareas */}
            {isTextarea && <CharCounter value={String(value)} />}

            {/* Validation badge */}
            {validation.status === 'valid' && !isCheckbox && (
              <Badge variant="success" size="xs" icon={CheckCircle2}>Passed</Badge>
            )}
            {validation.status === 'warning' && (
              <Badge variant="warning" size="xs" icon={AlertTriangle} title={validation.message}>Advisory</Badge>
            )}
            {validation.status === 'error' && (
              <Badge variant="danger" size="xs" icon={AlertCircle} title={validation.message}>Error</Badge>
            )}

            {/* SEBI compliance conflict naming this field — see fieldConflicts above */}
            {hasConflict && (
              <Badge
                variant="danger"
                size="xs"
                icon={AlertCircle}
                pulse
                title={fieldConflictList.map(c => c.title).join(' · ')}
              >
                Conflict
              </Badge>
            )}

            {/* AI Assist button for freely-drafted narrative textareas */}
            {showAIAssist && (
              <button
                type="button"
                onClick={() => handleAIDraft(key, label, value)}
                disabled={draftingFields[key]}
                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-accent-700 hover:text-accent-800 transition-all cursor-pointer bg-accent-50 hover:bg-accent-100 border border-accent-200 hover:border-accent-300 px-2 py-0.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {draftingFields[key] ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /><span>Drafting…</span></>
                ) : (
                  <><Sparkles className="w-3 h-3" /><span>AI Assist</span></>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Input element */}
        {isTextarea ? (
          <div className="relative">
            <textarea
              id={key}
              rows={dynamicRows}
              className={`form-input-base ${requiredBorderClass}`}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(key, e.target.value)}
            />
            {/* Subtle left filled indicator */}
            {value && (
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-accent-400/30 pointer-events-none" />
            )}
          </div>
        ) : type === 'select' ? (
          <select
            id={key}
            className={`form-input-base ${requiredBorderClass}`}
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
          >
            <option value="">Select option…</option>
            {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : isCheckbox ? (
          <div className="flex items-start gap-3 mt-1 p-4 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:border-accent-200 hover:bg-accent-50/30 transition-all">
            <input
              id={key}
              type="checkbox"
              className="h-4 w-4 mt-0.5 rounded border-gray-300 text-accent-500 focus:ring-accent-500 cursor-pointer shrink-0"
              checked={!!value}
              onChange={(e) => onChange(key, e.target.checked)}
            />
            <label htmlFor={key} className="text-[13px] text-gray-600 font-medium cursor-pointer leading-relaxed">
              {placeholder || 'Confirm and agree'}
            </label>
          </div>
        ) : (
          <input
            id={key}
            type={type}
            className={`form-input-base ${isNumber ? 'font-mono text-right tracking-wider' : ''} ${requiredBorderClass}`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(key, type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
          />
        )}

        {/* Validation message */}
        {(validation.status === 'error' || validation.status === 'warning') && (
          <p className={`text-[11.5px] font-semibold mt-1.5 leading-normal flex items-center gap-1.5 ${
            validation.status === 'error' ? 'text-red-600' : 'text-amber-600'
          }`}>
            {validation.status === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            {validation.message}
          </p>
        )}
      </div>
    );
  };

  const has_promoter = (Array.isArray(formData.promoters) && formData.promoters.length > 0) || (Array.isArray(formData.promoter_names) && formData.promoter_names.length > 0);

  /* ── Audit Preview Panel Content — mirrors the actual generator.py section this tab feeds ── */
  const getAuditPreviewDetails = () => {
    const fd = formData;
    switch (activeTab) {
      case 'cover': return {
        title: 'Cover Page — Regulations',
        reg: 'SEBI ICDR Sch VI Part A: cover page must state registered office, contact particulars, promoters (or professionally-managed statement), offer mechanics, BRLM/Registrar, and the Bid/Offer Period.',
        previewText: `${(fd.company_name || '[COMPANY NAME]').toUpperCase()}\n${fd.former_name ? `(Formerly ${fd.former_name})\n` : ''}CIN: ${fd.cin || '[●]'}\n\nRegistered Office: ${fd.registered_office || '[●]'}\nContact: ${fd.company_secretary_name || '[●]'} | ${fd.contact_email || '[●]'}\n\n${has_promoter ? 'OUR PROMOTERS: ' + (Array.isArray(fd.promoters) && fd.promoters.length ? fd.promoters.map(p => p.name).join(', ') : (fd.promoter_names || []).map(p => p.name).join(', ')) : 'OUR COMPANY IS A PROFESSIONALLY MANAGED COMPANY AND DOES NOT HAVE AN IDENTIFIABLE PROMOTER'}\n\nFresh Issue: ₹${fd.fresh_issue_size_cr || '[●]'} Cr\nLead Manager: ${fd.lead_manager || '[●]'}\nRegistrar: ${fd.registrar || '[●]'}`
      };
      case 'business': return {
        title: '1. Summary of Primary Business',
        reg: 'SEBI ICDR Sch VI Part A, Para 4(a)-(g): products/services, industries served, segment reporting, geographies, top-5 customer concentration, facilities, strengths & strategies.',
        previewText: `1. SUMMARY OF PRIMARY BUSINESS\n\na) ${fd.products_services_description ? fd.products_services_description.slice(0, 160) + '…' : '[Business overview pending…]'}\n\nb) Industries served: ${fd.industries_served || '[●]'}\n\nd) Geographies: ${fd.key_geographies_served || '[●]'}\n\ne) Top-5 customer rows: ${Array.isArray(fd.top5_customer_revenue_table) ? fd.top5_customer_revenue_table.length : 0}`
      };
      case 'industry': return {
        title: '2. Summary of Industry',
        reg: 'SEBI ICDR Sch VI Part A — Industry Overview must cite a named third-party report (CRISIL/CARE/ICRA) and its key market-size/CAGR figures.',
        previewText: `2. SUMMARY OF INDUSTRY\n\nSource: ${fd.industry_report_source || '[●]'}\nMarket Size: ${fd.industry_market_size || '[●]'}\nCAGR: ${fd.industry_cagr || '[●]'}\n\n${fd.industry_growth_narrative || '[Growth narrative pending…]'}`
      };
      case 'promoters': return {
        title: '3. Promoters',
        reg: 'SEBI ICDR Sch VI Part A, Para 8(a) & Reg 2(1)(pp) — full promoter profiles, or an explicit "no identifiable promoter" statement for professionally-managed issuers.',
        previewText: `3. PROMOTERS\n\n${Array.isArray(fd.promoters) && fd.promoters.length ? fd.promoters.map(p => `${p.name} — ${p.designation || ''}`).join('\n') : 'Our Company is a professionally managed company and does not have an identifiable promoter.'}`
      };
      case 'objects': return {
        title: '4. Objects of the Offer',
        reg: 'SEBI ICDR Reg 230 — itemized use of proceeds; General Corporate Purposes capped at 25% of Gross Proceeds under Reg 230(2).',
        previewText: `4. OBJECTS OF THE OFFER\n\n${(fd.use_of_proceeds || []).map(r => `${r.particular}: ₹${r.estimated_amount_cr} Cr`).join('\n') || '[●]'}\n\nGCP: ₹${fd.general_corp_amount || '0.00'} Cr`
      };
      case 'shareholding': return {
        title: '5. Pre-Offer Shareholding',
        reg: 'SEBI ICDR — pre-offer shareholding of Promoters, Promoter Group, and top shareholders, drawn from the Register of Members / cap table.',
        previewText: `5. PRE-OFFER SHAREHOLDING\n\n${(fd.pre_offer_shareholding || []).map(r => `${r.shareholder}: ${r.pct}%`).join('\n') || '[●]'}`
      };
      case 'financials': return {
        title: '6. Summary of Restated Financial Information',
        reg: 'SEBI ICDR Reg 229 — 3-year restated financials: net worth, revenue, EBITDA, PAT, EPS, RoNW, NAV, borrowings, cash flows.',
        previewText: `6. RESTATED FINANCIAL INFORMATION\n\nNet Worth (latest): ${(fd.net_worth && fd.net_worth[0]) ? '₹' + fd.net_worth[0].value + ' Cr' : '[●]'}\nRevenue (latest): ${(fd.revenue_from_operations && fd.revenue_from_operations[0]) ? '₹' + fd.revenue_from_operations[0].value + ' Cr' : '[●]'}\nPAT (latest): ${(fd.pat && fd.pat[0]) ? '₹' + fd.pat[0].value + ' Cr' : '[●]'}`
      };
      case 'kpis': return {
        title: '7. Summary of Key Performance Indicators',
        reg: 'SEBI KPI Disclosure Circular — sector-dependent KPI set (NBFC/Manufacturing/Jewellery & Trading/Services differ materially), 3-year values.',
        previewText: `7. KEY PERFORMANCE INDICATORS\n\nSector Template: ${fd.kpi_sector || '[Not selected]'}\nKPI Rows: ${Array.isArray(fd.kpi_values) ? fd.kpi_values.length : 0}`
      };
      case 'risks': return {
        title: '8. Risk Factors',
        reg: 'SEBI ICDR Sch VI Part A/C — internal and external risk factors, banker-reviewed before filing.',
        previewText: `8. RISK FACTORS\n\n${fd.risk_narrative_text || fd.internal_risks || '[Risk factors pending…]'}`
      };
      case 'waca': return {
        title: '9. Weighted Average Cost of Acquisition',
        reg: 'SEBI ICDR Sch VI Part A — Capital Structure: WACA per promoter/selling shareholder, must reference a dated CA certificate.',
        previewText: `9. WACA\n\n${(fd.waca_table || []).map(r => `${r.shareholder}: ₹${r.waca_per_share}/share`).join('\n') || '[●]'}\n\nCA Certificate dated: ${fd.waca_ca_certificate_date || '[●]'}`
      };
      case 'board': return {
        title: '10. Board of Directors and KMP',
        reg: 'Companies Act 2013 Sec 149 & 203 — minimum 3 directors (1 independent) for a public company, plus Key Managerial Personnel.',
        previewText: `10. BOARD OF DIRECTORS AND KMP\n\n${(fd.directors || []).map(d => `${d.name} — ${d.designation}`).join('\n') || '[●]'}\n\nKMP: ${(fd.kmp || []).map(k => k.name).join(', ') || '[●]'}`
      };
      case 'auditor': return {
        title: '11. Auditor Qualifications',
        reg: 'SEBI ICDR Sch VI Part A — any reservations, qualifications, or adverse remarks by statutory auditors on the restated financials.',
        previewText: `11. AUDITOR QUALIFICATIONS\n\n${fd.auditor_qualifications || 'There have been no reservations, qualifications and adverse remarks in the Restated Financial Information.'}`
      };
      case 'litigation': return {
        title: '12. Summary Table of Outstanding Litigation',
        reg: 'SEBI ICDR Sch VI Part A, Para 9(a) & Materiality Policy — structured litigation table across Company/Directors/Promoters/KMP/Senior Management.',
        previewText: `12. OUTSTANDING LITIGATION\n\n${(fd.litigation_summary || []).map(r => `${r.entity_type}: Criminal ${r.criminal_count || 0}, Tax ${r.tax_count || 0}, Civil ${r.civil_litigation_count || 0}`).join('\n') || '[●]'}`
      };
      case 'compliance': default: return {
        title: 'Statutory & Compliance Tracking',
        reg: 'Fields tracked for SEBI ICDR filing-readiness scoring that the Abridged Prospectus summary itself does not render (they belong in the full DRHP / statutory filings).',
        previewText: `PAN: ${fd.pan || '[●]'}\nGSTIN: ${fd.gstin || '[●]'}\nAuthorized Capital: ₹${fd.authorized_capital || '[●]'} Cr\nPre-Issue Paid-up Capital: ₹${fd.paid_up_capital_pre || '[●]'} Cr\n\nDeclaration Signed: ${fd.declaration_signed ? 'YES ✓' : 'PENDING'}`
      };
    }
  };

  const auditDetails = getAuditPreviewDetails();

  const sectionTitles = Object.fromEntries(WIZARD_STEPS.map(s => [s.id, s.label]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">

      {/* ── Left: Form (8 cols) ── */}
      <div className="lg:col-span-8 bg-white rounded-2xl shadow-card border border-gray-100">

        {/* Section header */}
        <div className="px-7 pt-6 pb-5 border-b border-gray-100">
          <h2 className="text-[19px] font-display font-700 text-gray-900 tracking-tight">{sectionTitles[activeTab]}</h2>
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">Mirrors the Draft Abridged Prospectus output section-for-section</p>
        </div>

        {/* Form body */}
        <div className="px-7 py-6">

          {/* ═══ COVER PAGE ═══ */}
          {activeTab === 'cover' && (
            <div>
              {renderInput('company_name', 'Company Name', 'text', 'SEBI ICDR Sch VI Part A — Exact registered corporate name as per RoC Certificate of Incorporation.', 'e.g. Master Chains N Jewels Limited')}
              {renderInput('former_name', 'Former Name(s), if applicable', 'text', 'Prior registered name(s) per RoC/CIN history.', 'e.g. Master Chains N Jewels Private Limited')}
              {renderInput('cin', 'CIN Number', 'text', 'Companies Act 2013 Sec 7(1) — Corporate Identification Number (21 alphanumeric characters) as assigned by RoC.', 'U74999MH2018PLC312456')}
              {renderInput('company_acronym', 'Company Acronym', 'text', 'Short form used throughout the prospectus.', 'e.g. VSCL')}

              <SubGroupHeader icon={Building2} label="Registered Office & Contact" note="SEBI ICDR Sch VI Part A, Para 1(c)" />
              {renderInput('registered_office', 'Registered Office Address', 'text', 'Companies Act 2013 Sec 12 — Official address registered with ROC. All statutory correspondence is served here.', 'e.g. Plot 42, GIDC Industrial Area, Vapi, Gujarat')}
              {renderInput('company_secretary_name', 'Company Secretary / Compliance Officer', 'text', 'Named contact person on the cover page for investor correspondence.', 'e.g. Priya Shah')}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('contact_email', 'Contact Email', 'text', 'Compliance officer email printed on the cover page.', 'e.g. compliance@yourcompany.com')}
                {renderInput('contact_phone', 'Contact Telephone', 'text', 'Compliance officer telephone printed on the cover page.', 'e.g. +91 22 4000 1234')}
              </div>
              {renderInput('company_website', 'Company Website', 'text', 'Corporate website URL.', 'e.g. www.yourcompany.com')}
              <ManualNote>Business decision — enter the company's own website. Cannot be auto-filled from any statutory document.</ManualNote>

              {renderRows('promoter_names', 'Promoter Names (Cover Page Banner)', "SEBI ICDR Sch VI Part A, Para 1(d) — names of all promoters as they appear on the cover page banner. Leave empty if the company has no identifiable promoter.",
                [{ key: 'name', label: 'Promoter Name', type: 'text', placeholder: 'e.g. Rajesh Kumar' }],
                { addLabel: 'Add promoter name' })}

              <SubGroupHeader icon={DollarSign} label="Details of the Offer" note="SEBI ICDR Reg 226 — fresh issue / OFS split" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
                {renderInput('fresh_issue_size_cr', 'Fresh Issue Size (₹ Crores)', 'number', 'Business decision — target fresh issue size.', '18.5')}
                {renderInput('ofs_size_cr', 'Offer for Sale Size (₹ Crores)', 'number', 'Business decision — aggregate OFS size, if any.', '4.0')}
                {renderInput('face_value_per_share', 'Face Value per Share (₹)', 'number', 'Face value of each equity share per MOA/AOA.', '10')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('issue_size', 'Total Offer Size (₹ Crores)', 'number', 'SEBI ICDR Reg 229(1) — Post-issue paid-up capital must not exceed ₹25 Cr for SME platform listing.', '25.0')}
                {renderInput('price_band', 'Price Band (₹)', 'text', 'SEBI ICDR Reg 246(1) — Price band spread must be within 20% of the floor price. (Statutory tracking only — not shown in the Abridged Prospectus, which uses [●].)', '100 - 105')}
              </div>
              <ManualNote>Fresh issue size, OFS size, and any Pre-IPO placement are business decisions — enter your target figures yourself.</ManualNote>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('pre_ipo_placement_amount', 'Pre-IPO Placement Amount (₹ Crores)', 'number', 'Proposed Pre-IPO placement size, if any (max 20% of Fresh Issue).', '0')}
                {renderInput('pre_ipo_placement_terms', 'Pre-IPO Placement Terms', 'text', 'Pricing basis and conditions of the Pre-IPO placement, if undertaken.', 'e.g. Not undertaken')}
              </div>
              {renderRows('selling_shareholders', 'Details of the Offer for Sale by Selling Shareholders', 'SEBI ICDR Sch VI — Offer for Sale details per selling shareholder.',
                [
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'type', label: 'Type', type: 'text', placeholder: 'Promoter/Investor/Individual' },
                  { key: 'shares_offered', label: 'Shares Offered', type: 'number' },
                  { key: 'waca_per_share', label: 'WACA / Share (₹)', type: 'number' },
                ],
                { addLabel: 'Add selling shareholder' })}

              <SubGroupHeader icon={AlertTriangle} label="Cover Page Legal Disclosures" note="Standard SEBI ICDR boilerplate — pre-filled, edit as needed" />
              {renderInput('risks_first_offer_text', 'Risks in Relation to the First Offer', 'textarea',
                'SEBI ICDR Sch VI Part A — standard first-offer risk disclosure. Pre-filled with regulation-standard wording; edit if legal counsel requires different phrasing.',
                '', null,
                `This being the first public issue of Equity Shares of our Company, there has been no formal market for the Equity Shares. The face value of each Equity Share is ₹${formData.face_value_per_share || '[●]'}. The Offer Price, Floor Price and the Cap Price determined by our Company in consultation with the book running lead manager (“BRLM”), in accordance with the SEBI ICDR Regulations and on the basis of the assessment of market demand for the Equity Shares by way of the Book Building Process, as stated in “Basis for Offer Price” beginning on page [●] of the Draft Red Herring Prospectus, should not be considered to be indicative of the market price of the Equity Shares after the Equity Shares are listed. No assurance can be given regarding an active and/or sustained trading in the Equity Shares or regarding the price at which the Equity Shares will be traded after listing.`,
                false)}

              {renderInput('general_risk_text', 'General Risk', 'textarea',
                'SEBI ICDR Sch VI Part A — standard general investment risk disclosure. Pre-filled with regulation-standard wording; edit if legal counsel requires different phrasing.',
                '', null,
                `Investments in equity and equity-related securities involve a degree of risk and investors should not invest any funds in this Offer unless they can afford to take the risk of losing their entire investment. Bidders are advised to read the risk factors carefully before taking an investment decision in this Offer. For taking an investment decision, Bidders must rely on their own examination of our Company and the Offer, including the risks involved. The Equity Shares in the Offer have neither been recommended nor approved by Securities and Exchange Board of India (“SEBI”), nor does SEBI guarantee the accuracy or adequacy of the contents of the Draft Red Herring Prospectus. Specific attention of the Bidders is invited to “Risk Factors” beginning on page [●] of the Draft Red Herring Prospectus.`,
                false)}

              {renderInput('company_responsibility_text', "Company's / Selling Shareholders' Absolute Responsibility", 'textarea',
                "SEBI ICDR Sch VI Part A — standard issuer/selling-shareholder responsibility statement. The banner title above this text adjusts automatically based on whether selling shareholders are entered above; only the paragraph body is edited here.",
                '', null,
                `Our Company, having made all reasonable inquiries, accepts responsibility for and confirms that the Draft Red Herring Prospectus contains all information with regard to our Company and the Offer, which is material in the context of the Offer, that the information contained in the Draft Red Herring Prospectus is true and correct in all material aspects and is not misleading in any material respect, that the opinions and intentions expressed herein are honestly held and that there are no other facts, the omission of which makes the Draft Red Herring Prospectus as a whole or any of such information or the expression of any such opinions or intentions misleading in any material respect.`,
                false)}

              {renderInput('listing_text', 'Listing', 'textarea',
                'SEBI ICDR Sch VI Part A — standard stock exchange listing statement. Pre-filled with regulation-standard wording; edit if the designated stock exchange or listing venues differ.',
                '', null,
                `The Equity Shares to be offered through Red Herring Prospectus are proposed to be listed on the BSE Limited (the “BSE”) and National Stock Exchange of India Limited (the “NSE”, and together with BSE, the “Stock Exchanges”). For the purposes of this Offer, the Designated Stock Exchange shall be [●].`,
                false)}

              <SubGroupHeader icon={Briefcase} label="Book Running Lead Manager & Registrar" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('lead_manager', 'Lead Manager Name', 'text', 'SEBI ICDR Reg 232 — SEBI-registered Category I Merchant Banker appointed to manage the issue.', 'e.g. BlueSky Capital Advisors Limited')}
                {renderInput('registrar', 'Registrar to the Issue', 'text', 'SEBI ICDR Reg 232 — SEBI-registered registrar to maintain share records and process applications.', 'e.g. Link Intime India Private Limited')}
              </div>
            </div>
          )}

          {/* ═══ 1. BUSINESS ═══ */}
          {activeTab === 'business' && (
            <div>
              {renderInput('products_services_description', 'a) Business Overview — Products and Services', 'textarea', 'SEBI ICDR Sch VI Part A, Para 4(a) — Detailed product SKU profiles, services offered, quality certifications held.', 'Detail product lines, technical specifications, quality certifications…')}

              <SubGroupHeader icon={Building2} label="b) Industries Served & Typical Customers" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('industries_served', 'Industries Served', 'textarea', "Sectors/industries the company's customers belong to.", 'e.g. Automotive coatings, Packaging')}
                {renderInput('typical_customers', 'Typical Customers', 'text', 'Description of the typical customer profile served.', 'e.g. Single-store and multi-store retailers')}
              </div>

              <SubGroupHeader icon={FileText} label="c) Segment Reporting & Revenue Contribution" />
              <div className="flex items-start gap-3 mt-1 mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <input
                  id="segment_reporting_applicable"
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-accent-500 focus:ring-accent-500 cursor-pointer shrink-0"
                  checked={!!formData.segment_reporting_applicable}
                  onChange={(e) => onChange('segment_reporting_applicable', e.target.checked)}
                />
                <div className="flex-1">
                  <label htmlFor="segment_reporting_applicable" className="text-[13px] text-gray-700 font-semibold cursor-pointer">Segment reporting applicable under Ind AS 108</label>
                  <input
                    className="form-input-base mt-2 !text-[12px]"
                    placeholder="Note, e.g. 'Single reportable segment — lending to borrowers'"
                    value={formData.segment_reporting_note || ''}
                    onChange={(e) => onChange('segment_reporting_note', e.target.value)}
                  />
                </div>
              </div>

              <SubGroupHeader icon={Building2} label="d) Key Geographies Served" />
              {renderInput('key_geographies_served', 'Key Geographies Served', 'textarea', 'Primary states/regions/countries generating revenue.', 'e.g. Maharashtra, Gujarat, Karnataka')}

              <SubGroupHeader icon={TrendingUp} label="e) Revenue Concentration Among Top 5 Customers" />
              {renderRows('top5_customer_revenue_table', 'Top-5 Customer Revenue Concentration (3-Year)', 'SEBI ICDR — revenue concentration among top customers over 3 fiscal years.',
                [
                  { key: 'customer_name', label: 'Customer', type: 'text' },
                  { key: 'fy1_revenue', label: 'FY (latest) ₹Cr', type: 'number' },
                  { key: 'fy1_pct', label: 'FY (latest) %', type: 'number' },
                  { key: 'fy2_revenue', label: 'FY-1 ₹Cr', type: 'number' },
                  { key: 'fy2_pct', label: 'FY-1 %', type: 'number' },
                  { key: 'fy3_revenue', label: 'FY-2 ₹Cr', type: 'number' },
                  { key: 'fy3_pct', label: 'FY-2 %', type: 'number' },
                ],
                { addLabel: 'Add customer row' })}

              <SubGroupHeader icon={Building2} label="f) Key Manufacturing or Other Facilities" />
              {renderRows('manufacturing_facility_locations', 'Manufacturing/Facility Locations', "Leave empty and it will read 'does not own or operate any manufacturing facilities' for NBFCs/services businesses.",
                [
                  { key: 'type', label: 'Type', type: 'text', placeholder: 'Manufacturing Unit / Branch Office' },
                  { key: 'location', label: 'Location (city/area)', type: 'text' },
                ],
                { addLabel: 'Add location' })}

              <SubGroupHeader icon={Sparkles} label="g) Business Strengths and Strategies" />
              {renderRows('business_strengths', 'Business Strengths', 'Competitive strengths narrative.',
                [{ key: 'strength', label: 'Strength', type: 'text' }],
                { manualNote: 'Positioning/marketing judgment call — cannot be extracted from any document.', addLabel: 'Add strength' })}
              {renderRows('business_strategies', 'Business Strategies', 'Forward-looking strategy narrative.',
                [{ key: 'strategy', label: 'Strategy', type: 'text' }],
                { manualNote: 'Business/board decision — cannot be extracted from any document.', addLabel: 'Add strategy' })}
            </div>
          )}

          {/* ═══ 2. INDUSTRY ═══ */}
          {activeTab === 'industry' && (
            <div>
              {renderInput('industry_name', 'Industry / Sector Name', 'text', 'Standard sector classification (e.g. NIC code category).', 'e.g. Speciality Chemicals')}
              {renderInput('industry_report_source', 'Industry Report Source', 'text', 'Name of the CRISIL/CARE/ICRA (or similar) report commissioned and cited.', 'e.g. CRISIL Report, July 2026')}
              <ManualNote>Commercial/legal decision — which agency's report was commissioned. Cannot be auto-filled.</ManualNote>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('industry_market_size', 'Industry Market Size', 'text', 'Best-effort extraction from the industry report PDF; formats vary widely — confidence flagged low.', 'e.g. ₹221.88 trillion (Fiscal 2026)')}
                {renderInput('industry_cagr', 'Industry CAGR (%)', 'text', 'Best-effort extraction from the industry report PDF; confidence flagged low.', 'e.g. 15.01%')}
              </div>
              {renderInput('industry_growth_narrative', 'Industry Growth Narrative', 'textarea', 'Narrative synthesis of industry trends.', 'Describe demand drivers, competitive landscape, growth outlook…')}
            </div>
          )}

          {/* ═══ 3. PROMOTERS ═══ */}
          {activeTab === 'promoters' && (
            <div>
              <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Professionally-Managed Companies</span>
                </div>
                <p className="text-[12.5px] text-blue-600 leading-relaxed">Leave this list empty if the company has no identifiable promoter per SEBI ICDR Reg 2(1)(pp) — the Abridged Prospectus will automatically state "does not have an identifiable promoter" instead.</p>
              </div>
              {renderRows('promoters', 'Promoters', 'Full promoter profiles: designation, DIN, tenure, qualification, experience.',
                [
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'designation', label: 'Designation', type: 'text' },
                  { key: 'din', label: 'DIN', type: 'text' },
                  { key: 'date_associated_since', label: 'Associated Since', type: 'text', placeholder: 'YYYY-MM-DD' },
                  { key: 'education_qualification', label: 'Education', type: 'text' },
                  { key: 'years_experience', label: 'Years Experience', type: 'number' },
                  { key: 'biography_narrative', label: 'Biography Narrative', type: 'text' },
                ],
                { manualNote: 'Years of experience and biography narrative are manual judgment calls — DIN/designation/tenure are normally extracted from DIR-12 filings.', addLabel: 'Add promoter' })}
            </div>
          )}

          {/* ═══ 4. OBJECTS OF THE OFFER ═══ */}
          {activeTab === 'objects' && (
            <div>
              <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Itemized Use of Proceeds</span>
                </div>
                <p className="text-[12.5px] text-blue-600 leading-relaxed">General Corporate Purposes is capped at 25% of Gross Proceeds per SEBI ICDR Reg 230(2).</p>
              </div>
              {renderRows('use_of_proceeds', 'Use of Proceeds (Itemized)', 'Full itemized breakdown of Net Proceeds deployment.',
                [
                  { key: 'particular', label: 'Particular', type: 'text' },
                  { key: 'estimated_amount_cr', label: 'Estimated Amount (₹ Cr)', type: 'number' },
                ],
                { manualNote: 'Business decision — itemized deployment plan cannot be extracted from any document.', addLabel: 'Add line item' })}

              {renderInput('general_corp_amount', 'General Corporate Purposes (₹ Crores)', 'number', 'SEBI ICDR Reg 230(2) — General corporate purposes capped at 25% of Gross Proceeds.', '2.0')}

              {(() => {
                const gross = Number(formData.fresh_issue_size_cr) || Number(formData.issue_size) || 0;
                const gcp = Number(formData.general_corp_amount) || 0;
                const capAmount = gross * 0.25;
                const withinCap = gross === 0 || gcp <= capAmount + 0.01;
                return (
                  <div className={`mt-1 p-4 rounded-xl border flex justify-between items-center ${withinCap ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <span className={`text-[12px] font-semibold ${withinCap ? 'text-emerald-700' : 'text-red-600'}`}>
                      GCP Validation (Reg 230(2)) — capped at 25% of Gross Proceeds
                    </span>
                    <span className={`font-mono font-bold text-[13px] ${withinCap ? 'text-emerald-700' : 'text-red-600'}`}>
                      ₹{gcp.toFixed(2)} Cr {withinCap ? '≤' : '>'} ₹{capAmount.toFixed(2)} Cr cap
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ 5. SHAREHOLDING ═══ */}
          {activeTab === 'shareholding' && (
            <div>
              {renderRows('pre_offer_shareholding', 'Pre-Offer Shareholding', 'Full pre-offer cap table by shareholder.',
                [
                  { key: 'shareholder', label: 'Shareholder', type: 'text' },
                  { key: 'shares', label: 'No. of Shares', type: 'number' },
                  { key: 'pct', label: '% of Capital', type: 'number' },
                ],
                { addLabel: 'Add shareholder' })}
              {renderRows('promoter_group_members', 'Promoter Group Members', 'SEBI ICDR Reg 2(1)(pp) — immediate relatives and entities forming the Promoter Group.',
                [
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'relationship', label: 'Relationship to Promoter', type: 'text' },
                ],
                { addLabel: 'Add promoter group member' })}
              {renderInput('esop_details', 'ESOP Details', 'textarea', 'Scheme reference and vesting schedule for any Employee Stock Option Plan.', "e.g. No ESOP scheme in force — OR — describe scheme reference and vesting schedule.")}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-[11.5px] text-gray-500 leading-relaxed">
                Post-Offer shareholding is derived automatically once the Offer Price and Basis of Allotment are finalized — no separate input needed.
              </div>
            </div>
          )}

          {/* ═══ 6. FINANCIALS ═══ */}
          {activeTab === 'financials' && (
            <div>
              <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Restated 3-Year Financials</span>
                </div>
                <p className="text-[12.5px] text-blue-600 leading-relaxed">Each table below holds one row per fiscal year (latest first). Populated primarily from restated audited financial statements.</p>
              </div>

              {renderRows('equity_share_capital', 'Equity Share Capital (₹ Cr)', 'Restated equity share capital across 3 fiscal years.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('net_worth', 'Net Worth (₹ Cr)', 'SEBI ICDR Reg 229(2) — latest audited net worth, 3-year restated.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('revenue_from_operations', 'Revenue from Operations (₹ Cr)', '3-year restated revenue from operations.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('ebitda', 'EBITDA (₹ Cr)', 'SEBI ICDR Reg 229(1)(b) — EBITDA operating profit track record, 3-year restated.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('pat', 'Restated Profit After Tax (₹ Cr)', '3-year restated Profit After Tax.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                <div>{renderRows('eps_basic', 'Basic EPS (₹)', 'Restated basic earnings per equity share, 3-year.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}</div>
                <div>{renderRows('eps_diluted', 'Diluted EPS (₹)', 'Restated diluted earnings per equity share, 3-year.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                <div>{renderRows('ronw_pct', 'Return on Net Worth (%)', 'PAT ÷ Net Worth, 3-year restated.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}</div>
                <div>{renderRows('nav_per_share', 'NAV per Share (₹)', 'Net Worth ÷ number of equity shares outstanding, 3-year restated.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}</div>
              </div>
              {renderRows('total_borrowings', 'Total Borrowings (₹ Cr)', 'SEBI ICDR Sch VI Part B — 3-year restated total borrowings.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('trade_receivables', 'Trade Receivables (₹ Cr)', 'Restated balance sheet — trade receivables / sundry debtors, 3-year.', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}

              <SubGroupHeader icon={DollarSign} label="Cash Flow Statement (3-Year)" />
              {renderRows('cash_flow_operating', 'Net Cash from Operating Activities (₹ Cr)', '', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('cash_flow_investing', 'Net Cash from Investing Activities (₹ Cr)', '', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
              {renderRows('cash_flow_financing', 'Net Cash from Financing Activities (₹ Cr)', '', FY_TABLE_COLUMNS, { addLabel: 'Add year' })}
            </div>
          )}

          {/* ═══ 7. KPIs ═══ */}
          {activeTab === 'kpis' && (
            <div>
              <SubGroupHeader icon={TrendingUp} label="Key Performance Indicators" note="Sector-dependent — select a template before entering values" />
              <div className="mb-4">
                <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">KPI Sector Template</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(KPI_SECTOR_TEMPLATES).map(sector => (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => {
                        onChange('kpi_sector', sector);
                        // Swap in the matching template's KPI rows, preserving any values already
                        // entered against KPI names that also exist in the newly selected sector.
                        const existing = Array.isArray(formData.kpi_values) ? formData.kpi_values : [];
                        const byName = Object.fromEntries(existing.map(r => [r.kpi_name, r]));
                        const nextRows = KPI_SECTOR_TEMPLATES[sector].map(t => ({
                          kpi_name: t.kpi_name,
                          unit: t.unit,
                          fy1_value: byName[t.kpi_name]?.fy1_value ?? '',
                          fy2_value: byName[t.kpi_name]?.fy2_value ?? '',
                          fy3_value: byName[t.kpi_name]?.fy3_value ?? '',
                        }));
                        onChange('kpi_values', nextRows);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                        formData.kpi_sector === sector
                          ? 'bg-accent-500 text-white border-accent-500 shadow-accent'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-accent-200 hover:text-accent-600'
                      }`}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
                <ManualNote>Business classification decision — determines which KPI field set applies. NBFC KPIs differ fundamentally from manufacturing/jewellery KPIs, so no single universal list is offered.</ManualNote>
              </div>

              {formData.kpi_sector ? (
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {(Array.isArray(formData.kpi_values) ? formData.kpi_values : []).map((row, idx) => (
                      <div key={idx} className="p-3 bg-white flex flex-wrap gap-2.5 items-end">
                        <div className="flex-[2] min-w-[160px]">
                          <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">KPI ({row.unit})</label>
                          <div className="text-[12.5px] font-semibold text-gray-700 py-1.5">{row.kpi_name}</div>
                        </div>
                        {['fy1_value', 'fy2_value', 'fy3_value'].map((col, ci) => (
                          <div key={col} className="flex-1 min-w-[90px]">
                            <label className="block text-[9.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">{['FY (latest)', 'FY-1', 'FY-2'][ci]}</label>
                            <input
                              type="number"
                              className="form-input-base !py-1.5 !text-[12px]"
                              value={row[col] ?? ''}
                              onChange={(e) => {
                                const next = (formData.kpi_values || []).map((r, i) => i === idx ? { ...r, [col]: e.target.value === '' ? '' : parseFloat(e.target.value) } : r);
                                onChange('kpi_values', next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-[11.5px] text-gray-400 font-medium bg-gray-50 rounded-xl border border-gray-200">Select a sector template above to enter KPI values.</div>
              )}
            </div>
          )}

          {/* ═══ 8. RISK FACTORS ═══ */}
          {activeTab === 'risks' && (
            <div>
              {/* Auto-Generate Risk Factors AI Banner */}
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-purple-950">SEBI ICDR Risk Factor AI Generator</h4>
                    <p className="text-[11.5px] text-purple-700 mt-0.5 leading-relaxed">
                      Auto-generate company-specific, quantified Internal and External Risk Factors conforming to Chapter IX & Schedule VI Part A.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateRiskFactors}
                  disabled={generatingRisks}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {generatingRisks ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                      <span>Drafting SEBI Risks...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Auto-Generate Risk Factors</span>
                    </>
                  )}
                </button>
              </div>

              {renderInput('internal_risks', 'Internal Risk Factors', 'textarea', 'SEBI ICDR Sch VI Part C — Specific company operational risks, customer dependencies, and key-person risks.', 'List key internal risks, e.g.:\n1. Dependency on key raw materials…\n2. Customer concentration risk…')}
              {renderInput('external_risks', 'External Risk Factors', 'textarea', 'SEBI ICDR Sch VI Part C — Sector legal rules, economic, currency, and market risks affecting the business.', 'List external risks, e.g.:\n1. Regulatory changes (pollution control norms)…\n2. Foreign exchange fluctuation…')}
              {renderInput('risk_narrative_text', 'Consolidated Risk Factor Narrative', 'textarea', 'Draft of the top-10 risk factors narrative — must be banker-reviewed before filing.', 'Draft the consolidated, numbered top-10 risk factor narrative…')}
              <ManualNote>Requires banker sign-off before filing — draft it yourself or with the AI Assist button, then have it reviewed. Not auto-extractable.</ManualNote>

              <SubGroupHeader icon={AlertTriangle} label="Derived Concentration Metrics" note="Computed from other sections — not directly entered" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 mb-2">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Top-5 Customer Concentration</div>
                  <div className="text-[15px] font-mono font-bold text-gray-700">
                    {(() => {
                      const rows = Array.isArray(formData.top5_customer_revenue_table) ? formData.top5_customer_revenue_table : [];
                      const sum = rows.reduce((a, r) => a + (Number(r.fy1_pct) || 0), 0);
                      return rows.length ? `${sum.toFixed(1)}%` : '—';
                    })()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Geographic Concentration</div>
                  <div className="text-[15px] font-mono font-bold text-gray-700">{formData.geographic_concentration_pct ? `${formData.geographic_concentration_pct}%` : '—'}</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Raw Material Cost % of Revenue</div>
                  <div className="text-[15px] font-mono font-bold text-gray-700">{formData.raw_material_cost_pct ? `${formData.raw_material_cost_pct}%` : '—'}</div>
                </div>
              </div>
              <p className="text-[10.5px] text-gray-400 mb-5">Top-5 customer concentration is computed live from the Top-5 Customer Revenue table (Section 1). Geographic and raw-material concentration are derived from the restated financials once populated.</p>
            </div>
          )}

          {/* ═══ 9. WACA ═══ */}
          {activeTab === 'waca' && (
            <div>
              <SubGroupHeader icon={Scale} label="Weighted Average Cost of Acquisition (WACA)" note="Must reference a dated CA certificate" />
              {renderRows('waca_table', 'WACA Table', 'Per promoter/selling shareholder — shares held, WACA per share, and shares acquired in the last 1 year.',
                [
                  { key: 'shareholder', label: 'Shareholder', type: 'text' },
                  { key: 'shares_held', label: 'Shares Held', type: 'number' },
                  { key: 'waca_per_share', label: 'WACA / Share (₹)', type: 'number' },
                  { key: 'shares_acquired_last_1yr', label: 'Shares Acquired (1yr)', type: 'number' },
                  { key: 'waca_last_1yr', label: 'WACA (1yr) (₹)', type: 'number' },
                ],
                { manualNote: 'Must be transcribed from a dated Chartered Accountant certificate — cannot be auto-generated or estimated.', addLabel: 'Add row' })}
              {renderInput('waca_ca_certificate_date', 'WACA CA Certificate Date', 'text', 'Date of the Chartered Accountant certificate the WACA table is drawn from.', 'e.g. 2026-07-25')}
              <ManualNote>Requires a dated CA certificate — cannot be auto-generated. Enter the certificate date once obtained from your Chartered Accountant.</ManualNote>
            </div>
          )}

          {/* ═══ 10. BOARD & KMP ═══ */}
          {activeTab === 'board' && (
            <div>
              <SubGroupHeader icon={Users} label="Board of Directors" note="Companies Act 2013 Sec 149 — minimum 3, including 1 independent director" />
              {renderRows('directors', 'Board of Directors', 'Minimum 3 for a public company, including 1 independent director.',
                [
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'din', label: 'DIN', type: 'text' },
                  { key: 'designation', label: 'Designation', type: 'text' },
                  { key: 'independent_flag', label: 'Independent? (yes/no)', type: 'text' },
                ],
                { addLabel: 'Add director' })}

              <SubGroupHeader icon={Users} label="Key Managerial Personnel" note="Companies Act 2013 Sec 203" />
              {renderRows('kmp', 'Key Managerial Personnel', 'CFO, Company Secretary and other KMP not already listed as Executive Directors.',
                [
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'designation', label: 'Designation', type: 'text' },
                ],
                { addLabel: 'Add KMP' })}
            </div>
          )}

          {/* ═══ 11. AUDITOR QUALIFICATIONS ═══ */}
          {activeTab === 'auditor' && (
            <div>
              {renderInput('auditor_qualifications', 'Auditor Qualifications', 'textarea', 'Any reservations, qualifications, or adverse remarks by statutory auditors on the restated financials. Defaults to "None" — flagged if left empty.', "e.g. None — OR — describe the qualification.")}
            </div>
          )}

          {/* ═══ 12. LITIGATION ═══ */}
          {activeTab === 'litigation' && (
            <div>
              <SubGroupHeader icon={Scale} label="Summary of Outstanding Litigation" note="Must originate from legal counsel — not free-text scraped" />
              {renderRows('litigation_summary', 'Litigation Summary', 'Structured litigation table across Company/Directors/Promoters/KMP/Senior Management.',
                [
                  { key: 'entity_type', label: 'Entity Type', type: 'text', placeholder: 'e.g. Company - By' },
                  { key: 'criminal_count', label: 'Criminal', type: 'number' },
                  { key: 'tax_count', label: 'Tax', type: 'number' },
                  { key: 'statutory_regulatory_count', label: 'Statutory/Reg.', type: 'number' },
                  { key: 'civil_litigation_count', label: 'Civil', type: 'number' },
                  { key: 'aggregate_amount_cr', label: 'Aggregate ₹Cr', type: 'number' },
                ],
                { manualNote: 'Must originate from legal counsel via a structured litigation schedule upload — never inferred from narrative text. Every row here is manual-only, even though it renders as a table.', addLabel: 'Add entity row' })}

              <SubGroupHeader icon={AlertTriangle} label="Litigation Disclosures (Legacy Narrative)" />
              {renderInput('litigations_company', 'Litigations Against the Issuer', 'textarea', 'Pending corporate civil, criminal, or tax suits. Material litigation threshold applies.', 'e.g. No material litigations are pending against the Company as of date. — OR — describe pending cases.')}
              {renderInput('litigations_promoters', 'Litigations Against Promoters', 'textarea', 'Pending disputes against the promoter group including criminal, civil, and regulatory proceedings.', 'e.g. None — OR — describe pending cases.')}
            </div>
          )}

          {/* ═══ STATUTORY & COMPLIANCE (catch-all, not rendered in the Abridged Prospectus) ═══ */}
          {activeTab === 'compliance' && (
            <div>
              <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">Not Rendered in the Abridged Prospectus</span>
                </div>
                <p className="text-[12.5px] text-amber-700 leading-relaxed">These fields feed the SEBI ICDR filing-readiness coverage score and the full DRHP, but the Abridged Prospectus summary itself intentionally omits them.</p>
              </div>

              <SubGroupHeader icon={Landmark} label="Statutory Identifiers" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('pan', 'Company PAN Number', 'text', 'Income Tax Act Sec 139A — Permanent Account Number of the corporate entity.', 'AAACA1234A')}
                {renderInput('pan_name', 'Name on PAN Card', 'text', 'Exact legal name as registered on the PAN. Must match company name on RoC certificate.', 'Master Chains N Jewels Limited')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('gstin', 'GSTIN Number', 'text', 'CGST Act 2017 Sec 25 — GST registration number.', 'e.g. 27AAACG1234A1Z5')}
                {renderInput('gst_annual_turnover', 'GST Declared Turnover (₹ Crores)', 'number', 'Annual turnover declared in GST filings.', '42.8')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('incorporation_date', 'Date of Incorporation', 'text', 'Companies Act 2013 Sec 7(2) — Date the company was officially incorporated by the Registrar.', 'e.g. 2018-05-15')}
                {renderInput('company_type', 'Company Type', 'select', 'Companies Act 2013 Sec 3 — Legal form of the company as classified by RoC.', '', ['Public Limited Company', 'Private Limited Company', 'LLP'])}
              </div>

              <SubGroupHeader icon={DollarSign} label="Capital Structure" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('authorized_capital', 'Authorized Capital (₹ Crores)', 'number', 'Maximum share value company is authorized to issue per MoA.', '15.00')}
                {renderInput('paid_up_capital_pre', 'Pre-Issue Paid-up Capital (₹ Crores)', 'number', 'Actual paid-up value prior to public issue as per latest audited accounts.', '10.00')}
              </div>
              {renderInput('promoter_shareholding_pre_pct', 'Pre-Issue Promoter Shareholding (%)', 'number', 'SEBI ICDR Reg 236(1)(a) — Promoters must contribute ≥20% of post-issue capital, locked in for 3 years.', '78.5')}

              <SubGroupHeader icon={Users} label="Statutory Auditor" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('auditor_name', 'Statutory Auditor Firm', 'text', 'Companies Act 2013 Sec 139 — Audit firm restating financial profiles. Must be ICAI-registered.', 'e.g. M/s R.K. Associates & Co.')}
                {renderInput('auditor_membership', 'Auditor Membership No.', 'text', 'Chartered Accountants Act 1949 — ICAI firm membership / registration code.', 'e.g. 084532N')}
              </div>

              <SubGroupHeader icon={ClipboardList} label="Full-DRHP Objects Breakdown (Legacy)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                {renderInput('expansion_amount', 'CAPEX Expansion (₹ Crores)', 'number', 'Capital expenditure must be backed by quotations/estimates in the prospectus.', '8.5')}
                {renderInput('working_capital_amount', 'Working Capital Support (₹ Crores)', 'number', 'Working capital requirements supported by CA certificate.', '10.0')}
                {renderInput('debt_repayment_amount', 'Debt Repayment (₹ Crores)', 'number', 'Clearing borrowings or outstanding loans. Must specify lender and schedule.', '3.0')}
                {renderInput('issue_expenses', 'IPO Expenses (₹ Crores)', 'number', 'Merchant banking fees, underwriting, registries, and printing expenses.', '1.5')}
              </div>

              <SubGroupHeader icon={Gavel} label="Declaration & Contracts" />
              {renderInput('rpt_declared', 'Related Party Transactions (Last 3 Years)', 'textarea', 'AS-18 / Ind AS 24 — Leases, loan profiles, promoter remuneration disclosures with related parties.', 'e.g. Rent of office warehouse from Rajesh Kumar: ₹12.0 Lakhs/annum; Director Remuneration: ₹1.2 Crores/annum')}
              {renderInput('material_contracts_desc', 'Material Contracts for Inspection', 'textarea', 'Key corporate agreements, registrar mandates, underwriting agreements available for public inspection.', 'e.g.\n1. Tripartite Agreement dated Jan 12, 2026 with Registrar and Issuer.\n2. Underwriting Agreement dated Feb 1, 2026 with Lead Manager.')}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 mb-5">
                <p className="text-[12.5px] text-gray-500 leading-relaxed italic">
                  "We hereby certify that all guidelines and regulations issued by SEBI under the Chapter IX framework are complied with, and the facts presented in this Draft Prospectus represent the true and fair status of the entity."
                </p>
              </div>
              {renderInput('declaration_signed', 'Board Approval Declaration', 'checkbox', 'Board must certify all disclosures are true and fair.', 'I confirm that the Board of Directors has approved and agreed to this declaration.')}

              <SubGroupHeader icon={FileText} label="Legacy Narrative Fields" note="Superseded by structured fields elsewhere — kept for backward compatibility" />
              {renderInput('summary_business_note', 'Summary Business Note', 'textarea', 'A brief one-paragraph summary for the Offer Summary section.', 'e.g. We are a Gujarat-based manufacturer of specialty chemicals…')}
              {renderInput('business_model', 'Business Model Description (Legacy)', 'textarea', 'Revenue model, operations, logistics, and manufacturing capacity details.', 'Describe revenue flows, sales channels, manufacturing capacity, logistics networks…')}
              {renderInput('key_customers', 'Key Customer Segments (Legacy)', 'text', 'Target groups or enterprise segments served by the company.', 'e.g. Paint manufacturers, Packaging firms')}
              {renderInput('promoters_names', 'Promoter Names (Legacy, Comma-Separated)', 'text', 'Names of founders / controlling shareholders as per RoC records.', 'e.g. Rajesh Kumar, Sunita Kumar')}
              {renderInput('directors_names', 'Board Directors Names (Legacy, Comma-Separated)', 'text', 'Full Board of Directors names.', 'e.g. Rajesh Kumar, Sunita Kumar, Anil Sharma')}
              {renderInput('promoter_experience', 'Promoter Experience Summary (Legacy)', 'textarea', 'Work achievements, education profile, and track record relevant to the business.', 'Describe background, industry experience, and key achievements…')}
              {renderInput('fy_years', 'Financial Years Covered (Legacy)', 'text', 'Fiscal years included in restated financials.', 'e.g. FY24, FY25, FY26')}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
                {renderInput('revenue_fy_latest', 'Latest Revenue (₹ Crores) (Legacy)', 'number', 'Superseded by the Revenue from Operations 3-year table in Section 6.', '45.5')}
                {renderInput('pat_fy_latest', 'Latest PAT (₹ Crores) (Legacy)', 'number', 'Superseded by the PAT 3-year table in Section 6.', '3.8')}
                {renderInput('borrowings_latest', 'Total Borrowings (₹ Crores) (Legacy)', 'number', 'Superseded by the Total Borrowings 3-year table in Section 6.', '12.4')}
              </div>
            </div>
          )}

          {/* ─ Nav buttons ─ */}
          <div className="flex justify-between items-center mt-8 pt-5 border-t border-gray-100 select-none">
            <button
              onClick={onPrev}
              disabled={activeTab === WIZARD_TAB_ORDER[0]}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300 transition-all disabled:opacity-25 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={onNext}
              disabled={activeTab === WIZARD_TAB_ORDER[WIZARD_TAB_ORDER.length - 1]}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold bg-accent-500 hover:bg-accent-600 text-white shadow-accent transition-all cursor-pointer disabled:opacity-30 flex items-center gap-2"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Regulatory Reference + Live Preview (4 cols) ── */}
      <div className="lg:col-span-4 flex flex-col gap-5 select-none">

        {/* Compliance Reference */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
          <h3 className="text-[10.5px] font-bold uppercase tracking-widest text-accent-600 flex items-center gap-1.5 mb-3">
            <BookOpen className="w-3.5 h-3.5" /> {auditDetails.title}
          </h3>
          <p className="text-[12.5px] text-gray-500 leading-relaxed">{auditDetails.reg}</p>
          <div className="text-[9.5px] font-bold text-gray-300 uppercase tracking-widest mt-4 pt-3 border-t border-gray-100">
            Compliance Module Active
          </div>
        </div>

        {/* Live Prospectus Preview */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex-1 flex flex-col min-h-[300px]">
          <div className="border-b border-gray-100 pb-3 mb-3 flex justify-between items-center">
            <h3 className="text-[10.5px] font-bold uppercase tracking-widest text-gray-500">Live Document Preview</h3>
            <span className="text-[9px] uppercase bg-gray-100 text-gray-400 px-2 py-0.5 rounded-lg font-mono font-bold tracking-wider border border-gray-200">Draft Style</span>
          </div>

          <div className="flex-1 bg-gray-50 border border-gray-200 p-4 rounded-xl overflow-y-auto relative">
            {/* Watermark */}
            <div className="absolute top-3 right-3 text-[8.5px] uppercase border border-gray-300 text-gray-400 font-mono px-2 py-0.5 rounded-lg rotate-2 opacity-50 font-bold pointer-events-none select-none">
              Draft
            </div>
            <pre className="font-mono text-[11px] leading-[1.75] text-gray-500 whitespace-pre-wrap break-words">
              {auditDetails.previewText}
            </pre>
          </div>
          <div className="text-[10px] text-gray-300 italic mt-2.5 leading-normal">
            * Updates automatically as you fill in form fields.
          </div>
        </div>

      </div>
    </div>
  );
}
