import { useState, useEffect } from "react";
import { X, Download, Loader2, FileText, Camera, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { runSubmittalPackagePdf } from "@/lib/submittalPackagePdf";

const DEFAULT_FA0_META = {
  scope_of_work: "",
  contractor_license: "",
  prepared_by: "",
  checked_by: "",
  project_manager: "",
  project_number: "",
  submittal_date: "",
  cover_title_lines:
    "COVER SHEET\nLEGEND, BATTERY CALC & OPS MATRIX",
  drawing_index_lines:
    "FA-0 — Legend, battery calculations & communication matrix\nFA-1 — Floor plan, general notes, riser & zone schedule\nFA-2 — Details / as-builts (as applicable)",
  site_map_image_data_url: "",
  central_station_ccn: "",
  central_station_file_no: "",
  central_station_vol_no: "",
  codes_adopted: "",
  building_occupancy_type: "",
  building_occupancy_load: "",
  building_total_area_sf: "",
  building_sprinklered: "",
  building_stories: "",
  building_construction_type: "",
  designer_name: "",
  designer_nicet: "",
  designer_phone: "",
  battery_callout: "",
  monitoring_notes: "",
  revisions: [
    { date: "", by: "", text: "" },
    { date: "", by: "", text: "" },
    { date: "", by: "", text: "" },
  ],
};

function packSubmittalMetaForSave(raw) {
  const m = { ...raw };
  if (typeof m.cover_title_lines === "string") {
    m.cover_title_lines = m.cover_title_lines.split(/\r?\n/).filter(Boolean);
  }
  if (typeof m.drawing_index_lines === "string") {
    m.drawing_index_lines = m.drawing_index_lines.split(/\r?\n/).filter(Boolean);
  }
  if (Array.isArray(m.revisions)) {
    m.revisions = m.revisions.filter((r) => r && (r.date || r.by || r.text));
  }
  return m;
}

export default function SubmittalPackage({
  project,
  devices,
  rooms,
  wires = [],
  floorPlans = [],
  analysisResults,
  canvasRef,
  captureRef,
  activeFloor = 1,
  onClose,
  onSaveSubmittalMeta,
}) {
  const [generating, setGenerating] = useState(false);
  const [ahjCover, setAhjCover] = useState(true);
  const [submittalMeta, setSubmittalMeta] = useState(() => ({ ...DEFAULT_FA0_META }));
  useEffect(() => {
    const m = project?.submittal_meta;
    if (!m || typeof m !== "object") {
      setSubmittalMeta({ ...DEFAULT_FA0_META });
      return;
    }
    setSubmittalMeta({
      ...DEFAULT_FA0_META,
      ...m,
      cover_title_lines: Array.isArray(m.cover_title_lines)
        ? m.cover_title_lines.join("\n")
        : m.cover_title_lines ?? DEFAULT_FA0_META.cover_title_lines,
      drawing_index_lines: Array.isArray(m.drawing_index_lines)
        ? m.drawing_index_lines.join("\n")
        : m.drawing_index_lines ?? DEFAULT_FA0_META.drawing_index_lines,
      revisions:
        Array.isArray(m.revisions) && m.revisions.length
          ? [
              { ...DEFAULT_FA0_META.revisions[0], ...m.revisions[0] },
              { ...DEFAULT_FA0_META.revisions[1], ...m.revisions[1] },
              { ...DEFAULT_FA0_META.revisions[2], ...m.revisions[2] },
            ]
          : DEFAULT_FA0_META.revisions,
    });
  }, [project?.id, project?.submittal_meta]);
  const [sections, setSections] = useState({
    cover: true,
    narrative: true,
    codeAnalysis: true,
    bom: true,
    deviceSchedule: true,
    battery: true,
    nacLoading: true,
    wiring: true,
    sequence: true,
    floorPlanSnapshot: true,
  });

  const toggleSection = (key) => setSections(s => ({ ...s, [key]: !s[key] }));

  const generate = async () => {
    if (ahjCover) {
      const missing = [];
      if (!(project?.address || "").trim()) missing.push("Project address (project settings)");
      if (!(submittalMeta.prepared_by || "").trim()) missing.push("Prepared by");
      if (!(submittalMeta.scope_of_work || "").trim()) missing.push("Scope of work");
      if (missing.length) {
        window.alert(`Sheet FA-0 needs the following before generating:\n\n• ${missing.join("\n• ")}`);
        return;
      }
      if (!(submittalMeta.site_map_image_data_url || "").trim()) {
        const ok = window.confirm(
          "No site map image was uploaded. FA-0 will show a text placeholder in the site location box. Continue?"
        );
        if (!ok) return;
      }
    }
    const packed = packSubmittalMetaForSave(submittalMeta);
    setGenerating(true);
    onSaveSubmittalMeta?.(packed);
    try {
      await runSubmittalPackagePdf({
        project,
        devices,
        rooms,
        wires,
        floorPlans,
        analysisResults,
        canvasRef,
        captureRef,
        sections,
        ahjCover,
        submittalMeta: packed,
        activeFloor,
      });
    } finally {
      setGenerating(false);
    }
  };

  const setRev = (i, field, value) => {
    setSubmittalMeta((s) => {
      const revs = [...(s.revisions || DEFAULT_FA0_META.revisions)];
      revs[i] = { ...revs[i], [field]: value };
      return { ...s, revisions: revs };
    });
  };

  const SECTION_OPTIONS = [
    { key: "cover", label: "Cover Page (A4 only if AHJ sheet off)" },
    { key: "narrative", label: "Written System Narrative" },
    { key: "codeAnalysis", label: "Code Analysis" },
    { key: "bom", label: "Bill of Materials" },
    { key: "deviceSchedule", label: "Device Schedule" },
    { key: "battery", label: "Battery Sizing Calculation" },
    { key: "nacLoading", label: "NAC Circuit Loading" },
    { key: "wiring", label: "Wiring Specifications" },
    { key: "sequence", label: "Sequence of Operations" },
    {
      key: "floorPlanSnapshot",
      label: `Floor plan drawing (Floor ${activeFloor}) — full sheet, not zoom`,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md flex flex-col">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between shrink-0 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Professional Submittal Package</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-4 max-h-[min(90vh,720px)] overflow-y-auto">
          <div className="rounded-lg border border-orange-200 bg-orange-50/80 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Layout className="h-4 w-4 text-orange-600 shrink-0" />
              <Label className="text-xs font-semibold text-slate-800">AHJ cover (Sheet FA-0, 36×24)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ahj" checked={ahjCover} onCheckedChange={(c) => setAhjCover(!!c)} />
              <Label htmlFor="ahj" className="text-xs cursor-pointer leading-snug">
                Sheet FA-0 (36″×24″): project/site block, scope, legend, sequence matrix, schematic system riser, battery &amp; NAC, Code-3 note. With “Floor plan” checked, Sheet FA-1 embeds the <strong>full plan + devices for the floor you have selected</strong> in the designer (not a zoomed viewport screenshot). Switch floors and run again for another floor&apos;s sheet.
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">
                Prepared by <span className="text-red-600">*</span>
              </Label>
              <Input
                className="text-xs h-8"
                placeholder="e.g. M.A. Johnson"
                value={submittalMeta.prepared_by}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, prepared_by: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Checked by</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.checked_by}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, checked_by: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Project manager</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.project_manager}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, project_manager: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Project # (title block)</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.project_number}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, project_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Submittal date (optional)</Label>
                <Input
                  className="text-xs h-8"
                  placeholder="Defaults to today"
                  value={submittalMeta.submittal_date}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, submittal_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Cover title lines (title block)</Label>
              <Textarea
                className="text-xs min-h-[52px] font-mono"
                value={submittalMeta.cover_title_lines}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, cover_title_lines: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Site map image (embedded in FA-0)</Label>
              <Input
                type="file"
                accept="image/*"
                className="text-xs h-8 file:mr-2 file:text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    setSubmittalMeta((m) => ({
                      ...m,
                      site_map_image_data_url: typeof reader.result === "string" ? reader.result : "",
                    }));
                  reader.readAsDataURL(f);
                }}
              />
              {submittalMeta.site_map_image_data_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-7 px-2"
                  onClick={() => setSubmittalMeta((m) => ({ ...m, site_map_image_data_url: "" }))}
                >
                  Remove map image
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-600">CCN</Label>
                <Input
                  className="text-xs h-7 px-1.5"
                  value={submittalMeta.central_station_ccn}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, central_station_ccn: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-600">File No.</Label>
                <Input
                  className="text-xs h-7 px-1.5"
                  value={submittalMeta.central_station_file_no}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, central_station_file_no: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-600">Vol.</Label>
                <Input
                  className="text-xs h-7 px-1.5"
                  value={submittalMeta.central_station_vol_no}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, central_station_vol_no: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Codes adopted (AHJ sidebar)</Label>
              <Textarea
                className="text-xs min-h-[48px]"
                placeholder="One line or paragraph; wraps in PDF"
                value={submittalMeta.codes_adopted}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, codes_adopted: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Occupancy type</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.building_occupancy_type}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, building_occupancy_type: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Occupant load</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.building_occupancy_load}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, building_occupancy_load: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Total area (SF)</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.building_total_area_sf}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, building_total_area_sf: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Construction type</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.building_construction_type}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, building_construction_type: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-3 sm:col-span-1">
                <Label className="text-[10px] text-slate-600">Designer name</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.designer_name}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, designer_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">NICET #</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.designer_nicet}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, designer_nicet: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">Phone</Label>
                <Input
                  className="text-xs h-8"
                  value={submittalMeta.designer_phone}
                  onChange={(e) => setSubmittalMeta((m) => ({ ...m, designer_phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Revisions (up to 3)</Label>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-wrap gap-1 items-center">
                  <Input
                    className="text-[10px] h-7 w-[72px] px-1"
                    placeholder="Date"
                    value={submittalMeta.revisions?.[i]?.date ?? ""}
                    onChange={(e) => setRev(i, "date", e.target.value)}
                  />
                  <Input
                    className="text-[10px] h-7 w-[52px] px-1"
                    placeholder="By"
                    value={submittalMeta.revisions?.[i]?.by ?? ""}
                    onChange={(e) => setRev(i, "by", e.target.value)}
                  />
                  <Input
                    className="text-[10px] h-7 flex-1 min-w-[120px] px-1"
                    placeholder="Description"
                    value={submittalMeta.revisions?.[i]?.text ?? ""}
                    onChange={(e) => setRev(i, "text", e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Drawing index lines</Label>
              <Textarea
                className="text-xs min-h-[48px] font-mono"
                value={submittalMeta.drawing_index_lines}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, drawing_index_lines: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Battery callout override (optional)</Label>
              <Input
                className="text-xs h-8"
                placeholder="e.g. (2) 12V 7AH batteries @ 24VDC"
                value={submittalMeta.battery_callout}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, battery_callout: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">
                Scope of work <span className="text-red-600">*</span> (FA-0)
              </Label>
              <Textarea
                className="text-xs min-h-[56px]"
                placeholder="e.g. Tenant improvement — new addressable devices, duct smoke per mechanical…"
                value={submittalMeta.scope_of_work}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, scope_of_work: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Monitoring notes override (optional)</Label>
              <Textarea
                className="text-xs min-h-[40px]"
                value={submittalMeta.monitoring_notes}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, monitoring_notes: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Contractor license # (C-10 / as applicable)</Label>
              <Input
                className="text-xs h-8"
                placeholder="e.g. CSLB #123456"
                value={submittalMeta.contractor_license}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, contractor_license: e.target.value }))}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              For sharpest brand mark on PDFs, add <span className="font-mono">public/branding/gsis-logo.png</span> (any aspect ratio; portrait lockup recommended). Otherwise the app rasterizes the bundled SVG.
            </p>
            <p className="text-[10px] text-slate-500">
              Upload manufacturer PDFs in Documents; map models to <span className="font-mono">project.equipment_specs</span> in a future release — legend uses placeholders until then.
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-3">Select sections to include in the PDF:</p>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2.5">
                  <Checkbox
                    id={key}
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                  />
                  <Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label>
                  {key === "floorPlanSnapshot" && (
                    <Badge variant="outline" className="text-[9px] ml-auto text-purple-600 border-purple-200">
                      <Camera className="w-2.5 h-2.5 mr-1" />2–4× raster
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {devices.length} devices · {project?.num_floors || 1} floors
            </div>
            <Button
              onClick={generate}
              disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-xs"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {generating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}