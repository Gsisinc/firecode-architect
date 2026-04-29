import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertTriangle, ClipboardList } from "lucide-react";

const DEVICE_TYPES = {
  smoke_detector: "Smoke Detector",
  heat_detector: "Heat Detector",
  pull_station: "Manual Pull Station",
  horn_strobe: "Horn/Strobe",
  strobe: "Strobe",
  speaker: "Speaker",
  facp: "FACP",
  co_detector: "CO Detector",
  waterflow_switch: "Waterflow Switch",
  valve_tamper: "Valve Tamper",
  duct_detector: "Duct Detector",
  elevator_recall: "Elevator Recall Detector",
};

function buildChecklist(project, devices, analysisResults, rooms) {
  const reqs = analysisResults || {};
  const hasDevice = (type) => devices.some((d) => d.type === type || d.subtype === type);
  const deviceCount = (type) => devices.filter((d) => d.type === type).length;
  const items = [];

  // ── DOCUMENTATION ────────────────────────────────────────────────────────
  items.push({
    section: "Documentation (NFPA 72 Ch. 7)",
    checks: [
      { label: "Project name defined", ok: !!project?.name, ref: "NFPA 72 §7.1" },
      { label: "Building address provided", ok: !!project?.address, ref: "NFPA 72 §7.2" },
      { label: "Occupancy group selected", ok: !!project?.occupancy_group, ref: "IBC §302" },
      { label: "Number of floors specified", ok: (project?.num_floors || 0) >= 1, ref: "IBC §502" },
      { label: "Sprinkler status declared", ok: !!project?.sprinkler_status, ref: "IBC §903" },
      { label: "Code edition adopted", ok: !!project?.adopted_code_edition, ref: "NFPA 72 §1.3" },
      { label: "AHJ contact provided", ok: !!project?.ahj_contact, ref: "NFPA 72 §7.3" },
      { label: "Communication pathway selected", ok: !!project?.communication_pathway, ref: "NFPA 72 §26.6" },
      { label: "Building owner identified", ok: !!project?.owner_name, ref: "NFPA 72 §7.2" },
      { label: "Installer/contractor identified", ok: !!project?.installer_name, ref: "NFPA 72 §7.2" },
    ],
  });

  // ── SYSTEM DESIGN ────────────────────────────────────────────────────────
  const designChecks = [
    { label: "FACP placed on floor plan", ok: hasDevice("facp"), ref: "NFPA 72 §10.4" },
    { label: "Rooms defined on floor plan", ok: (rooms?.length || 0) > 0, ref: "NFPA 72 §17.4" },
    { label: "At least 1 device placed", ok: devices.length > 0, ref: "NFPA 72 §17" },
    { label: "Code analysis has been run", ok: !!analysisResults, ref: "NFPA 72 §7" },
  ];

  if (reqs.fireAlarmRequired) {
    designChecks.push({
      label: "Manual pull stations placed",
      ok: hasDevice("pull_station"),
      ref: "NFPA 72 §17.14",
      warn: true,
    });
    designChecks.push({
      label: "Smoke detectors placed",
      ok: hasDevice("smoke_detector"),
      ref: "NFPA 72 §17.7",
      warn: true,
    });
    designChecks.push({
      label: "Notification appliances placed (horn/strobe or speaker)",
      ok: hasDevice("horn_strobe") || hasDevice("strobe") || hasDevice("speaker"),
      ref: "NFPA 72 §18.4",
      warn: true,
    });
  }

  if (reqs.voiceEvacRequired) {
    designChecks.push({
      label: "Speakers placed (voice evac required)",
      ok: hasDevice("speaker"),
      ref: "NFPA 72 §24",
      warn: true,
    });
  }

  if (reqs.coDetectionRequired) {
    designChecks.push({
      label: "CO detectors placed",
      ok: hasDevice("co_detector"),
      ref: "NFPA 72 §29",
      warn: true,
    });
  }

  if (reqs.elevatorRecallRequired) {
    designChecks.push({
      label: "Elevator recall detectors placed",
      ok: hasDevice("elevator_recall") || devices.some((d) => d.subtype === "elevator_recall"),
      ref: "NFPA 72 §21.3",
      warn: true,
    });
  }

  if (["Full (NFPA 13)", "Full (NFPA 13R)", "Partial"].includes(project?.sprinkler_status)) {
    designChecks.push({
      label: "Waterflow monitoring devices placed",
      ok: hasDevice("waterflow_switch"),
      ref: "NFPA 72 §17.16",
      warn: true,
    });
    designChecks.push({
      label: "Valve tamper switches placed",
      ok: hasDevice("valve_tamper"),
      ref: "NFPA 72 §17.16.2",
      warn: true,
    });
  }

  if (project?.occupancy_group === "High Rise") {
    designChecks.push({
      label: "Duct detectors for HVAC placed",
      ok: hasDevice("duct_detector"),
      ref: "NFPA 72 §17.12 / IBC §606",
      warn: true,
    });
  }

  items.push({ section: "System Design", checks: designChecks });

  // ── OCCUPANCY-SPECIFIC ───────────────────────────────────────────────────
  const occChecks = [];
  const og = project?.occupancy_group;

  if (["I-1", "I-2", "R-1", "R-2", "R-4"].includes(og)) {
    occChecks.push({
      label: "Sleeping unit notification devices addressed",
      ok: deviceCount("horn_strobe") > 0 || deviceCount("strobe") > 0,
      ref: "NFPA 72 §18.4.5 — sleeping rooms require 520 Hz low-freq",
      warn: true,
    });
  }

  if (["I-2"].includes(og)) {
    occChecks.push({
      label: "Healthcare: defend-in-place strategy considered",
      ok: !!reqs.voiceEvacRequired,
      ref: "NFPA 101 §18.3.4 — staged evacuation",
      warn: false,
    });
  }

  if (og === "High Rise") {
    occChecks.push({
      label: "High-rise: voice evac required",
      ok: !!reqs.voiceEvacRequired,
      ref: "IBC §907.2.13 / NFPA 72 §24",
      warn: true,
    });
    occChecks.push({
      label: "High-rise: fire command center required",
      ok: !!reqs.fireCommandCenterRequired,
      ref: "IBC §911",
      warn: true,
    });
    occChecks.push({
      label: "High-rise: firefighter communication required",
      ok: !!reqs.firefighterCommRequired,
      ref: "IBC §916",
      warn: true,
    });
  }

  if (["A"].includes(og) && (project?.total_occupant_load || 0) >= 300) {
    occChecks.push({
      label: "Assembly ≥300 occ: voice evac required",
      ok: !!reqs.voiceEvacRequired,
      ref: "IBC §907.2.1",
      warn: true,
    });
  }

  if (occChecks.length > 0) {
    items.push({ section: `Occupancy Group ${og} Requirements`, checks: occChecks });
  }

  // ── ELECTRICAL / POWER ───────────────────────────────────────────────────
  items.push({
    section: "Electrical & Power (NFPA 72 §10)",
    checks: [
      { label: "Ceiling height specified (for detector spacing)", ok: (project?.default_ceiling_height || 0) > 0, ref: "NFPA 72 §17.6.3" },
      { label: "Ceiling type specified (smooth/sloped/beamed)", ok: !!project?.default_ceiling_type, ref: "NFPA 72 §17.6" },
      { label: "Sufficient devices for battery sizing (>0)", ok: devices.length > 0, ref: "NFPA 72 §10.6" },
    ],
  });

  return items;
}

