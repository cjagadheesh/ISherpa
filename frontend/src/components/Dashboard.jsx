import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, FileDown,
  ChevronDown, ChevronUp, Loader2, Sparkles, ArrowRight,
  BarChart3, Clock, Zap,
  BookOpen, Lightbulb, Cpu, ShieldCheck,
  ScrollText
} from 'lucide-react';
import ComplianceScoreMeter from './ComplianceScoreMeter';
import RegulatoryAlertBanner from './RegulatoryAlertBanner';
import DueDiligenceManager from './DueDiligenceManager';
import Badge from './ui/Badge';
import StatTile from './ui/StatTile';
import { lookupRegulation } from '../data/icdrRegulations';
import { WIZARD_STEPS } from './Wizard';

// Maps each backend/schema.json section id to the wizard tab that actually houses its
// fields — kept in sync with Wizard.jsx's 14-tab structure (Cover Page + the 12 numbered
// Abridged Prospectus sections + the Statutory & Compliance catch-all for fields the
// abridged summary itself doesn't render).
const SECTION_TO_TAB = {
  'cover_page': 'cover',
  'offer_details': 'cover',
  'definitions': 'cover',
  'risk_factors': 'risks',
  'summary_offer': 'compliance',
  'general_info': 'compliance',
  'capital_structure': 'compliance',
  'objects_issue': 'objects',
  'business_overview': 'business',
  'industry_overview': 'industry',
  'promoters': 'promoters',
  'board_kmp': 'board',
  'rpt': 'compliance',
  'financials': 'financials',
  'kpis': 'kpis',
  'shareholding': 'shareholding',
  'waca': 'waca',
  'legal_disclosures': 'litigation',
  'compliance_certs': 'compliance',
  'material_contracts': 'compliance',
  'declaration': 'compliance',
};

const TAB_NAMES = Object.fromEntries(WIZARD_STEPS.map(s => [s.id, s.label]));

