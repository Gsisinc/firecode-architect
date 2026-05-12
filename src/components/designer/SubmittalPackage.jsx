import { useState, useEffect } from "react";
import { X, Download, Loader2, FileText, Building2, FileImage } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runConstructionDrawingPdf } from "@/lib/constructionDrawingPdf";

const DEFAULT_FA0_META = {
  scope_of_work: "",
  prepared_by: "",
  checked_by: "",
  project_manager: "",
  project_number: "",
  submittal_date: "",
  drawing_index_lines:
    "FA0.01 — Legend & General Requirements\nFA5.01 — Fire Alarm 1st Floor Plan\nFA5.10 — Fire Alarm Diagrams Plan",
  company_name: "",
  company_address: "",
  company_phone: "",
  company_license: "",
  /** Hosted file URL from UploadFile — never store multi‑MB base64 in the DB. */
  logo_url: "",
  logo_data_url: "",
  designer_name: "",
  designer_nicet: "",
  designer_phone: "",
  battery_callout: "",
  monitoring_notes: "",
  revisions: [
    { no: "1", date: "", by: "", text: "" },
    { no: "2", date: "", by: "", text: "" },
    { no: "3", date: "", by: "", text: "" },
    { no: "4", date: "", by: "", text: "" },
    { no: "5", date: "", by: "", text: "" },
  ],
};

function packSubmittalMetaForSave(raw) {
  const m = { ...raw };
  if (typeof m.logo_data_url === "string" && m.logo_data_url.length > 2000) {
    delete m.logo_data_url;
  }
  if (typeof m.drawing_index_lines === "string") {
    m.drawing_index_lines = m.drawing_index_lines.split(/\r?\n/).filter(Boolean);
  }
  if (Array.isArray(m.revisions)) {
    m.revisions = m.revisions.filter((r) => r && (r.date || r.by || r.text));
  }
  return m;
}