export default function ComplianceChecklist({ project, devices, analysisResults, rooms }) {
  const checklist = useMemo(
    () => buildChecklist(project, devices, analysisResults, rooms),
    [project, devices, analysisResults, rooms]
  );

  const allChecks = checklist.flatMap((s) => s.checks);
  const passCount = allChecks.filter((c) => c.ok).length;
  const failCount = allChecks.length - passCount;
  const warnFails = allChecks.filter((c) => !c.ok && c.warn).length;
  const pct = Math.round((passCount / allChecks.length) * 100);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Summary bar */}
      <div className="px-4 py-3 border-b bg-slate-50 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">Compliance Checklist</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 text-xs">{passCount} Pass</Badge>
            {warnFails > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{warnFails} Required</Badge>}
            {failCount - warnFails > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-xs">{failCount - warnFails} Advisory</Badge>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">{pct}% complete · {allChecks.length} total items</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {checklist.map((section) => (
            <div key={section.section}>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{section.section}</h3>
              <div className="space-y-1.5">
                {section.checks.map((check, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${
                      check.ok
                        ? "bg-emerald-50 border-emerald-100"
                        : check.warn
                        ? "bg-red-50 border-red-100"
                        : "bg-amber-50 border-amber-100"
                    }`}
                  >
                    {check.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : check.warn ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium leading-tight ${check.ok ? "text-emerald-800" : check.warn ? "text-red-800" : "text-amber-800"}`}>
                        {check.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 font-mono ${check.ok ? "text-emerald-600" : check.warn ? "text-red-500" : "text-amber-600"}`}>
                        {check.ref}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}