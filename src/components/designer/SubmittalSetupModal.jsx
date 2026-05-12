/**
 * SubmittalSetupModal.jsx
 *
 * A self-contained, fully-functional pre-generation form modal.
 * Lives outside the canvas DOM stack — no pointer-event conflicts.
 * All inputs are rendered in a high-z-index portal-style overlay that
 * explicitly captures every pointer / keyboard event so the canvas
 * never steals focus.
 *
 * Props:
 *   project           – Project entity record
 *   devices           – Array of device objects (for auto-populating legend + battery)
 *   initialMeta       – Previously-saved submittal metadata (restored from project)
 *   onSave(meta)      – Called whenever data changes (debounced)
 *   onGenerate(meta)  – Called when user clicks "Generate Construction Drawings"
 *   onClose()         – Dismiss the modal without generating
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Loader2, Building2, FileText, GitBranch, Battery, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// ─── Default values ────────────────────────────────────────────────────────────

const DEFAULT_GENERAL_NOTES = `1. All work shall comply with the latest NEC and local code requirements. All equipment shall be UL-listed and labeled for the intended use.
2. All wiring shall be in galvanized rigid steel or EMT conduit, minimum 3/4-inch trade size, unless otherwise noted.
3. All empty conduits shall include pull strings. Seal all conduit penetrations through fire-rated assemblies.
4. Field verify all device locations and mounting heights with owner's representative prior to installation.
5. Coordinate all work with the fire alarm authority having jurisdiction (AHJ) prior to starting work.
6. Provide all branch circuit conduit, cabling, and connections for complete operational system.
7. Contractor shall provide all required fire watch during system shutdown or construction.
8. All penetrations through fire-rated walls, floors, or ceilings shall be sealed to restore original fire rating.
9. Provide temporary power/wiring during cut-over to maintain fire alarm protection during construction.
10. Perform full system acceptance test per NFPA 72 §14 in the presence of the AHJ.
11. Provide all record drawings (as-built) and system operating manuals upon project completion.
12. All conduit runs and device locations are schematic — verify exact routing in the field.`;

const DEFAULT_SEQUENCE_OF_OPS = `SYSTEM DESCRIPTION:
The fire alarm system is a fully addressable, two-wire SLC system. All initiating devices and notification appliances are individually addressable and supervised.

ALARM — INITIATING:
Upon activation of any smoke detector, heat detector, manual pull station, or waterflow switch, the FACP shall:
1. Sound all horn/strobe notification appliances in the building (temporal code-3 pattern per NFPA 72 §18.4.2).
2. Transmit alarm signal to the central monitoring station.
3. Release all magnetic door holders.
4. Shut down HVAC air-handling units (except those serving pressurization or exhaust systems).
5. Initiate elevator recall per ASME A17.1.

SUPERVISORY:
Upon activation of a valve tamper switch, the FACP shall sound a distinct supervisory signal and transmit to the monitoring station. NAC and notification appliances shall NOT activate on supervisory conditions.

TROUBLE:
Open or short circuit trouble conditions shall sound an audible trouble signal at the FACP and transmit to the monitoring station.

SILENCING / RESETTING:
The FACP may be silenced by authorized personnel. The system shall require manual reset after alarm verification. Refer to manufacturer instructions for reset sequence.`;

const DEFAULT_DRAWING_INDEX = `FA0.01 — Fire Alarm Legend & General Requirements
FA5.01 — Fire Alarm Floor Plan
FA5.10 — Fire Alarm One-Line Diagrams Plan`;

const DEVICE_CURRENT_MAP = {
  smoke_detector:    { standby: 0.40, alarm: 4.5,  label: 'Smoke Detector' },
  heat_detector:     { standby: 0.30, alarm: 3.0,  label: 'Heat Detector' },
  pull_station:      { standby: 0.20, alarm: 0.5,  label: 'Manual Pull Station' },
  duct_detector:     { standby: 1.20, alarm: 5.0,  label: 'Duct Smoke Detector' },
  horn_strobe:       { standby: 0.00, alarm: 95.0, label: 'Horn / Strobe' },
  strobe:            { standby: 0.00, alarm: 75.0, label: 'Strobe Only' },
  speaker:           { standby: 0.00, alarm: 50.0, label: 'Speaker' },
  horn:              { standby: 0.00, alarm: 40.0, label: 'Horn' },
  waterflow_switch:  { standby: 0.20, alarm: 0.5,  label: 'Waterflow Switch' },
  valve_tamper:      { standby: 0.20, alarm: 0.5,  label: 'Valve Tamper' },
  co_detector:       { standby: 0.40, alarm: 4.5,  label: 'CO Detector' },
  elevator_recall:   { standby: 0.40, alarm: 4.5,  label: 'Elevator Recall Det.' },
  monitor_module:    { standby: 0.30, alarm: 0.5,  label: 'Monitor Module' },
  control_module:    { standby: 0.30, alarm: 10.0, label: 'Control Module' },
  door_holder:       { standby: 400,  alarm: 400,  label: 'Door Holder (24VDC)' },
  facp:              { standby: 300,  alarm: 1000, label: 'FACP (base)' },
};

function buildDefaultBatteryRows(devices) {
  const counts = {};
  (devices || []).forEach(d => {
    const key = d.type || 'smoke_detector';
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).map(([type, qty]) => {
    const curr = DEVICE_CURRENT_MAP[type] || { standby: 0.5, alarm: 5.0, label: type };
    return {
      id: type,
      label: curr.label,
      qty,
      standbymA: curr.standby,
      alarmmA: curr.alarm,
    };
  });
}

// ─── Small sub-components ──────────────────────────────────────────────────────

function SectionHeader({ icon, title, expanded, onToggle }) {
  const IconComp = icon;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        {IconComp && <IconComp className="w-4 h-4 text-orange-500" />}
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
    </button>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SubmittalSetupModal({ project, devices = [], initialMeta = {}, onSave, onGenerate, onClose }) {
  // ── Form state ──
  const [meta, setMeta] = useState(() => buildInitialMeta(project, devices, initialMeta));
  const [errors, setErrors] = useState({});
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState({ project: true, company: true, notes: false, sequence: false, battery: false, revisions: false });
  const saveTimerRef = useRef(null);

  // ── Stop ALL events propagating to canvas ──────────────────────────────────
  const stopAll = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // ── Auto-save on meta change ───────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave?.(packMeta(meta));
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [meta]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const set = (field) => (e) => setMeta(m => ({ ...m, [field]: e.target.value }));
  const setDirect = (field, value) => setMeta(m => ({ ...m, [field]: value }));
  const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  // Battery row helpers
  const setBattRow = (idx, col, val) => setMeta(m => {
    const rows = [...(m.batteryRows || [])];
    rows[idx] = { ...rows[idx], [col]: val };
    return { ...m, batteryRows: rows };
  });

  // Revision helpers
  const setRev = (idx, col, val) => setMeta(m => {
    const revs = [...(m.revisions || Array(5).fill(null).map((_, i) => ({ no: String(i+1), date:'', by:'', text:'' })))];
    revs[idx] = { ...revs[idx], [col]: val };
    return { ...m, revisions: revs };
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!meta.prepared_by?.trim()) errs.prepared_by = 'Required';
    if (!meta.company_name?.trim()) errs.company_name = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Battery calculation ────────────────────────────────────────────────────
  const battCalc = useMemo_battery(meta);

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!validate()) {
      toast.error('Please fill in all required fields before generating.');
      // Expand sections that have errors
      if (errors.prepared_by || errors.company_name) setExpanded(p => ({ ...p, project: true, company: true }));
      return;
    }
    setGenerating(true);
    try {
      await onGenerate?.(packMeta(meta));
    } finally {
      setGenerating(false);
    }
  };

  const totalDevices = devices.length;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onPointerDown={stopAll}
      onPointerUp={stopAll}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onClick={stopAll}
      onKeyDown={stopAll}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '94vh' }}
        onPointerDown={stopAll}
        onMouseDown={stopAll}
        onClick={stopAll}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Construction Drawing Submittal</h2>
              <p className="text-xs text-slate-500">
                {totalDevices} devices · {project?.num_floors || 1} floor(s) · 36″×24″ vector PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${hasErrors ? 'bg-red-200 text-red-700' : 'bg-orange-200'}`}>1</span>
            Fill in project details
          </div>
          <div className="h-px flex-1 bg-orange-200" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">2</span>
            Generate PDF
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── PROJECT INFORMATION ── */}
          <div className="border-b border-slate-200">
            <SectionHeader icon={FileText} title="Project Information" expanded={expanded.project} onToggle={() => toggle('project')} />
            {expanded.project && (
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Prepared By" required error={errors.prepared_by}>
                    <Input
                      className="h-8 text-sm"
                      placeholder="M.A. Johnson"
                      value={meta.prepared_by || ''}
                      onChange={set('prepared_by')}
                      onFocus={stopAll}
                    />
                  </Field>
                  <Field label="Checked By">
                    <Input
                      className="h-8 text-sm"
                      placeholder="R.K. Smith"
                      value={meta.checked_by || ''}
                      onChange={set('checked_by')}
                    />
                  </Field>
                  <Field label="Project Manager">
                    <Input
                      className="h-8 text-sm"
                      value={meta.project_manager || ''}
                      onChange={set('project_manager')}
                    />
                  </Field>
                  <Field label="Project Number">
                    <Input
                      className="h-8 text-sm"
                      placeholder="2024-FA-0123"
                      value={meta.project_number || ''}
                      onChange={set('project_number')}
                    />
                  </Field>
                  <Field label="Submittal Date">
                    <Input
                      className="h-8 text-sm"
                      placeholder={new Date().toLocaleDateString()}
                      value={meta.submittal_date || ''}
                      onChange={set('submittal_date')}
                    />
                  </Field>
                  <Field label="Battery Override (Ah)">
                    <Input
                      className="h-8 text-sm"
                      placeholder="Auto-calculated if blank"
                      value={meta.battery_callout || ''}
                      onChange={set('battery_callout')}
                    />
                  </Field>
                </div>
                <Field label="Scope of Work">
                  <Textarea
                    className="text-sm min-h-[70px] resize-y"
                    placeholder="e.g. Tenant improvement — new addressable fire alarm system. All devices addressable per NFPA 72. Provide new FACP, SLC devices, and NAC notification appliances…"
                    value={meta.scope_of_work || ''}
                    onChange={set('scope_of_work')}
                  />
                </Field>
                <Field label="Monitoring Notes (optional override)">
                  <Textarea
                    className="text-sm min-h-[40px] resize-y"
                    placeholder="Auto-generated if blank"
                    value={meta.monitoring_notes || ''}
                    onChange={set('monitoring_notes')}
                  />
                </Field>
                <Field label="Drawing Index (one line per sheet)">
                  <Textarea
                    className="text-sm min-h-[60px] resize-y font-mono"
                    value={meta.drawing_index_lines || ''}
                    onChange={set('drawing_index_lines')}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* ── COMPANY / FIRM ── */}
          <div className="border-b border-slate-200">
            <SectionHeader icon={Building2} title="Company / Firm Information" expanded={expanded.company} onToggle={() => toggle('company')} />
            {expanded.company && (
              <div className="px-6 py-4 space-y-4">
                <Field label="Company / Firm Name" required error={errors.company_name}>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Golden State Integrated Systems"
                    value={meta.company_name || ''}
                    onChange={set('company_name')}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Company Address">
                    <Input
                      className="h-8 text-sm"
                      placeholder="123 Main St, City, ST 00000"
                      value={meta.company_address || ''}
                      onChange={set('company_address')}
                    />
                  </Field>
                  <Field label="Company Phone">
                    <Input
                      className="h-8 text-sm"
                      placeholder="(555) 000-0000"
                      value={meta.company_phone || ''}
                      onChange={set('company_phone')}
                    />
                  </Field>
                  <Field label="Contractor License #">
                    <Input
                      className="h-8 text-sm"
                      placeholder="CSLB #123456 / C-10"
                      value={meta.company_license || ''}
                      onChange={set('company_license')}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Designer Name">
                    <Input
                      className="h-8 text-sm"
                      value={meta.designer_name || ''}
                      onChange={set('designer_name')}
                    />
                  </Field>
                  <Field label="NICET #">
                    <Input
                      className="h-8 text-sm"
                      placeholder="Level II #123456"
                      value={meta.designer_nicet || ''}
                      onChange={set('designer_nicet')}
                    />
                  </Field>
                  <Field label="Designer Phone">
                    <Input
                      className="h-8 text-sm"
                      value={meta.designer_phone || ''}
                      onChange={set('designer_phone')}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* ── GENERAL NOTES ── */}
          <div className="border-b border-slate-200">
            <SectionHeader icon={FileText} title="General Notes" expanded={expanded.notes} onToggle={() => toggle('notes')} />
            {expanded.notes && (
              <div className="px-6 py-4">
                <p className="text-xs text-slate-500 mb-2">Pre-populated with standard fire alarm notes. Edit as needed for this project.</p>
                <Textarea
                  className="text-xs min-h-[200px] resize-y font-mono leading-relaxed"
                  value={meta.general_notes || ''}
                  onChange={set('general_notes')}
                />
              </div>
            )}
          </div>

          {/* ── SEQUENCE OF OPERATION ── */}
          <div className="border-b border-slate-200">
            <SectionHeader icon={GitBranch} title="Sequence of Operation" expanded={expanded.sequence} onToggle={() => toggle('sequence')} />
            {expanded.sequence && (
              <div className="px-6 py-4">
                <p className="text-xs text-slate-500 mb-2">Describe the system operation narrative for the submittal package.</p>
                <Textarea
                  className="text-xs min-h-[200px] resize-y font-mono leading-relaxed"
                  value={meta.sequence_of_ops || ''}
                  onChange={set('sequence_of_ops')}
                />
              </div>
            )}
          </div>

          {/* ── BATTERY CALCULATION ── */}
          <div className="border-b border-slate-200">
            <SectionHeader icon={Battery} title={`Battery Calculation (auto-calculated — ${battCalc.required_Ah} Ah required)`} expanded={expanded.battery} onToggle={() => toggle('battery')} />
            {expanded.battery && (
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="System Voltage">
                    <select
                      className="w-full h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={meta.system_voltage || '24'}
                      onChange={e => setDirect('system_voltage', e.target.value)}
                    >
                      <option value="12">12V DC</option>
                      <option value="24">24V DC</option>
                      <option value="120">120V AC</option>
                    </select>
                  </Field>
                  <Field label="Standby Hours Required">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-sm"
                      value={meta.standby_hours || 24}
                      onChange={e => setDirect('standby_hours', Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Alarm Minutes Required">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-sm"
                      value={meta.alarm_minutes || 5}
                      onChange={e => setDirect('alarm_minutes', Number(e.target.value))}
                    />
                  </Field>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-600 mb-2">Device Current Draw (edit as needed)</div>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_60px_80px_80px] gap-0 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">
                      <span>Device Type</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Standby mA</span>
                      <span className="text-right">Alarm mA</span>
                    </div>
                    {(meta.batteryRows || []).map((row, i) => (
                      <div
                        key={row.id}
                        className={`grid grid-cols-[1fr_60px_80px_80px] gap-0 px-3 py-1.5 text-xs border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                      >
                        <span className="text-slate-700 self-center">{row.label}</span>
                        <input
                          type="number"
                          min={0}
                          className="w-14 h-7 text-right text-xs rounded border border-slate-200 px-1 bg-white ml-auto block"
                          value={row.qty}
                          onChange={e => setBattRow(i, 'qty', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          className="w-20 h-7 text-right text-xs rounded border border-slate-200 px-1 bg-white ml-auto block"
                          value={row.standbymA}
                          onChange={e => setBattRow(i, 'standbymA', Number(e.target.value))}
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          className="w-20 h-7 text-right text-xs rounded border border-slate-200 px-1 bg-white ml-auto block"
                          value={row.alarmmA}
                          onChange={e => setBattRow(i, 'alarmmA', Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation summary */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
                  <div className="font-semibold text-slate-700 mb-2">Calculated Results</div>
                  {[
                    ['Total standby current', `${battCalc.totalStandbymA} mA`],
                    ['Total alarm current', `${battCalc.totalAlarmmA} mA`],
                    [`Standby Ah (${meta.standby_hours || 24}h)`, `${battCalc.standby_Ah} Ah`],
                    [`Alarm Ah (${meta.alarm_minutes || 5}min)`, `${battCalc.alarm_Ah} Ah`],
                    ['Subtotal raw Ah', `${battCalc.raw_Ah} Ah`],
                    ['× 1.20 derating (NFPA 72)', `${battCalc.required_Ah} Ah`],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between">
                      <span className="text-slate-500">{lbl}</span>
                      <span className="font-medium text-slate-800">{val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold">
                    <span className="text-green-700">Recommended battery</span>
                    <span className="text-green-700">{battCalc.recommended}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── REVISIONS ── */}
          <div className="border-b border-slate-200">
            <SectionHeader icon={FileText} title="Revision History (title block)" expanded={expanded.revisions} onToggle={() => toggle('revisions')} />
            {expanded.revisions && (
              <div className="px-6 py-4">
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-[32px_90px_60px_1fr] gap-0 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">
                    <span>No.</span>
                    <span>Date</span>
                    <span>By</span>
                    <span>Description</span>
                  </div>
                  {(meta.revisions || Array(5).fill(null).map((_, i) => ({ no: String(i+1), date:'', by:'', text:'' }))).map((rev, i) => (
                    <div key={i} className={`grid grid-cols-[32px_90px_60px_1fr] gap-1 px-3 py-1.5 border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <input
                        className="w-7 h-7 text-center text-xs rounded border border-slate-200 px-1 bg-white font-mono"
                        value={rev.no || String(i+1)}
                        onChange={e => setRev(i, 'no', e.target.value)}
                      />
                      <input
                        className="w-full h-7 text-xs rounded border border-slate-200 px-1.5 bg-white"
                        placeholder="MM/DD/YYYY"
                        value={rev.date || ''}
                        onChange={e => setRev(i, 'date', e.target.value)}
                      />
                      <input
                        className="w-full h-7 text-xs rounded border border-slate-200 px-1.5 bg-white"
                        placeholder="Initials"
                        value={rev.by || ''}
                        onChange={e => setRev(i, 'by', e.target.value)}
                      />
                      <input
                        className="w-full h-7 text-xs rounded border border-slate-200 px-1.5 bg-white"
                        placeholder="Description of revision"
                        value={rev.text || ''}
                        onChange={e => setRev(i, 'text', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{totalDevices}</span> devices ·{' '}
            <span className="font-medium text-slate-700">{project?.num_floors || 1}</span> floor(s) ·{' '}
            Sheets: FA0.01 · FA5.01 · FA5.10
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-xs px-5"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Generate Construction Drawings</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildInitialMeta(project, devices, savedMeta) {
  const base = {
    prepared_by: '',
    checked_by: '',
    project_manager: '',
    project_number: '',
    submittal_date: new Date().toLocaleDateString(),
    scope_of_work: '',
    monitoring_notes: '',
    battery_callout: '',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_license: '',
    designer_name: '',
    designer_nicet: '',
    designer_phone: '',
    logo_url: '',
    logo_data_url: '',
    general_notes: DEFAULT_GENERAL_NOTES,
    sequence_of_ops: DEFAULT_SEQUENCE_OF_OPS,
    drawing_index_lines: DEFAULT_DRAWING_INDEX,
    system_voltage: '24',
    standby_hours: 24,
    alarm_minutes: 5,
    batteryRows: buildDefaultBatteryRows(devices),
    revisions: Array(5).fill(null).map((_, i) => ({ no: String(i+1), date:'', by:'', text:'' })),
  };

  if (!savedMeta || typeof savedMeta !== 'object') return base;

  // Merge saved meta, re-build battery rows from devices if not saved
  const merged = { ...base, ...savedMeta };

  // Normalize drawing_index_lines to string for textarea
  if (Array.isArray(merged.drawing_index_lines)) {
    merged.drawing_index_lines = merged.drawing_index_lines.join('\n');
  }

  // Ensure revisions is padded to 5
  if (!Array.isArray(merged.revisions) || merged.revisions.length === 0) {
    merged.revisions = base.revisions;
  } else {
    while (merged.revisions.length < 5) {
      merged.revisions.push({ no: String(merged.revisions.length + 1), date:'', by:'', text:'' });
    }
  }

  // Always rebuild battery rows from current devices (device list may have changed)
  if (!merged.batteryRows || merged.batteryRows.length === 0) {
    merged.batteryRows = buildDefaultBatteryRows(devices);
  }

  return merged;
}

function packMeta(m) {
  return {
    ...m,
    drawing_index_lines: typeof m.drawing_index_lines === 'string'
      ? m.drawing_index_lines.split(/\r?\n/).filter(Boolean)
      : m.drawing_index_lines,
    revisions: (m.revisions || []).filter(r => r && (r.date || r.by || r.text)),
    // Never persist large base64 to DB
    logo_data_url: (typeof m.logo_data_url === 'string' && m.logo_data_url.length > 2000) ? '' : (m.logo_data_url || ''),
  };
}

function useMemo_battery(meta) {
  const rows = meta.batteryRows || [];
  const standbyH = Number(meta.standby_hours) || 24;
  const alarmMin = Number(meta.alarm_minutes) || 5;

  const totalStandbymA = rows.reduce((s, r) => s + (Number(r.standbymA) || 0) * (Number(r.qty) || 0), 0);
  const totalAlarmmA   = rows.reduce((s, r) => s + (Number(r.alarmmA)   || 0) * (Number(r.qty) || 0), 0);

  const standby_Ah = parseFloat(((totalStandbymA / 1000) * standbyH).toFixed(3));
  const alarm_Ah   = parseFloat(((totalAlarmmA   / 1000) * (alarmMin / 60)).toFixed(3));
  const raw_Ah     = parseFloat((standby_Ah + alarm_Ah).toFixed(3));
  const required_Ah = parseFloat((raw_Ah * 1.20).toFixed(2));

  // Standard battery sizes
  const SIZES = [7, 12, 17, 26, 33, 40, 55, 75, 100];
  const recommended_Ah = SIZES.find(s => s >= required_Ah) || SIZES[SIZES.length - 1];
  const recommended = `${recommended_Ah} Ah × 1 battery (24VDC sealed lead-acid, NFPA 72 §10.6.7)`;

  return { totalStandbymA: Math.round(totalStandbymA), totalAlarmmA: Math.round(totalAlarmmA), standby_Ah, alarm_Ah, raw_Ah, required_Ah, recommended };
}