/** Module-scope wrapper — defining inside SubmittalPackage would recreate the component type every render and remount inputs (lost focus while typing). */
function SubmittalField({ label, required, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-slate-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [submittalMeta, setSubmittalMeta] = useState(() => ({ ...DEFAULT_FA0_META }));

  // Sync from server only when the *project record* changes. Do NOT depend on
  // `project.submittal_meta` by reference: React Query refetches after autosave
  // return a new object identity for the same data, which was resetting this
  // form on every refetch and made inputs unfocus / "kick" the user out.
  useEffect(() => {
    const m = project?.submittal_meta;
    if (!m || typeof m !== "object") {
      setSubmittalMeta({ ...DEFAULT_FA0_META });
      return;
    }
    const hugeLogo =
      typeof m.logo_data_url === "string" && m.logo_data_url.length > 2000;
    setSubmittalMeta({
      ...DEFAULT_FA0_META,
      ...m,
      logo_data_url: hugeLogo ? "" : (m.logo_data_url || ""),
      logo_url: m.logo_url || "",
      drawing_index_lines: Array.isArray(m.drawing_index_lines)
        ? m.drawing_index_lines.join("\n")
        : m.drawing_index_lines ?? DEFAULT_FA0_META.drawing_index_lines,
      revisions:
        Array.isArray(m.revisions) && m.revisions.length
          ? DEFAULT_FA0_META.revisions.map((def, i) => ({ ...def, ...(m.revisions[i] || {}) }))
          : DEFAULT_FA0_META.revisions,
    });
  }, [project?.id]);

  const set = (field) => (e) => setSubmittalMeta((m) => ({ ...m, [field]: e.target.value }));
  const setRev = (i, field, value) => setSubmittalMeta((s) => {
    const revs = [...(s.revisions || DEFAULT_FA0_META.revisions)];
    revs[i] = { ...revs[i], [field]: value };
    return { ...s, revisions: revs };
  });

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (PNG, JPG, WebP, …).");
      return;
    }
    setLogoUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSubmittalMeta((prev) => {
        const next = { ...prev, logo_url: file_url || "", logo_data_url: "" };
        onSaveSubmittalMeta?.(packSubmittalMetaForSave(next));
        return next;
      });
      toast.success("Logo saved to project (hosted URL).");
    } catch (err) {
      toast.error(err?.message || "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  };

  const generate = async () => {
    const packed = packSubmittalMetaForSave(submittalMeta);
    setGenerating(true);
    onSaveSubmittalMeta?.(packed);
    try {
      await runConstructionDrawingPdf({
        project, devices, rooms, wires, floorPlans, analysisResults,
        canvasRef, captureRef, activeFloor, submittalMeta: packed,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card
        className="w-full max-w-2xl flex flex-col max-h-[95vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between shrink-0 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Construction Drawing Submittal</CardTitle>
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              3 sheets · 36″×24″ · Vector PDF
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
          <Tabs defaultValue="company" className="flex flex-1 flex-col min-h-0">
            <TabsList className="mx-4 mt-3 shrink-0">
              <TabsTrigger value="company" className="text-xs gap-1">
                <Building2 className="w-3 h-3" />Company &amp; Logo
              </TabsTrigger>
              <TabsTrigger value="project" className="text-xs gap-1">
                <FileText className="w-3 h-3" />Project Info
              </TabsTrigger>
              <TabsTrigger value="revisions" className="text-xs gap-1">
                <FileImage className="w-3 h-3" />Revisions &amp; Index
              </TabsTrigger>
            </TabsList>

              {/* ── COMPANY TAB ── */}
              <TabsContent value="company" className="mx-4 mt-3 mb-4 flex-1 min-h-0 overflow-y-auto space-y-3 outline-none">
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
                  This information fills the <strong>right title block column</strong> on every sheet — matching the reference drawings with company logo, address, and engineer stamp box.
                </div>
                <SubmittalField label="Company / Firm Name">
                  <Input className="text-xs h-8" placeholder="e.g. Golden State Integrated Systems"
                    value={submittalMeta.company_name} onChange={set("company_name")} />
                </SubmittalField>
                <div className="grid grid-cols-2 gap-2">
                  <SubmittalField label="Company Address">
                    <Input className="text-xs h-8" placeholder="123 Main St, City, ST 00000"
                      value={submittalMeta.company_address} onChange={set("company_address")} />
                  </SubmittalField>
                  <SubmittalField label="Company Phone">
                    <Input className="text-xs h-8" placeholder="(555) 000-0000"
                      value={submittalMeta.company_phone} onChange={set("company_phone")} />
                  </SubmittalField>
                </div>
                <SubmittalField label="Contractor License #">
                  <Input className="text-xs h-8" placeholder="e.g. CSLB #123456 / C-10"
                    value={submittalMeta.company_license} onChange={set("company_license")} />
                </SubmittalField>
                <SubmittalField label="Company Logo (upload — stored as URL, not base64 in the database)">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={logoUploading}
                    className="text-xs h-8 file:mr-2 file:text-xs"
                    onChange={handleLogoFile}
                  />
                  {logoUploading && (
                    <p className="text-[10px] text-slate-500 mt-1">Uploading…</p>
                  )}
                  {(submittalMeta.logo_url || submittalMeta.logo_data_url) && (
                    <div className="flex items-center gap-2 mt-1">
                      <img
                        src={submittalMeta.logo_url || submittalMeta.logo_data_url}
                        alt="Logo preview"
                        className="h-10 max-w-[160px] object-contain border rounded bg-white p-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7 text-red-500"
                        onClick={() => {
                          setSubmittalMeta((prev) => {
                            const next = { ...prev, logo_url: "", logo_data_url: "" };
                            onSaveSubmittalMeta?.(packSubmittalMetaForSave(next));
                            return next;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </SubmittalField>
                <div className="grid grid-cols-3 gap-2">
                  <SubmittalField label="Designer Name">
                    <Input className="text-xs h-8" value={submittalMeta.designer_name} onChange={set("designer_name")} />
                  </SubmittalField>
                  <SubmittalField label="NICET #">
                    <Input className="text-xs h-8" value={submittalMeta.designer_nicet} onChange={set("designer_nicet")} />
                  </SubmittalField>
                  <SubmittalField label="Designer Phone">
                    <Input className="text-xs h-8" value={submittalMeta.designer_phone} onChange={set("designer_phone")} />
                  </SubmittalField>
                </div>
              </TabsContent>

              {/* ── PROJECT TAB ── */}
              <TabsContent value="project" className="mx-4 mt-3 mb-4 flex-1 min-h-0 overflow-y-auto space-y-3 outline-none">
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
                  <strong>Battery calcs, NAC loading, and riser diagram</strong> are auto-generated from your placed devices. The floor plan sheet embeds the full-resolution drawing — not a screenshot.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SubmittalField label="Prepared By" required>
                    <Input className="text-xs h-8" placeholder="e.g. M.A. Johnson"
                      value={submittalMeta.prepared_by} onChange={set("prepared_by")} />
                  </SubmittalField>
                  <SubmittalField label="Checked By">
                    <Input className="text-xs h-8" value={submittalMeta.checked_by} onChange={set("checked_by")} />
                  </SubmittalField>
                  <SubmittalField label="Project Manager">
                    <Input className="text-xs h-8" value={submittalMeta.project_manager} onChange={set("project_manager")} />
                  </SubmittalField>
                  <SubmittalField label="Project Number">
                    <Input className="text-xs h-8" value={submittalMeta.project_number} onChange={set("project_number")} />
                  </SubmittalField>
                  <SubmittalField label="Submittal Date">
                    <Input className="text-xs h-8" placeholder="Defaults to today"
                      value={submittalMeta.submittal_date} onChange={set("submittal_date")} />
                  </SubmittalField>
                  <SubmittalField label="Battery Override (optional)">
                    <Input className="text-xs h-8" placeholder="Auto-calculated if blank"
                      value={submittalMeta.battery_callout} onChange={set("battery_callout")} />
                  </SubmittalField>
                </div>
                <SubmittalField label="Scope of Work">
                  <Textarea className="text-xs min-h-[60px]"
                    placeholder="e.g. Tenant improvement — new addressable devices, duct smoke per mechanical…"
                    value={submittalMeta.scope_of_work} onChange={set("scope_of_work")} />
                </SubmittalField>
                <SubmittalField label="Monitoring Notes (optional override)">
                  <Textarea className="text-xs min-h-[40px]"
                    value={submittalMeta.monitoring_notes} onChange={set("monitoring_notes")} />
                </SubmittalField>
              </TabsContent>

              {/* ── REVISIONS & INDEX TAB ── */}
              <TabsContent value="revisions" className="mx-4 mt-3 mb-4 flex-1 min-h-0 overflow-y-auto space-y-3 outline-none">
                <SubmittalField label="Drawing Index (one line per sheet — appears on FA0.01)">
                  <Textarea className="text-xs min-h-[72px] font-mono"
                    value={submittalMeta.drawing_index_lines} onChange={set("drawing_index_lines")} />
                </SubmittalField>
                <div>
                  <Label className="text-[10px] text-slate-600">Revisions (up to 5 — appear in title block)</Label>
                  <div className="mt-1 space-y-1">
                    {[0,1,2,3,4].map((i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <Input className="text-[10px] h-7 w-8 px-1 text-center font-mono" placeholder={String(i+1)}
                          value={submittalMeta.revisions?.[i]?.no ?? ""}
                          onChange={(e) => setRev(i, "no", e.target.value)} />
                        <Input className="text-[10px] h-7 w-20 px-1" placeholder="Date"
                          value={submittalMeta.revisions?.[i]?.date ?? ""}
                          onChange={(e) => setRev(i, "date", e.target.value)} />
                        <Input className="text-[10px] h-7 w-14 px-1" placeholder="By"
                          value={submittalMeta.revisions?.[i]?.by ?? ""}
                          onChange={(e) => setRev(i, "by", e.target.value)} />
                        <Input className="text-[10px] h-7 flex-1 px-1" placeholder="Description"
                          value={submittalMeta.revisions?.[i]?.text ?? ""}
                          onChange={(e) => setRev(i, "text", e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
          </Tabs>
        </CardContent>

        <div className="px-4 py-3 border-t flex items-center justify-between shrink-0 bg-slate-50">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{devices.length}</span> devices ·{" "}
            <span className="font-medium text-slate-700">{project?.num_floors || 1}</span> floors
            <span className="ml-2 text-slate-400">→ FA0.01 · FA5.0{activeFloor} · FA5.10</span>
          </div>
          <Button onClick={generate} disabled={generating}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-xs">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Generate Construction Drawings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}