export default function Dashboard({ 
  validationResults, 
  sessionData,
  onGenerate, 
  generating, 
  onNavigateTab,
  onPreFill,
  lastSavedTime,
  apiFetch,
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedCoT, setExpandedCoT] = useState({});

  if (!validationResults) {
    return (
      <div className="card rounded-2xl p-16 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-card-md animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-accent-50 border border-accent-100 flex items-center justify-center mb-5">
          <Loader2 className="w-7 h-7 text-accent-500 animate-spin" />
        </div>
        <p className="text-gray-800 font-bold text-sm">Analyzing Workspace</p>
        <p className="text-[12px] text-gray-400 mt-2 leading-relaxed max-w-xs">
          Running SEBI Chapter IX rules engine on form fields and document extracts…
        </p>
      </div>
    );
  }

  const {
    sections = [],
    inconsistencies = [],
    status_counts = { complete: 0, incomplete: 0, inconsistent: 0 },
  } = validationResults;

  const toggleSection = (id) => setExpandedSection(expandedSection === id ? null : id);
  const toggleCoT = (id) => setExpandedCoT(prev => ({ ...prev, [id]: !prev[id] }));

  const handleBadgeClick = (e, sectionId) => {
    e.stopPropagation();
    const tabId = SECTION_TO_TAB[sectionId];
    if (tabId && onNavigateTab) onNavigateTab(tabId);
  };

  const getStatusBadge = (status, sectionId) => {
    switch (status) {
      case 'complete':
        return (
          <Badge variant="success" icon={CheckCircle2} onClick={(e) => handleBadgeClick(e, sectionId)} title="Verified. Click to view in wizard.">
            Verified
          </Badge>
        );
      case 'inconsistent':
        return (
          <Badge variant="danger" icon={AlertTriangle} pulse onClick={(e) => handleBadgeClick(e, sectionId)} title="Data conflict found. Click to review.">
            Conflict
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" dot onClick={(e) => handleBadgeClick(e, sectionId)} title="Draft pending. Click to complete.">
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">

      {/* ── Page Title ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-title">Filing Dashboard</h1>
          <p className="text-body mt-1">Live SEBI ICDR Chapter IX compliance tracking for your draft prospectus.</p>
        </div>
        {onPreFill && (
          <button
            onClick={() => onPreFill('complete')}
            className="inline-flex items-center gap-2 text-[13px] font-bold text-accent-700 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 hover:border-accent-300 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0"
            title="Load all form fields with sample data for Master Chains N Jewels Limited"
          >
            <Sparkles className="w-4 h-4 text-accent-500" />
            <span>Load sample — Master Chains N Jewels</span>
          </button>
        )}
      </div>

      {/* ── SEBI Regulatory Change Alert Banner ── */}
      <RegulatoryAlertBanner apiFetch={apiFetch} />

      {/* ── Compliance Score Meter (full-width centrepiece) ── */}
      <ComplianceScoreMeter validationResults={validationResults} />

      {/* ── Top Stats Row (2-col: Chapter Status + Compiler) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Chapter Status */}
        <div className="card rounded-2xl p-6 border border-gray-100 flex flex-col justify-between">
          <p className="text-caption font-bold uppercase tracking-widest mb-4">Prospectus Chapters</p>
          <div className="grid grid-cols-3 gap-3">
            <StatTile value={status_counts.complete} label="Verified" tone="success" />
            <StatTile value={status_counts.incomplete} label="Pending" tone="warning" />
            <StatTile value={status_counts.inconsistent} label="Conflicts" tone="danger" />
          </div>
          <p className="text-caption mt-4">
            {sections.length} chapters tracked · Click any chapter below to expand
          </p>
        </div>

        {/* Compiler Card */}
        <div className="card rounded-2xl p-6 border border-gray-100 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-accent-500/8 rounded-full blur-2xl pointer-events-none" />
          <div>
            <p className="text-caption font-bold uppercase tracking-widest text-accent-600 flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5" /> Prospectus Compiler
            </p>
            <p className="text-body">
              Compile form data into a SEBI-formatted <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md text-[10.5px] font-mono">.docx</code> draft.
            </p>
          </div>
          <div className="space-y-2 mt-5">
            <button onClick={onGenerate} disabled={generating} className="btn-primary w-full">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Compiling…</span></>
              ) : (
                <><FileDown className="w-4 h-4" /><span>DOCX Prospectus</span></>
              )}
            </button>
          </div>
          {lastSavedTime && (
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400 font-medium select-none">
              <Clock className="w-3 h-3" />
              <span>Last synced: {lastSavedTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Feature 3: Inconsistencies Panel with SEBI Regulation Badges & AI Explanations ── */}
      {inconsistencies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[15px] font-bold text-red-600 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> SEBI Statutory Mismatches & Conflict Checks ({inconsistencies.length})
            </h3>
            <span className="text-caption font-mono font-bold text-red-500">SEBI ICDR Audit Engine</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {inconsistencies.map((inc) => {
              const showCoT = expandedCoT[inc.id];
              const regData = lookupRegulation(inc.sebi_ref);

              return (
                <div key={inc.id}
                  className="bg-white border border-red-200 rounded-2xl p-5 shadow-card hover:shadow-card-md transition-all relative overflow-hidden flex flex-col gap-3">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 rounded-l-2xl" />

                  {/* Top Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pl-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="p-1.5 bg-red-50 text-red-600 rounded-lg border border-red-100">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-sm text-gray-800">{inc.title}</h4>

                      <Badge variant="danger" size="xs" className="uppercase">{inc.severity}</Badge>
                      {inc.blocking && (
                        <Badge variant="warning" size="xs" className="uppercase">Blocking Issue</Badge>
                      )}
                    </div>

                    {/* Clickable SEBI Regulation Badge */}
                    {inc.sebi_ref && (
                      <Badge variant="info" icon={BookOpen} title="SEBI ICDR Statutory Regulation Reference" className="self-start md:self-auto font-mono">
                        {inc.sebi_ref}
                      </Badge>
                    )}
                  </div>

                  {/* Main Description */}
                  <p className="text-body pl-2">{inc.description}</p>

                  {/* Clean Actionable Fix Steps (Visible directly) */}
                  {inc.fix_steps && inc.fix_steps.length > 0 && (
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 pl-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                        <Lightbulb className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Recommended Resolution Steps:</span>
                      </div>
                      <ul className="space-y-1 pl-1">
                        {inc.fix_steps.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11.5px] font-medium text-emerald-900">
                            <span className="text-emerald-600 font-bold shrink-0">•</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Clean Action Bar (Only 1 Details Toggle + 1 Primary Jump Button) */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => toggleCoT(inc.id)}
                      className={`text-[11.5px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                        showCoT 
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5 text-purple-600" />
                      <span>{showCoT ? 'Hide Technical Audit Details' : 'Technical CoT & ICDR Text'}</span>
                    </button>

                    {inc.section_id && SECTION_TO_TAB[inc.section_id] && (
                      <button
                        onClick={() => onNavigateTab(SECTION_TO_TAB[inc.section_id])}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-accent-500 hover:bg-accent-600 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Fix in {TAB_NAMES[SECTION_TO_TAB[inc.section_id]] || 'Wizard'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Expandable Technical Details (CoT Reasoning + Statutory Reference) */}
                  {showCoT && (
                    <div className="bg-gradient-to-br from-purple-50/90 to-indigo-50/80 border border-purple-200 rounded-xl p-4 space-y-4 animate-fade-in shadow-xs">
                      <div className="flex items-center justify-between font-extrabold text-xs text-purple-900 border-b border-purple-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-purple-600 animate-pulse" />
                          <span>Audit Engine Chain-of-Thought Reasoning</span>
                        </div>
                        <span className="text-[10px] font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 uppercase tracking-wider font-bold">
                          SEBI Rules Engine
                        </span>
                      </div>

                      <div className="space-y-2">
                        {(inc.reasoning_steps && inc.reasoning_steps.length > 0 ? inc.reasoning_steps : [
                          `1. Extracted input data values associated with ${inc.title}.`,
                          "2. Checked against SEBI ICDR regulations and statutory formatting rules.",
                          "3. Evaluated discrepancy between expected statutory structure and observed values.",
                          "4. Therefore: Flagged for reconciliation before draft submission."
                        ]).map((step, idx) => {
                          const stepNum = idx + 1;
                          const cleanText = step.replace(/^\d+\.\s*/, '');
                          return (
                            <div key={idx} className="flex items-start gap-2.5 bg-white/90 rounded-lg p-2.5 border border-purple-100 shadow-2xs">
                              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                {stepNum}
                              </span>
                              <p className="text-xs text-gray-800 font-medium leading-relaxed">
                                {cleanText}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* ICDR Statutory Text embedded cleanly */}
                      {regData && (
                        <div className="border border-blue-200 rounded-xl overflow-hidden mt-3">
                          <div className="px-3.5 py-2.5 bg-blue-600 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ScrollText className="w-3.5 h-3.5 text-blue-100" />
                              <span className="text-[11px] font-extrabold text-white font-mono">{regData.shortTitle}</span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-200">{regData.chapter}</span>
                          </div>
                          <div className="px-4 py-3 bg-blue-50/60 text-[11.5px] leading-relaxed text-slate-800 font-serif italic">
                            "{regData.text}"
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Prospectus Chapters Accordion ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[12px] font-bold text-gray-600 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" /> Prospectus Chapter Check
          </h3>
          <span className="text-[10.5px] text-gray-400 font-semibold">{sections.length} sections</span>
        </div>
        
        <div className="space-y-2">
          {sections.map((sec, idx) => {
            const isExpanded = expandedSection === sec.section_id;
            const hasMissing = sec.missing_fields?.length > 0;
            const hasPresent = sec.present_fields?.length > 0;
            
            return (
              <div key={sec.section_id}
                className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
                  isExpanded 
                    ? 'border-gray-200 shadow-card-md' 
                    : 'border-gray-100 shadow-card hover:border-gray-200 hover:shadow-card-md'
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleSection(sec.section_id)}
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <div className="flex items-center gap-4 overflow-hidden min-w-0">
                    <span className="font-mono text-[10.5px] text-gray-300 font-bold w-5 shrink-0 text-right">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="overflow-hidden min-w-0">
                      <h4 className="font-bold text-[13.5px] text-gray-800 truncate">{sec.section_name}</h4>
                      <p className="text-[11.5px] text-gray-400 truncate mt-0.5 font-medium leading-relaxed">{sec.description}</p>
                    </div>
                  </div>
                  {/* Section Header & Risk Badge */}
                  <div className="flex items-center gap-3 shrink-0 ml-5">
                    {sec.risk_score && (
                      <Badge variant={sec.risk_level === 'high' ? 'danger' : sec.risk_level === 'medium' ? 'warning' : 'success'} className="font-mono">
                        <span>Risk: {sec.risk_score}/10</span>
                        <span className="opacity-75 uppercase text-[9px] ml-1">({sec.risk_level})</span>
                      </Badge>
                    )}
                    {getStatusBadge(sec.status, sec.section_id)}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-300" />
                    }
                  </div>
                </div>

                {/* Accordion Content */}
                {isExpanded && (
                    <div className="px-6 pb-6 pt-3 bg-gray-50 border-t border-gray-100 space-y-4">
                      
                      {/* AI Risk Explanation Box */}
                      {sec.risk_explanation && (
                        <div className={`p-3 rounded-xl border text-[11.5px] font-medium flex items-start gap-2.5 shadow-2xs ${
                          sec.risk_level === 'high' 
                            ? 'bg-red-50/80 border-red-200 text-red-800' 
                            : sec.risk_level === 'medium' 
                            ? 'bg-amber-50/80 border-amber-200 text-amber-800' 
                            : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                        }`}>
                          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold uppercase text-[10px] tracking-wider block mb-0.5">Section AI Risk Assessment</span>
                            {sec.risk_explanation}
                          </div>
                        </div>
                      )}
                    
                    {/* Conflicts */}
                    {sec.inconsistencies?.length > 0 && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5" /> Conflict Details
                        </h5>
                        <ul className="space-y-1.5">
                          {sec.inconsistencies.map((inc) => (
                            <li key={inc.id} className="text-[12px] text-red-600 leading-relaxed">
                              <span className="font-bold">{inc.title}:</span> {inc.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Fields grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Verified fields */}
                      <div>
                        <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Verified Fields</h5>
                        {hasPresent ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sec.present_fields.map((f) => (
                              <Badge key={f} variant="success" icon={CheckCircle2} onClick={() => onNavigateTab && onNavigateTab(SECTION_TO_TAB[sec.section_id])} title="Click to view in wizard.">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400 italic">No fields verified yet.</p>
                        )}
                      </div>

                      {/* Missing fields */}
                      <div>
                        <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Missing Required Fields</h5>
                        {hasMissing ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sec.missing_fields.map((f) => (
                              <Badge key={f} variant="warning" dot onClick={() => onNavigateTab && onNavigateTab(SECTION_TO_TAB[sec.section_id])} title="Click to fill in wizard.">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> All required fields complete!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Navigate button */}
                    <button
                      onClick={() => onNavigateTab && onNavigateTab(SECTION_TO_TAB[sec.section_id])}
                      className="w-full text-[11.5px] font-bold text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100 border border-accent-200 hover:border-accent-300 rounded-xl py-2.5 px-4 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                    >
                      <span>Go to {TAB_NAMES[SECTION_TO_TAB[sec.section_id]]} Step</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Enterprise Product Modules (Live & Reactive) ── */}
      {/* 1. Lead Manager Due Diligence & Form A Audit */}
      <DueDiligenceManager
        apiFetch={apiFetch}
        validationResults={validationResults}
        sessionData={sessionData}
        onPreFill={onPreFill}
      />
    </div>
  );
}
