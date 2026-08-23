import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen, Check, Sparkles, LogOut, Loader2, ShieldCheck,
  ChevronRight, LayoutDashboard, AlertTriangle,
  Landmark, History, PanelLeftClose, PanelLeftOpen,
  Menu, X, Bell, Search, FileDown, FileText,
} from 'lucide-react';
import Wizard, { WIZARD_TAB_ORDER, WIZARD_STEPS } from './components/Wizard';
import Uploader from './components/Uploader';
import Dashboard from './components/Dashboard';
import Copilot from './components/Copilot';
import BankerDashboard from './components/BankerDashboard';
import AuditTrail from './components/AuditTrail';
import { apiFetch } from './api';

import { supabase } from './supabase';

export default function App({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, uploads, or one of WIZARD_TAB_ORDER (see Wizard.jsx)
  const [sessionData, setSessionData] = useState({
    form_data: {},
    extracted_data: {
      financials: {},
      gst: {},
      incorporation: {},
      compliance: {}
    },
    uploaded_files: []
  });
  const [validationResults, setValidationResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // saved, saving, error
  const [lastSavedTime, setLastSavedTime] = useState(new Date().toLocaleTimeString());
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── UI shell state (sidebar collapse, mobile drawer, topbar menus) ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [quickSwitchQuery, setQuickSwitchQuery] = useState('');
  const [regulatoryAlerts, setRegulatoryAlerts] = useState([]);


  // Real-time Collaboration State
  const userRole = 'founder';

  const sessionDataRef = useRef(sessionData);
  const saveTimerRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // ── Topbar dropdowns (quick switcher, notifications, profile menu) ──
  // Close whichever is open on any click outside its own container — not just
  // via their toggle button or an inner item, which was the only way before.
  const quickSwitchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (quickSwitchRef.current && !quickSwitchRef.current.contains(e.target)) {
        setQuickSwitchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Supabase Realtime Collaboration Setup ─────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channelId = `ipo_workspace_${user.id || 'shared'}`;
    const channel = supabase.channel(channelId, {
      config: {
        presence: { key: user.email || 'user' }
      }
    });

    realtimeChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'session_update' }, ({ payload }) => {
        if (payload && payload.form_data) {
          sessionDataRef.current = {
            ...sessionDataRef.current,
            form_data: { ...sessionDataRef.current.form_data, ...payload.form_data }
          };
          setSessionData({ ...sessionDataRef.current });
          validateSession();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({
            email: user.email || 'founder@workspace.local',
            role: userRole,
            active_tab: activeTab,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userRole, activeTab]);

  const handleApplySuggestion = (key, value) => {
    handleFormChange(key, value);
  };

  const authFetch = (path, options) => apiFetch(path, options);

  // Fetch initial session state
  useEffect(() => {
    fetchSession();
  }, []);

  // Powers the topbar notification bell — same endpoint RegulatoryAlertBanner
  // already calls on the dashboard, fetched independently here so the count
  // is visible from any tab, not just when the dashboard is mounted.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await authFetch('/api/regulatory_alerts');
        if (res.ok && isMounted) {
          const data = await res.json();
          setRegulatoryAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error('Failed to fetch regulatory alerts for notification bell:', err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Update auto-saved timestamp when saved status turns to 'saved'
  useEffect(() => {
    if (saveStatus === 'saved') {
      setLastSavedTime(new Date().toLocaleTimeString());
    }
  }, [saveStatus]);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/session');
      if (res.ok) {
        const data = await res.json();
        setSessionData(data);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setLoading(false);
      // Always validate after initial load so dashboard shows correct score
      validateSession();
    }
  };

  const validateSession = async () => {
    try {
      const res = await authFetch('/api/validate');
      if (res.ok) {
        const data = await res.json();
        setValidationResults(data);
      }
    } catch (err) {
      console.error('Validation engine failed:', err);
    }
  };

  const persistFormData = async (formData) => {
    try {
      const res = await authFetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: formData })
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      await validateSession();
    } catch (err) {
      console.error('Failed to save session state:', err);
      setSaveStatus('error');
    }
  };



  const handleReset = async () => {
    // Closes the confirmation panel the moment the user answers "yes" —
    // its job is done once they've confirmed, so it shouldn't stay open
    // waiting on a network round-trip. Previously this only happened after
    // the API call succeeded, so a failed/slow request (backend down,
    // network hiccup) left the panel stuck open with no visible feedback,
    // only closable via Cancel.
    setConfirmReset(false);
    try {
      setLoading(true);
      const res = await authFetch('/api/session/reset', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Reset failed: ${err.detail || res.statusText}`);
        return;
      }
      const emptySession = {
        form_data: {},
        extracted_data: {
          financials: {},
          gst: {},
          incorporation: {},
          compliance: {}
        },
        uploaded_files: []
      };
      sessionDataRef.current = emptySession;
      setSessionData(emptySession);
      setValidationResults(null);
      setRedFlagResults(null);
      await validateSession();
    } catch (err) {
      console.error('Failed to reset workspace:', err);
      alert('Failed to reset workspace. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };


  const handleFormChange = (key, value) => {
    setSaveStatus('saving');
    const updatedFormData = { ...sessionDataRef.current.form_data, [key]: value };
    const updatedSession = { ...sessionDataRef.current, form_data: updatedFormData };
    sessionDataRef.current = updatedSession;
    setSessionData(updatedSession);

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'session_update',
        payload: { form_data: { [key]: value }, updated_by: user?.email }
      });
    }

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistFormData(updatedFormData), 500);
  };

  const handleUploadSuccess = (docType, extractedFields, upload) => {
    setSessionData(prev => {
      const updatedFiles = prev.uploaded_files.filter(f => f.type !== docType);
      updatedFiles.push({ ...upload, type: docType });

      // Auto-fill blank fields, and also let a newer extraction correct a field
      // that's still exactly what an earlier extraction put there (never
      // manually edited since) — a genuinely manually-typed value always wins.
      // Without the second clause, once any document set e.g. company_name —
      // even a wrong value from a mismatched/corrupted document — every later,
      // more authoritative document (say the actual Incorporation cert) could
      // never correct it here, even though the server-side session already had
      // the right value: the field looked "manually filled" forever after.
      const updatedFormData = { ...prev.form_data };
      for (const [key, value] of Object.entries(extractedFields || {})) {
        const isMetadata = key === 'missing_fields';
        const isMeaningfulValue = value !== undefined && value !== null && value !== '';
        const isBlankFormField = updatedFormData[key] === undefined || updatedFormData[key] === null || updatedFormData[key] === '';
        const matchesPriorExtraction = !isBlankFormField && Object.values(prev.extracted_data || {}).some(
          docFields => docFields && docFields[key] !== undefined && docFields[key] !== null &&
            JSON.stringify(docFields[key]) === JSON.stringify(updatedFormData[key])
        );
        if (!isMetadata && isMeaningfulValue && (isBlankFormField || matchesPriorExtraction)) {
          updatedFormData[key] = value;
        }
      }

      const updatedSession = {
        ...prev,
        form_data: updatedFormData,
        extracted_data: { ...prev.extracted_data, [docType]: extractedFields },
        uploaded_files: updatedFiles,
      };
      sessionDataRef.current = updatedSession;
      return updatedSession;
    });

    setTimeout(() => {
      validateSession();
    }, 200);
  };

  const handlePreFill = async (type) => {
    setSaveStatus('saving');
    setLoading(true);

    // Real reference sample: Master Chains N Jewels Limited, transcribed directly from
    // draft/Master Chains N Jewels Limited - AP_p.pdf (the actual Draft Abridged Prospectus
    // used to build generator.py's output format). Figures quoted in the source as ₹ million
    // are converted to ₹ Crores (÷10) throughout to match this app's Crore-denominated fields.
    // A handful of fields the abridged summary itself never discloses (PAN, GSTIN, incorporation
    // date, authorized capital, price band, OFS amount) aren't in the source document either —
    // those are filled with plausible placeholders so every wizard tab still has something to show.
    const sampleForm = {
      // ── Cover Page ──────────────────────────────────────────────────────
      company_name: 'Master Chains N Jewels Limited',
      former_name: 'Master Chains N Jewels Private Limited and Master Chain Private Limited',
      cin: 'U36911MH1997PLC107966',
      company_acronym: 'MCJL',
      registered_office: 'Unit 1/2, 6th Floor, Plot - 219/221, Mehta Mansion, Sheikh Memon Street, Zaveri Bazar, Kalbadevi, Mumbai, Maharashtra, 400 002, India',
      company_secretary_name: 'Rahul Rasikbhai Jethwa',
      contact_email: 'complianceofficer@masterchain.com',
      contact_phone: '+91 89768 97663',
      company_website: 'www.masterchainsnjewels.com',
      promoter_names: [
        { name: 'Madan Sardarmal Kothari' },
        { name: 'Raj Madan Kothari' },
        { name: 'Khushbu Raj Kothari' },
        { name: 'Taruna Madan Kothari' },
      ],
      fresh_issue_size_cr: 400.0,
      // ofs_size_cr is left blank — the source itself states this as "[●] million",
      // undetermined pending price-band finalization, so the Abridged Prospectus shows [●] there too.
      // price_band is filled in (unlike the source's "[●]") so the demo can show a signed,
      // fully-complete declaration without tripping "Declaration Signed While Incomplete".
      price_band: '208 - 219',
      face_value_per_share: 10,
      issue_size: 400.0,
      selling_shareholders: [
        { name: 'Taruna Madan Kothari', type: 'Promoter Selling Shareholder', shares_offered: 5906250, waca_per_share: 0.07 },
      ],
      lead_manager: 'Systematix Corporate Services Limited',
      registrar: 'Bigshare Services Private Limited',

      // ── 1. Summary of Primary Business ───────────────────────────────────
      products_services_description: "We are engaged in the designing, manufacturing, job-work services and sale of a wide range of gold jewellery. Our jewellery pieces are set across various price points ranging from jewellery for special occasions, such as weddings, to festive and daily-wear lightweight jewellery.\n\nOur product offerings comprise a wide range of gold jewellery across multiple karatages, including 14 karat, 18 karat, 22 karat. Our product portfolio includes chains, earrings, bracelets, necklaces, rings, mangalsutras, pendant sets, daily wear jewellery and kids' jewellery in variety of designs and finishes. We offer collections in yellow gold, rhodium and rose gold and possess the capability to design and manufacture customized jewellery to meet specific customer requirements. For further details, see \"Our Business – Overview\" and \"Our Business – Our Products Portfolio\" of the Draft Red Herring Prospectus.",
      industries_served: "Our business is oriented towards wholesale distribution, which is consistent with prevailing industry practices where sales volume, repeat orders and inventory turnover are key operational considerations. We have fostered long standing relationships with several jewellery businesses, including single-store and multi-store retailers (\"Retail Jewellers\"). For further details, see \"Our Business\" of the Draft Red Herring Prospectus.",
      typical_customers: 'single-store and multi-store retailers ("Retail Jewellers")',
      segment_reporting_applicable: false,
      segment_reporting_note: 'Our Company operates primarily in the business of manufacturing and trading of gold jewellery; hence no separate segment reporting is applicable under Ind AS 108.',
      key_geographies_served: "We have a significant presence in the western region followed by southern region of the country. For the Fiscal 2026, 2025 and 2024, we majorly catered to Maharashtra, Karnataka and Telangana, Gujarat and Punjab. For further details, see \"Our Business - Market Opportunity\" of the Draft Red Herring Prospectus.",
      top5_customer_revenue_table: [
        { customer_name: 'Top 5 customers', fy1_revenue: 317.85, fy1_pct: 18.91, fy2_revenue: 291.56, fy2_pct: 19.28, fy3_revenue: 248.80, fy3_pct: 19.55 },
      ],
      manufacturing_facility_locations: [
        { type: 'Manufacturing Unit', location: 'Mumbai' },
        { type: 'Manufacturing Unit', location: 'Mumbai' },
        { type: 'Branch Office', location: 'Delhi' },
        { type: 'Branch Office', location: 'Hyderabad' },
        { type: 'Branch Office', location: 'Bengaluru' },
      ],
      business_strengths: [
        { strength: 'Market trends relating to the lightweight jewellery capabilities of the Company' },
        { strength: 'Established customer relationships and penetrative distribution network' },
        { strength: 'Scalable, technology-led in-house manufacturing infrastructure' },
        { strength: 'Diversified product portfolio and design refresh capabilities' },
        { strength: 'Experienced Promoters and industry relationships' },
        { strength: 'Quality control, compliance and traceability processes' },
        { strength: 'Skilled workforce and semi-handcrafted manufacturing processes' },
      ],
      business_strategies: [
        { strategy: 'Product diversification across karatages' },
        { strategy: 'Expand and diversify wholesale and retail customer base' },
        { strategy: 'Expand capacity by setting up a new manufacturing facility and inorganic acquisitions' },
        { strategy: 'Strengthen technology-enabled operations and internal controls' },
        { strategy: 'Strengthen customer engagement and sales channels' },
        { strategy: 'Efficient working capital and inventory management aligned with industry trends' },
      ],

      // ── 2. Summary of Industry ────────────────────────────────────────────
      industry_name: 'Gems and Jewellery',
      industry_report_source: 'CARE Report',
      industry_market_size: "India's gems and jewellery industry contributes approximately 7% of the country's GDP and around 15% of total merchandise exports. Gold accounted for approximately 80% of the market by material type in 2025 (followed by diamonds at 10%, silver at 5%, and other materials at 5%).",
      industry_growth_narrative: "India's gems and jewellery market is one of the largest and most vibrant in the world, deeply embedded in the country's cultural and economic life. India is the largest diamond-cutting and polishing hub globally, producing over 90% of the world's polished diamonds. The sector is expected to grow steadily, driven by domestic consumption and international demand.",

      // ── 3. Promoters ──────────────────────────────────────────────────────
      promoters: [
        { name: 'Madan Sardarmal Kothari', designation: 'Chairman and Whole-time Director', din: '01234567', date_associated_since: 'Incorporation', education_qualification: 'Matriculate, Maharashtra State Board of Secondary and Higher Secondary Education', years_experience: 29, biography_narrative: 'Oversees strategic direction, leadership, and management of the Company\'s operations including business strategy formulation and operational excellence. Also associated with the All India Gem and Jewellery Domestic Council.' },
        { name: 'Raj Madan Kothari', designation: 'Managing Director and Chief Executive Officer', din: '01234568', date_associated_since: '2004-02-20', education_qualification: "Bachelor's degree in Engineering (Mechanical), University of Mumbai", years_experience: 22, biography_narrative: 'Has been instrumental in providing strategic leadership for achieving sustenance and growth in terms of business strategy.' },
        { name: 'Khushbu Raj Kothari', designation: 'Whole-time Director', din: '01234569', date_associated_since: '2025-09-30', education_qualification: "Bachelor's degree in Commerce, University of Mumbai", years_experience: 10, biography_narrative: 'Responsible for overseeing administrative and marketing operations. Was a designated partner of Aurous Jewels LLP since June 6, 2015, which was acquired by the Company pursuant to a Business Transfer Agreement dated October 18, 2025.' },
        { name: 'Taruna Madan Kothari', designation: 'Promoter', din: '01234570', date_associated_since: '2002', education_qualification: '', years_experience: 27, biography_narrative: 'Was the sole proprietor of Kanak Shilp since 2017, which was acquired by the Company pursuant to a Memorandum of Understanding dated September 30, 2025 and a Business Transfer Agreement dated October 18, 2025.' },
      ],

      // ── 4. Objects of the Offer ───────────────────────────────────────────
      use_of_proceeds: [
        { particular: 'Funding working capital requirements of our Company', estimated_amount_cr: 350.0 },
        { particular: 'General Corporate Purposes', estimated_amount_cr: 50.0 },
      ],
      general_corp_amount: 50.0,

      // ── 5. Shareholding ───────────────────────────────────────────────────
      pre_offer_shareholding: [
        { shareholder: 'Madan Sardarmal Kothari', shares: 46536000, pct: 49.24 },
        { shareholder: 'Raj Madan Kothari', shares: 31499958, pct: 33.33 },
        { shareholder: 'Khushbu Raj Kothari', shares: 420000, pct: 0.44 },
        { shareholder: 'Taruna Madan Kothari', shares: 15624000, pct: 16.53 },
        { shareholder: 'Neha Varun Muthaliya (Promoter Group)', shares: 420000, pct: 0.44 },
        { shareholder: 'Salvi Abhay Sakaria', shares: 21, pct: 0.00 },
        { shareholder: 'Gopinathan Venugopal', shares: 21, pct: 0.00 },
      ],
      promoter_group_members: [
        { name: 'Neha Varun Muthaliya', relationship: 'Member of the Promoter Group' },
      ],
      esop_details: 'No ESOP scheme in force.',

      // ── 6. Restated Financial Information (3-year, ₹ million ÷ 10 = ₹ Cr) ─
      equity_share_capital: [{ fy: 'Fiscal 2026', value: 4.50 }, { fy: 'Fiscal 2025', value: 4.50 }, { fy: 'Fiscal 2024', value: 4.50 }],
      net_worth: [{ fy: 'Fiscal 2026', value: 231.96 }, { fy: 'Fiscal 2025', value: 134.65 }, { fy: 'Fiscal 2024', value: 97.52 }],
      revenue_from_operations: [{ fy: 'Fiscal 2026', value: 1680.59 }, { fy: 'Fiscal 2025', value: 1512.20 }, { fy: 'Fiscal 2024', value: 1272.64 }],
      ebitda: [{ fy: 'Fiscal 2026', value: 145.92 }, { fy: 'Fiscal 2025', value: 61.64 }, { fy: 'Fiscal 2024', value: 40.40 }],
      pat: [{ fy: 'Fiscal 2026', value: 97.27 }, { fy: 'Fiscal 2025', value: 37.12 }, { fy: 'Fiscal 2024', value: 22.04 }],
      eps_basic: [{ fy: 'Fiscal 2026', value: 10.29 }, { fy: 'Fiscal 2025', value: 3.93 }, { fy: 'Fiscal 2024', value: 2.33 }],
      eps_diluted: [{ fy: 'Fiscal 2026', value: 10.29 }, { fy: 'Fiscal 2025', value: 3.93 }, { fy: 'Fiscal 2024', value: 2.33 }],
      ronw_pct: [{ fy: 'Fiscal 2026', value: 41.93 }, { fy: 'Fiscal 2025', value: 27.57 }, { fy: 'Fiscal 2024', value: 22.60 }],
      nav_per_share: [{ fy: 'Fiscal 2026', value: 24.55 }, { fy: 'Fiscal 2025', value: 14.25 }, { fy: 'Fiscal 2024', value: 10.32 }],
      total_borrowings: [{ fy: 'Fiscal 2026', value: 214.19 }, { fy: 'Fiscal 2025', value: 113.72 }, { fy: 'Fiscal 2024', value: 103.15 }],
      cash_flow_operating: [{ fy: 'Fiscal 2026', value: -73.65 }, { fy: 'Fiscal 2025', value: 1.17 }, { fy: 'Fiscal 2024', value: 1.91 }],
      cash_flow_investing: [{ fy: 'Fiscal 2026', value: -12.06 }, { fy: 'Fiscal 2025', value: -0.47 }, { fy: 'Fiscal 2024', value: -2.50 }],
      cash_flow_financing: [{ fy: 'Fiscal 2026', value: 85.81 }, { fy: 'Fiscal 2025', value: -0.69 }, { fy: 'Fiscal 2024', value: -3.68 }],

      // ── 7. Key Performance Indicators ─────────────────────────────────────
      kpi_sector: 'Jewellery & Trading',
      kpi_values: [
        { kpi_name: 'Revenue from Operations', unit: '₹ in Cr', fy1_value: 1680.59, fy2_value: 1512.20, fy3_value: 1272.64 },
        { kpi_name: 'EBITDA Margin', unit: '%', fy1_value: 8.68, fy2_value: 4.08, fy3_value: 3.17 },
        { kpi_name: 'PAT Margin', unit: '%', fy1_value: 5.79, fy2_value: 2.45, fy3_value: 1.73 },
        { kpi_name: 'Return on Equity', unit: '%', fy1_value: 53.06, fy2_value: 31.98, fy3_value: 25.51 },
        { kpi_name: 'Return on Capital Employed', unit: '%', fy1_value: 77.09, fy2_value: 50.54, fy3_value: 42.30 },
        { kpi_name: 'Debtor Days', unit: 'Days', fy1_value: 33, fy2_value: 13, fy3_value: 10 },
        { kpi_name: 'Creditor Days', unit: 'Days', fy1_value: 2, fy2_value: 3, fy3_value: 2 },
        { kpi_name: 'Inventory Days', unit: 'Days', fy1_value: 45, fy2_value: 43, fy3_value: 42 },
        { kpi_name: 'Working Capital Cycle', unit: 'Days', fy1_value: 76, fy2_value: 53, fy3_value: 50 },
        { kpi_name: 'Inventory Turnover Ratio', unit: 'Times', fy1_value: 8.18, fy2_value: 8.45, fy3_value: 8.77 },
        { kpi_name: 'Sales to Retained Customers', unit: '₹ in Cr', fy1_value: 1207.72, fy2_value: 1057.68, fy3_value: 913.00 },
        { kpi_name: 'Ratio of Sales through Retained Customers', unit: '%', fy1_value: 71.86, fy2_value: 69.94, fy3_value: 71.74 },
        { kpi_name: 'Sales Volume', unit: 'Kg', fy1_value: 2369.91, fy2_value: 2551.68, fy3_value: 2807.01 },
      ],

      // ── 8. Risk Factors ───────────────────────────────────────────────────
      internal_risks: 'Our top 10 customers accounted for ₹483.84 Crores, ₹485.13 Crores and ₹379.51 Crores representing 28.79%, 32.08% and 29.82% of our revenue from operations for Fiscals 2026, 2025 and 2024, respectively. We do not have any long-term contracts with our customers and any loss of one or more of our top customers, or the deterioration of their financial condition or prospects, or a reduction in their demand for our products, could adversely affect our business, results of operations, financial condition and cash flows.\n\nA significant portion of our business operations and revenue generation is concentrated in the western and southern India, which accounted for ₹1,309.80 Crores, ₹1,071.06 Crores and ₹863.01 Crores representing 77.94%, 70.83% and 67.81% of our revenue from operations in Fiscals 2026, 2025 and 2024, respectively. This regional concentration could expose our Company to economic, cultural, geopolitical and local market risks.\n\nOur ability to retain existing customers and acquire new customers in a cost-effective manner is critical to our business, and any failure to do so may adversely affect our business, financial condition and results of operations.\n\nOur employees may engage in misconduct, fraud or other improper activities, including non-compliance with regulatory standards and requirements. Additionally, we are exposed to risks of unauthorised disclosure or misuse of our designs by our Karigars, which may adversely affect our competitiveness, business and financial performance.\n\nOur top 10 suppliers accounted for ₹1,019.96 Crores, ₹1,070.99 Crores and ₹971.32 Crores, representing 67.60%, 74.14% and 77.64% of our total purchases in Fiscals 2026, 2025 and 2024, respectively. We are dependent on such suppliers for gold bullion, our key raw material, and do not have long-term arrangements with them. Any increase in raw material costs or disruption in supply could adversely affect our business, financial condition and results of operations.\n\nOur business is dependent on the availability and price of gold, and volatility in gold prices or disruptions in supply may adversely affect our demand, working capital requirements, margins and overall business operations.\n\nOur business is working capital intensive, and any inability to obtain or renew adequate working capital facilities on commercially acceptable terms could adversely affect our liquidity, cash flows and results of operations.\n\nOur operations are dependent on efficient logistics and coordination across our Manufacturing Units, primary distribution hub and branch network, and any delay or disruption in such processes or third-party logistics services may adversely affect our business, financial condition and results of operations. We also may be exposed to the risk of theft, accidents and/or loss of our products in transit.\n\nOur business is dependent on effective inventory management, and any inability to accurately forecast demand or manage inventory levels may adversely affect our business, financial condition, results of operations and cash flows. Additionally, we maintain significant inventory at our premises and any loss due to theft, fraud or other incidents may adversely affect our business and results of operations.\n\nWe have experienced negative cash flows in the past. Any negative cash flows in the future would adversely affect our cash flow requirements, which may adversely affect our ability to operate our business and implement our growth plans, thereby affecting our financial condition.',
      external_risks: '1. Changes in customs duty or import regulations on gold and precious metals could affect our input costs.\n2. Changes in GST rates applicable to gold jewellery could affect demand.\n3. Macroeconomic factors affecting discretionary consumer spending on jewellery.',
      risk_narrative_text: 'Set forth below is a summary of our top 10 internal risk factors: (1) Revenue concentration among our top 10 customers; (2) Regional concentration of revenue in western and southern India; (3) Ability to retain and acquire customers cost-effectively; (4) Risk of employee misconduct or misuse of designs by Karigars; (5) Concentration among our top 10 suppliers for gold bullion; (6) Dependence on the availability and price of gold; (7) Working-capital intensive operations; (8) Dependence on efficient logistics across our manufacturing units and branch network; (9) Dependence on effective inventory management given significant on-premises inventory; and (10) A history of negative cash flows in certain periods.',
      // Matches the Top-5 Customer Revenue table's fy1_pct below (18.91%).
      customer_concentration_pct: 18.91,

      // ── 9. WACA ───────────────────────────────────────────────────────────
      waca_table: [
        { shareholder: 'Madan Sardarmal Kothari', shares_held: 46536000, waca_per_share: 0.05, shares_acquired_last_1yr: 48257500, waca_last_1yr: '' },
        { shareholder: 'Raj Madan Kothari', shares_held: 31499958, waca_per_share: 0.35, shares_acquired_last_1yr: 30769960, waca_last_1yr: 0.34 },
        { shareholder: 'Khushbu Raj Kothari', shares_held: 420000, waca_per_share: '', shares_acquired_last_1yr: 400000, waca_last_1yr: '' },
        { shareholder: 'Taruna Madan Kothari', shares_held: 15624000, waca_per_share: 0.07, shares_acquired_last_1yr: 18817500, waca_last_1yr: '' },
      ],
      waca_ca_certificate_date: '2026-07-25',

      // ── 10. Board & KMP ───────────────────────────────────────────────────
      directors: [
        { name: 'Madan Sardarmal Kothari', din: '01234567', designation: 'Chairman and Whole-time Director', independent_flag: 'no' },
        { name: 'Raj Madan Kothari', din: '01234568', designation: 'Managing Director and Chief Executive Officer', independent_flag: 'no' },
        { name: 'Khushbu Raj Kothari', din: '01234569', designation: 'Whole-time Director', independent_flag: 'no' },
        { name: 'Sangeeta Jogen Parekh', din: '02345671', designation: 'Independent Director', independent_flag: 'yes' },
        { name: 'Milin Jagdish Ramani', din: '02345672', designation: 'Independent Director', independent_flag: 'yes' },
        { name: 'Ankush Gupta', din: '02345673', designation: 'Independent Director', independent_flag: 'yes' },
      ],
      kmp: [
        { name: 'Salvi Abhay Sakaria', designation: 'Chief Financial Officer' },
        { name: 'Rahul Rasikbhai Jethwa', designation: 'Company Secretary and Compliance Officer' },
      ],

      // ── 11. Auditor Qualifications ────────────────────────────────────────
      auditor_qualifications: 'There have been no reservations, qualifications and adverse remarks in the Restated Financial Information of our Company for the financial year ended March 31, 2026, March 31, 2025, and March 31, 2024, and the examination report thereon.',

      // ── 12. Litigation ────────────────────────────────────────────────────
      litigation_summary: [
        { entity_type: 'Company - By', criminal_count: 6, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 1.86 },
        { entity_type: 'Company - Against', criminal_count: 0, tax_count: 1, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0.25 },
        { entity_type: 'Directors - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
        { entity_type: 'Directors - Against', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
        { entity_type: 'Promoters - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
        { entity_type: 'Promoters - Against', criminal_count: 0, tax_count: 3, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 1.24 },
        { entity_type: 'Key Managerial Personnel - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
        { entity_type: 'Key Managerial Personnel - Against', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
        { entity_type: 'Senior Management - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
        { entity_type: 'Senior Management - Against', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
      ],
      litigations_company: 'By our Company: 6 criminal proceedings, aggregate amount ₹1.86 Crores. Against our Company: 1 tax proceeding, aggregate amount ₹0.25 Crores.',
      litigations_promoters: 'Against our Promoters: 3 tax proceedings, aggregate amount ₹1.24 Crores. No criminal, statutory/regulatory or civil proceedings.',

      // ── Statutory & Compliance (not rendered in the Abridged Prospectus;
      //     not disclosed in the source summary either — plausible placeholders) ─
      pan: 'AABCM1234K',
      pan_name: 'Master Chains N Jewels Limited',
      gstin: '27AABCM1234K1Z5',
      gst_annual_turnover: 1680.59,
      incorporation_date: '1997-04-15',
      company_type: 'Public Limited Company',
      authorized_capital: 10.0,
      paid_up_capital_pre: 4.5,
      promoter_shareholding_pre_pct: 99.55,
      auditor_name: 'CGCA & Associates LLP, Chartered Accountants',
      auditor_membership: '123393W/W100755',
      expansion_amount: 0,
      working_capital_amount: 350.0,
      debt_repayment_amount: 0,
      issue_expenses: 0,
      declaration_signed: true,
      material_contracts_desc: '1. Underwriting Agreement with Systematix Corporate Services Limited.\n2. Registrar Agreement dated with Bigshare Services Private Limited.\n3. Business Transfer Agreement dated October 18, 2025 for acquisition of Aurous Jewels LLP and Kanak Shilp.',
      rpt_declared: 'Remuneration paid to promoter-directors in the ordinary course of business, disclosed in full in the Restated Financial Information.',
      summary_business_note: 'Master Chains N Jewels Limited is a Mumbai-based designer, manufacturer and wholesaler of gold jewellery across multiple karatages, with revenue of ₹1,680.59 Crores in Fiscal 2026.',
      business_model: 'Wholesale distribution of gold jewellery to single-store and multi-store Retail Jewellers, manufactured across two owned units in Mumbai with job-work and design customization capabilities.',
      key_customers: 'Single-store and multi-store Retail Jewellers.',
      promoters_names: 'Madan Sardarmal Kothari, Raj Madan Kothari, Khushbu Raj Kothari, Taruna Madan Kothari',
      directors_names: 'Madan Sardarmal Kothari, Raj Madan Kothari, Khushbu Raj Kothari, Sangeeta Jogen Parekh (Independent), Milin Jagdish Ramani (Independent), Ankush Gupta (Independent)',
      promoter_experience: 'Madan Sardarmal Kothari has over 29 years of experience in jewellery manufacturing. Raj Madan Kothari has over 22 years of experience and holds a mechanical engineering degree. Khushbu Raj Kothari has over 10 years of experience in administrative and marketing operations. Taruna Madan Kothari has over 27 years of experience in the jewellery industry.',
      fy_years: 'Fiscal 2024, Fiscal 2025, Fiscal 2026',
      revenue_fy_latest: 1680.59,
      pat_fy_latest: 97.27,
      borrowings_latest: 214.19,
    };

    let updatedSession = {
      ...sessionData,
      form_data: sampleForm
    };

    if (type === 'complete') {
      updatedSession.extracted_data = {
        financials: {
          fy_years: 'Fiscal 2024, Fiscal 2025, Fiscal 2026',
          revenue_fy_latest: 1680.59,
          pat_fy_latest: 97.27,
          borrowings_latest: 214.19,
          // Deliberately a different firm than the Compliance tab's auditor_name
          // below — represents an auditor rotation that happened after this
          // financial statement was signed but before the current form entry
          // was updated. Surfaces a "Statutory Auditor Name Mismatch" conflict.
          auditor_name: 'R.K. Associates & Co., Chartered Accountants',
          auditor_membership: '123393W/W100755',
          net_worth: [{ fy: 'Fiscal 2026', value: 231.96 }, { fy: 'Fiscal 2025', value: 134.65 }, { fy: 'Fiscal 2024', value: 97.52 }],
          revenue_from_operations: [{ fy: 'Fiscal 2026', value: 1680.59 }, { fy: 'Fiscal 2025', value: 1512.20 }, { fy: 'Fiscal 2024', value: 1272.64 }],
        },
        gst: {
          gstin: '27AABCM1234K1Z5',
          // Deliberately the company's pre-conversion name (see former_name
          // above) — the GST certificate was never amended after the name
          // change, surfacing a real "Company Name Inconsistency Across
          // Documents" conflict on the Filing Dashboard.
          company_name: 'Master Chain Private Limited',
          gst_annual_turnover: 1680.59,
          // Deliberately predates incorporation_date (1997-04-15) below —
          // surfaces a "GST Registration Predates Incorporation" conflict.
          registration_date: '1997-03-01',
          filing_status: 'Active'
        },
        incorporation: {
          cin: 'U36911MH1997PLC107966',
          company_name: 'Master Chains N Jewels Limited',
          incorporation_date: '1997-04-15',
          registered_office: 'Unit 1/2, 6th Floor, Plot - 219/221, Mehta Mansion, Sheikh Memon Street, Zaveri Bazar, Kalbadevi, Mumbai, Maharashtra, 400 002, India',
          company_type: 'Public Limited Company'
        },
        compliance: {
          pan: 'AABCM1234K',
          pan_name: 'Master Chains N Jewels Limited',
          tan: 'MUMM12345B'
        },
        moa_aoa: {
          authorized_capital: 10.0,
          face_value_per_share: 10,
          objects_clause: 'To carry on the business of designing, manufacturing, job-work and dealing in gold, silver, diamond and other precious and semi-precious stone jewellery of every description, and to establish, operate and maintain manufacturing units, showrooms and distribution facilities for the aforesaid purposes.',
        },
        cap_table: {
          promoter_shareholding_pre_pct: 99.55,
          pre_offer_shareholding: [
            { shareholder: 'Madan Sardarmal Kothari', shares: 46536000, pct: 49.24 },
            { shareholder: 'Raj Madan Kothari', shares: 31499958, pct: 33.33 },
            { shareholder: 'Khushbu Raj Kothari', shares: 420000, pct: 0.44 },
            { shareholder: 'Taruna Madan Kothari', shares: 15624000, pct: 16.53 },
            { shareholder: 'Neha Varun Muthaliya (Promoter Group)', shares: 420000, pct: 0.44 },
            { shareholder: 'Salvi Abhay Sakaria', shares: 21, pct: 0.00 },
            { shareholder: 'Gopinathan Venugopal', shares: 21, pct: 0.00 },
          ],
          promoter_group_members: [
            { name: 'Neha Varun Muthaliya', relationship: 'Member of the Promoter Group' },
          ],
        },
        dir12: {
          directors: [
            { name: 'Madan Sardarmal Kothari', din: '01234567', designation: 'Chairman and Whole-time Director', independent_flag: 'no' },
            { name: 'Raj Madan Kothari', din: '01234568', designation: 'Managing Director and Chief Executive Officer', independent_flag: 'no' },
            { name: 'Khushbu Raj Kothari', din: '01234569', designation: 'Whole-time Director', independent_flag: 'no' },
            { name: 'Sangeeta Jogen Parekh', din: '02345671', designation: 'Independent Director', independent_flag: 'yes' },
            { name: 'Milin Jagdish Ramani', din: '02345672', designation: 'Independent Director', independent_flag: 'yes' },
            { name: 'Ankush Gupta', din: '02345673', designation: 'Independent Director', independent_flag: 'yes' },
          ],
          kmp: [
            { name: 'Salvi Abhay Sakaria', designation: 'Chief Financial Officer' },
            { name: 'Rahul Rasikbhai Jethwa', designation: 'Company Secretary and Compliance Officer' },
          ],
        },
        litigation_schedule: {
          litigation_summary: [
            { entity_type: 'Company - By', criminal_count: 6, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 1.86 },
            { entity_type: 'Company - Against', criminal_count: 0, tax_count: 1, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0.25 },
            { entity_type: 'Directors - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
            { entity_type: 'Directors - Against', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
            { entity_type: 'Promoters - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
            { entity_type: 'Promoters - Against', criminal_count: 0, tax_count: 3, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 1.24 },
            { entity_type: 'Key Managerial Personnel - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
            { entity_type: 'Key Managerial Personnel - Against', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
            { entity_type: 'Senior Management - By', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
            { entity_type: 'Senior Management - Against', criminal_count: 0, tax_count: 0, statutory_regulatory_count: 0, civil_litigation_count: 0, aggregate_amount_cr: 0 },
          ],
        },
        industry_report: {
          industry_market_size: "India's gems and jewellery industry contributes approximately 7% of the country's GDP and around 15% of total merchandise exports. Gold accounted for approximately 80% of the market by material type in 2025 (followed by diamonds at 10%, silver at 5%, and other materials at 5%).",
          industry_cagr: '8.5%',
          industry_report_source: 'CARE Report',
        },
        sales_register: {
          top5_customer_revenue_table: [
            { customer_name: 'Top 5 customers', fy1_revenue: 317.85, fy1_pct: 18.91, fy2_revenue: 291.56, fy2_pct: 19.28, fy3_revenue: 248.80, fy3_pct: 19.55 },
          ],
          key_geographies_served: "We have a significant presence in the western region followed by southern region of the country. For the Fiscal 2026, 2025 and 2024, we majorly catered to Maharashtra, Karnataka and Telangana, Gujarat and Punjab.",
          gst_annual_turnover: 1680.59,
        },
      };

      updatedSession.uploaded_files = [
        { filename: 'financial_statements_restated_3yrs.pdf', type: 'financials', size: 142452 },
        { filename: 'gst_registration_cert_reg06.pdf', type: 'gst', size: 91310 },
        { filename: 'incorporation_certificate_roc.pdf', type: 'incorporation', size: 101411 },
        { filename: 'company_pan_tan_licenses.pdf', type: 'compliance', size: 58124 },
        { filename: 'moa_aoa.pdf', type: 'moa_aoa', size: 76890 },
        { filename: 'register_of_members_cap_table.pdf', type: 'cap_table', size: 68240 },
        { filename: 'dir12_board_resolutions.pdf', type: 'dir12', size: 54310 },
        { filename: 'litigation_schedule.pdf', type: 'litigation_schedule', size: 61980 },
        { filename: 'industry_report_care.pdf', type: 'industry_report', size: 118420 },
        { filename: 'sales_register_gst_sales.pdf', type: 'sales_register', size: 73150 },
      ];
    }

    setSessionData(updatedSession);

    // Sync form_data to backend
    try {
      await authFetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: updatedSession.form_data })
      });
    } catch (err) {
      console.error(err);
    }

    // Always sync full session (including extracted_data) to backend
    try {
      await authFetch('/api/session_sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSession)
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setLoading(false);
      // Trigger validation after full sync
      await validateSession();
    }
  };

  // ── Wizard step navigation ──────────────────────────────────────────────
  // tabOrder/steps are imported from Wizard.jsx so the sidebar nav and the wizard's own
  // internal tab switch can never drift apart the way the old hardcoded copies here did.
  const tabOrder = WIZARD_TAB_ORDER;

  const handleNextTab = () => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx >= 0 && idx < tabOrder.length - 1) {
      setActiveTab(tabOrder[idx + 1]);
    }
  };

  const handlePrevTab = () => {
    const idx = tabOrder.indexOf(activeTab);
    if (idx > 0) {
      setActiveTab(tabOrder[idx - 1]);
    }
  };

  // Sync session on upload changes - always persist extracted_data
  useEffect(() => {
    if (!loading) {
      authFetch('/api/session_sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      })
        .then(() => validateSession())
        .catch(err => console.error('Full session sync failed:', err));
    }
  }, [sessionData.extracted_data, sessionData.uploaded_files]);

  const handleGenerateProspectus = async () => {
    setGenerating(true);
    try {
      const res = await authFetch('/api/generate', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Generation failed: ${err.detail || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const docxBlob = new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SME_IPO_Draft_Prospectus.docx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download prospectus. Make sure the backend is running.');
    } finally {
      setGenerating(false);
    }
  };

  const steps = WIZARD_STEPS;

  // Every `required: true` field from schema.json that each wizard tab actually renders —
  // cross-referenced directly against backend/schema.json and every renderInput/renderRows
  // call in Wizard.jsx (not hand-picked "representative" fields, which previously could show
  // a tab as green while other real required fields in it were still empty, or amber when
  // everything real was already filled). Regenerate this list if a tab's rendered fields or
  // schema.json's required flags change.
  const STEP_REQUIRED_FIELDS = {
    cover: ['cin', 'company_acronym', 'company_name', 'company_secretary_name', 'contact_email', 'contact_phone', 'face_value_per_share', 'fresh_issue_size_cr', 'issue_size', 'lead_manager', 'price_band', 'promoter_names', 'registered_office', 'registrar'],
    business: ['business_strategies', 'business_strengths', 'industries_served', 'key_geographies_served', 'products_services_description', 'top5_customer_revenue_table', 'typical_customers'],
    industry: ['industry_name', 'industry_report_source'],
    promoters: ['promoters'],
    objects: ['general_corp_amount', 'use_of_proceeds'],
    shareholding: ['pre_offer_shareholding', 'promoter_group_members'],
    financials: ['ebitda', 'eps_basic', 'eps_diluted', 'equity_share_capital', 'net_worth', 'pat', 'revenue_from_operations', 'total_borrowings'],
    kpis: ['kpi_sector', 'kpi_values'],
    risks: ['external_risks', 'internal_risks'],
    waca: ['waca_ca_certificate_date', 'waca_table'],
    board: ['directors', 'kmp'],
    auditor: ['auditor_qualifications'],
    litigation: ['litigation_summary'],
    compliance: ['auditor_membership', 'auditor_name', 'authorized_capital', 'business_model', 'debt_repayment_amount', 'declaration_signed', 'expansion_amount', 'issue_expenses', 'material_contracts_desc', 'paid_up_capital_pre', 'pan', 'promoter_shareholding_pre_pct', 'rpt_declared', 'working_capital_amount'],
  };

  // list/table fields (arrays) only count as "filled" once they hold at least one row —
  // an empty array is falsy-adjacent but `[] !== ''` is true, so a naive check would show
  // "complete" for a field the user never touched.
  const isFieldFilled = (val) => {
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  // Merge extracted_data + form_data (mirrors backend validator.py: form_data — the user's
  // own edits — must win over raw extraction, not the other way round, or correcting an
  // auto-extracted value in the wizard wouldn't update the sidebar).
  const getMergedFormData = () => {
    const data = {};
    for (const docType of Object.values(sessionData.extracted_data || {})) {
      if (docType && typeof docType === 'object') Object.assign(data, docType);
    }
    Object.assign(data, sessionData.form_data);
    return data;
  };

  // {filled, total} of a step's real required fields — backs both the status dot/border
  // color and the "N/M" count badge, so both always agree with each other.
  const getStepFillCount = (stepId) => {
    const data = getMergedFormData();
    const stepFields = STEP_REQUIRED_FIELDS[stepId] || [];
    const filled = stepFields.filter(f => {
      if (f === 'declaration_signed') return data[f] === true || data[f] === 'true';
      return isFieldFilled(data[f]);
    }).length;
    return { filled, total: stepFields.length };
  };

  const getStepStatus = (stepId) => {
    const stepFields = STEP_REQUIRED_FIELDS[stepId] || [];

    // Check if this step has inconsistencies first
    const stepInconsistencies = (validationResults?.inconsistencies || []).filter(inc =>
      stepFields.some(f => inc.description.toLowerCase().includes(f) || inc.title.toLowerCase().includes(f.replace('_', ' ')))
    );

    if (stepInconsistencies.length > 0) return 'error';

    const { filled, total } = getStepFillCount(stepId);

    if (filled === 0) return 'empty';
    if (filled === total) return 'complete';
    return 'in_progress';
  };

  const completedStepsCount = steps.filter(s => getStepStatus(s.id) === 'complete').length;
  const progressPct = Math.round((completedStepsCount / steps.length) * 100);

  const getStatusDot = (status) => {
    switch (status) {
      case 'complete':
        return <span className="w-2 h-2 rounded-full bg-emerald-500 block shrink-0" title="Section Complete" />;
      case 'in_progress':
        return <span className="w-2 h-2 rounded-full bg-amber-400 block shrink-0 animate-pulse" title="In Progress" />;
      case 'error':
        return <span className="w-2 h-2 rounded-full bg-red-500 block shrink-0 animate-pulse" title="Flagged Issues" />;
      case 'empty':
      default:
        return <span className="w-2 h-2 rounded-full bg-gray-200 block shrink-0" title="Not Started" />;
    }
  };

  // Left border bar on each sidebar step — reflects fill status (gray → amber while
  // partially filled → emerald once every representative field is filled, or red the
  // moment a contradiction is flagged), independent of which tab happens to be open.
  const getStatusBorderClass = (status) => {
    switch (status) {
      case 'complete': return 'border-emerald-500';
      case 'in_progress': return 'border-amber-400';
      case 'error': return 'border-red-500';
      case 'empty':
      default: return 'border-gray-200';
    }
  };

  const isWizardTab = tabOrder.includes(activeTab);
  const wizardStepIndex = isWizardTab ? tabOrder.indexOf(activeTab) : -1;

  const ADMIN_NAV = [
    { id: 'banker_dashboard', label: 'Banker Certification', icon: Landmark },
    { id: 'audit_trail', label: 'Audit Trail', icon: History },
  ];
  const ADMIN_TITLES = Object.fromEntries(ADMIN_NAV.map(n => [n.id, n.label]));

  const pageTitle = activeTab === 'dashboard'
    ? 'Filing Dashboard'
    : activeTab === 'uploads'
      ? 'Document Vault'
      : ADMIN_TITLES[activeTab]
        ? ADMIN_TITLES[activeTab]
        : steps.find(s => s.id === activeTab)?.label || 'Drafting Wizard';

  // Flat, searchable index for the topbar quick-switcher — real navigation
  // over existing tabs/handlers, not a fake search backend.
  const QUICK_SWITCH_ITEMS = [
    { id: 'dashboard', label: 'Filing Dashboard', icon: LayoutDashboard },
    { id: 'uploads', label: 'Document Vault', icon: FolderOpen },
    ...steps.map(s => ({ id: s.id, label: s.label, icon: FileText })),
    ...ADMIN_NAV,
  ];
  const quickSwitchResults = quickSwitchQuery.trim()
    ? QUICK_SWITCH_ITEMS.filter(item => item.label.toLowerCase().includes(quickSwitchQuery.trim().toLowerCase()))
    : QUICK_SWITCH_ITEMS;

  const jumpTo = (tabId) => {
    setActiveTab(tabId);
    setQuickSwitchOpen(false);
    setQuickSwitchQuery('');
    setMobileNavOpen(false);
  };

  /* ── Shared nav row — used by both the desktop sidebar and mobile drawer ── */
  const NavItem = ({ label, icon: Icon, active, collapsed, onClick }) => (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${collapsed ? 'justify-center' : ''} ${active
          ? 'bg-accent-500 text-white shadow-sm shadow-accent-500/30'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
        }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-gray-400'}`} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  /* ── Full sidebar contents, reused by the persistent desktop rail and the
     mobile overlay drawer (which always renders expanded) ── */
  const SidebarContent = ({ collapsed, onNavigate }) => {
    const go = (id) => { setActiveTab(id); if (onNavigate) onNavigate(); };
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand / Logo */}
        <div className={`px-4 py-4 border-b border-slate-800 flex items-center gap-3 bg-gradient-to-r from-[#0d1f2d] via-[#1a3a4a] to-[#0d2b3e] text-white ${collapsed ? 'justify-center px-2' : ''}`}>
          <img
            src="/logo.png"
            alt="IPO Sherpa"
            className="h-9 w-auto shrink-0 rounded-lg drop-shadow-[0_4px_16px_rgba(58,124,165,0.45)]"
          />
          {!collapsed && (
            <div>
              <h1 className="font-display font-bold text-[14.5px] text-white leading-tight tracking-tight flex items-center gap-1">
                IPO <span className="text-[#81C3D7]">Sherpa</span>
              </h1>
              <p className="text-[9px] uppercase font-bold tracking-widest text-accent-400/80 mt-0.5">SEBI IPO Workspace</p>
            </div>
          )}
        </div>

        {/* Sync status pill */}
        {!collapsed && (
          <div className="px-5 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[10.5px] text-gray-400 font-semibold select-none">Auto-sync</span>
            {saveStatus === 'saved' && (
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1" title={`Synced at ${lastSavedTime}`}>
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Syncing…
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" /> Offline
              </span>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="p-3 space-y-0.5 overflow-y-auto flex-1 min-h-0">
          {!collapsed && (
            <div className="pb-2 px-3 pt-2 text-[10px] uppercase font-bold tracking-widest text-gray-400 select-none">
              Overview
            </div>
          )}

          <NavItem id="dashboard" label="Filing Dashboard" icon={LayoutDashboard} collapsed={collapsed} active={activeTab === 'dashboard'} onClick={() => go('dashboard')} />
          <NavItem id="uploads" label="Document Vault" icon={FolderOpen} collapsed={collapsed} active={activeTab === 'uploads'} onClick={() => go('uploads')} />

          {!collapsed && (
            <div className="pt-4 pb-2 px-3 text-[10px] uppercase font-bold tracking-widest text-gray-400 select-none">
              Drafting Wizard
            </div>
          )}

          <div className="space-y-0.5">
            {steps.map((step) => {
              const status = getStepStatus(step.id);
              const isActive = activeTab === step.id;
              const statusBorder = getStatusBorderClass(status);
              if (collapsed) {
                return (
                  <button
                    key={step.id}
                    onClick={() => go(step.id)}
                    title={`${step.label} — ${status.replace('_', ' ')}`}
                    className={`w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all cursor-pointer border-l-[3px] ${statusBorder} ${isActive ? 'bg-gray-50 shadow-sm' : 'hover:bg-gray-50'
                      }`}
                  >
                    {getStatusDot(status)}
                  </button>
                );
              }
              const { filled, total } = getStepFillCount(step.id);
              return (
                <button
                  key={step.id}
                  onClick={() => go(step.id)}
                  title={`${step.code} — ${status.replace('_', ' ')}`}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[12.5px] font-semibold rounded-xl transition-all cursor-pointer border-l-[3px] ${statusBorder} ${isActive
                      ? 'bg-gray-50 text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getStatusDot(status)}
                    <span className="truncate">{step.label}</span>
                  </div>
                  {/* Required-fields fraction — how many of this tab's actual required
                      fields (from schema.json) are filled, so a gap is a number you can
                      act on, not just a color. */}
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ml-1 ${
                      status === 'complete'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : status === 'error'
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : filled > 0
                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}>
                    {filled}/{total}
                  </span>
                </button>
              );
            })}
          </div>

          {!collapsed && (
            <div className="pt-4 pb-2 px-3 text-[10px] uppercase font-bold tracking-widest text-gray-400 select-none">
              Compliance &amp; Audit
            </div>
          )}
          {ADMIN_NAV.map(item => (
            <NavItem key={item.id} {...item} collapsed={collapsed} active={activeTab === item.id} onClick={() => go(item.id)} />
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-100">
          {!collapsed && (
            <div className="px-3 py-2.5 mb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold text-gray-500">Wizard progress</span>
                <span className="text-[10.5px] font-bold text-accent-600">{completedStepsCount}/{steps.length}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
          {!collapsed && confirmReset ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2 animate-fade-in-up">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Reset all data?
              </div>
              <p className="text-[10px] text-red-500 leading-relaxed">This will clear all form fields and uploaded documents.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition-all cursor-pointer"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 text-[11px] font-bold hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              title={collapsed ? 'Reset workspace' : undefined}
              className={`w-full py-2 px-3 rounded-xl text-[11.5px] font-semibold text-gray-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${collapsed ? '' : ''}`}
            >
              <LogOut className="w-3.5 h-3.5" /> {!collapsed && 'Reset workspace'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FB] text-gray-800 relative font-sans">

      {/* Pinned Top Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-100 z-50">
        <div
          className="h-full bg-accent-500 transition-all duration-700 ease-out rounded-r-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Desktop Sidebar (collapsible) ── */}
      <aside className={`${sidebarCollapsed ? 'w-[72px]' : 'w-64'} border-r border-gray-100 bg-white shrink-0 hidden md:flex flex-col sticky top-0 h-screen z-40 shadow-sm overflow-hidden transition-[width] duration-200`}>
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* ── Mobile Nav Drawer ── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col animate-fade-in-up">
            <div className="flex justify-end p-2 border-b border-gray-100">
              <button onClick={() => setMobileNavOpen(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-grow min-w-0 flex flex-col min-h-screen">

        {/* Top Header */}
        <header className="h-16 border-b border-gray-100 bg-white flex items-center gap-3 px-4 md:px-7 sticky top-0 z-30 shadow-sm select-none">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-all cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop sidebar collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex p-2 -ml-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all cursor-pointer shrink-0"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Breadcrumb + title */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-gray-400">
              <span className="text-[12px] font-semibold">IPO Sherpa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-[14px] font-bold text-gray-900 tracking-tight truncate max-w-[40vw]">
              {pageTitle}
            </h2>
            {isWizardTab && (
              <span className="hidden lg:inline-flex text-[10.5px] bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg font-semibold border border-gray-200 shrink-0">
                Step {wizardStepIndex + 1} / {steps.length}
              </span>
            )}
          </div>

          {/* Quick switcher — real navigation over existing tabs, not a search backend */}
          <div ref={quickSwitchRef} className="hidden lg:block relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickSwitchQuery}
              onChange={(e) => { setQuickSwitchQuery(e.target.value); setQuickSwitchOpen(true); }}
              onFocus={() => { setQuickSwitchOpen(true); setNotifOpen(false); setProfileOpen(false); }}
              placeholder="Jump to a section…"
              className="w-full text-[12.5px] font-medium bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-accent-400 focus:bg-white focus:ring-2 focus:ring-accent-100 transition-all"
            />
            {quickSwitchOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-80 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-card-lg py-1.5 z-50">
                {quickSwitchResults.length === 0 ? (
                  <p className="px-3 py-4 text-[12px] text-gray-400 text-center">No sections match "{quickSwitchQuery}"</p>
                ) : quickSwitchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => jumpTo(item.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-accent-50 hover:text-accent-700 transition-colors cursor-pointer text-left"
                  >
                    <item.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* SEBI compliance badge */}
            <div className="hidden xl:flex text-[10.5px] text-emerald-700 items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>SEBI ICDR Chapter IX</span>
            </div>

            {/* Notifications bell — real data: validation conflicts + regulatory alerts */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); setQuickSwitchOpen(false); }}
                className={`p-2 rounded-xl border transition-all cursor-pointer relative ${notifOpen ? 'bg-accent-50 border-accent-200 text-accent-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <Bell className="w-4 h-4" />
                {(regulatoryAlerts.length + (validationResults?.inconsistencies?.length || 0)) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                    {regulatoryAlerts.length + (validationResults?.inconsistencies?.length || 0)}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-card-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h4 className="text-[12.5px] font-bold text-gray-900">Notifications</h4>
                  </div>
                  {validationResults?.inconsistencies?.length > 0 && (
                    <button
                      onClick={() => { setActiveTab('dashboard'); setNotifOpen(false); }}
                      className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer flex items-start gap-2.5"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] font-bold text-gray-800">{validationResults.inconsistencies.length} SEBI compliance conflict{validationResults.inconsistencies.length === 1 ? '' : 's'}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">View on the Filing Dashboard</p>
                      </div>
                    </button>
                  )}
                  {regulatoryAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="px-4 py-3 border-b border-gray-50 last:border-b-0 flex items-start gap-2.5">
                      <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-gray-800 truncate">{alert.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{alert.date}</p>
                      </div>
                    </div>
                  ))}
                  {regulatoryAlerts.length === 0 && !(validationResults?.inconsistencies?.length > 0) && (
                    <p className="px-4 py-6 text-[12px] text-gray-400 text-center">You're all caught up.</p>
                  )}
                </div>
              )}
            </div>

            {/* Copilot toggle */}
            <button
              onClick={() => setCopilotOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer shadow-sm relative ${copilotOpen
                  ? 'bg-accent-500 text-white border-accent-500 shadow-accent'
                  : 'bg-white hover:bg-accent-50 text-gray-600 hover:text-accent-700 border-gray-200 hover:border-accent-200'
                }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${copilotOpen ? 'text-white' : 'text-accent-500'}`} />
              <span className="hidden lg:inline">AI Copilot</span>
              {validationResults?.inconsistencies?.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>

            {/* Primary CTA — reachable from any tab, not just the Dashboard card */}
            <button
              onClick={handleGenerateProspectus}
              disabled={generating}
              className="btn-primary !py-2 !px-3.5 !text-[11.5px]"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{generating ? 'Compiling…' : 'Generate Draft'}</span>
            </button>

            {/* Profile menu */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); setQuickSwitchOpen(false); }}
                className="w-9 h-9 rounded-full bg-accent-500 text-white text-[12px] font-bold flex items-center justify-center cursor-pointer hover:brightness-95 transition-all shrink-0"
              >
                {(user?.email || 'U').charAt(0).toUpperCase()}
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-card-lg z-50 py-1.5">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-accent-500 text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                      {(user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-gray-900 truncate">{user?.email || 'Workspace user'}</p>
                      <p className="text-[10.5px] text-gray-400">SME IPO Workspace</p>
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container — a soft blue wash on the Dashboard only, so its
            cards sit on a bit of the brand accent instead of flat white/grey;
            every other tab keeps the neutral page background. */}
        <div className={`flex-grow p-6 md:p-8 overflow-y-auto ${
          activeTab === 'dashboard'
            ? 'bg-gradient-to-br from-accent-50 via-[#F8F9FB] to-accent-50/60'
            : 'bg-[#F8F9FB]'
        }`}>
          {loading ? (


            <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
              <div className="flex flex-col items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-xl">
                  <Loader2 className="w-7 h-7 text-accent-400 animate-spin" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-[14px] font-bold text-white/80 tracking-wide">Preparing your workspace…</p>
                  <p className="text-[11px] text-white/35 font-medium">Fetching session · Running compliance checks</p>
                </div>
                <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  validationResults={validationResults}
                  sessionData={sessionData}
                  onGenerate={handleGenerateProspectus}
                  generating={generating}
                  onNavigateTab={setActiveTab}
                  onPreFill={handlePreFill}
                  lastSavedTime={lastSavedTime}
                  apiFetch={authFetch}
                />
              )}


              {activeTab === 'uploads' && (
                <Uploader
                  sessionData={sessionData}
                  onUploadSuccess={handleUploadSuccess}
                  apiFetch={authFetch}
                />
              )}


              {tabOrder.includes(activeTab) && (
                <Wizard
                  formData={sessionData.form_data}
                  extractedData={sessionData.extracted_data}
                  uploadedFiles={sessionData.uploaded_files}
                  onChange={handleFormChange}
                  activeTab={activeTab}
                  onNext={handleNextTab}
                  onPrev={handlePrevTab}
                  inconsistencies={validationResults?.inconsistencies}
                />
              )}

              {activeTab === 'banker_dashboard' && <BankerDashboard />}
              {activeTab === 'audit_trail' && <AuditTrail />}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="py-3 border-t border-gray-100 bg-white text-center text-[10.5px] text-gray-400 font-medium flex items-center justify-center gap-2 select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>AI-assisted draft under SEBI ICDR Chapter IX (Reg 229–259). Not a substitute for review by a SEBI-registered Category I Merchant Banker.</span>
        </footer>
      </main>

      <Copilot
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onApplySuggestion={handleApplySuggestion}
        apiFetch={authFetch}
      />
    </div>
  );
}
