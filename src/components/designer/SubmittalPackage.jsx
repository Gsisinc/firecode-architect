import { useState, useEffect, useRef } from "react";
import { X, Download, Loader2, FileText, Building2, FileImage, Plus, Trash2, GripHorizontal, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runConstructionDrawingPdf } from "@/lib/constructionDrawingPdf";
import {
  SHEET_W_MM,
  SHEET_H_MM,
  MODULE_TYPES,
  MODULE_LABELS,
  TITLE_BLOCK_RECT,
  defaultComposition,
  addPageAfter,
  deletePage,
  addModule,
  updateModule,
  deleteModule,
} from "@/lib/sheetComposer";
import {
  SUBMITTAL_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  validateRequiredFields,
  FIELD_LABELS,
} from "@/lib/submittalTemplates";

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
  cut_sheets: [],
  revisions: [
    { no: "1", date: "", by: "", text: "" },
    { no: "2", date: "", by: "", text: "" },
    { no: "3", date: "", by: "", text: "" },
    { no: "4", date: "", by: "", text: "" },
    { no: "5", date: "", by: "", text: "" },
  ],
};

const MODULE_PALETTE = [
  MODULE_TYPES.FLOOR_PLAN,
  MODULE_TYPES.RISER,
  MODULE_TYPES.IO_MATRIX,
  MODULE_TYPES.BATTERY_CALC,
  MODULE_TYPES.VOLTAGE_DROP,
  MODULE_TYPES.DEVICE_SCHEDULE,
  MODULE_TYPES.ZONE_SCHEDULE,
  MODULE_TYPES.COMPLIANCE_AUDIT,
  MODULE_TYPES.LEGEND,
  MODULE_TYPES.GENERAL_NOTES,
  MODULE_TYPES.TEXT,
  MODULE_TYPES.IMAGE,
  MODULE_TYPES.TITLE_BLOCK,
];

const TYPE_COLORS = {
  [MODULE_TYPES.TITLE_BLOCK]: "border-slate-700 bg-slate-50",
  [MODULE_TYPES.FLOOR_PLAN]: "border-red-500 bg-red-50",
  [MODULE_TYPES.RISER]: "border-blue-500 bg-blue-50",
  [MODULE_TYPES.BATTERY_CALC]: "border-emerald-500 bg-emerald-50",
  [MODULE_TYPES.VOLTAGE_DROP]: "border-amber-500 bg-amber-50",
  [MODULE_TYPES.DEVICE_SCHEDULE]: "border-purple-500 bg-purple-50",
  [MODULE_TYPES.COMPLIANCE_AUDIT]: "border-sky-500 bg-sky-50",
};

function defaultModuleRect(type) {
  if (type === MODULE_TYPES.TITLE_BLOCK) return TITLE_BLOCK_RECT;
  if (type === MODULE_TYPES.TEXT) return { x: 24, y: 24, w: 220, h: 70 };
  if (type === MODULE_TYPES.IMAGE) return { x: 24, y: 24, w: 180, h: 120 };
  return { x: 24, y: 24, w: 260, h: 150 };
}

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
  markups = [],
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
  const [cutSheetUploading, setCutSheetUploading] = useState(false);
  const [templateId, setTemplateId] = useState(
    project?.submittal_meta?.template_id || DEFAULT_TEMPLATE_ID
  );
  const [submittalMeta, setSubmittalMeta] = useState(() => ({ ...DEFAULT_FA0_META }));
  const [composition, setComposition] = useState(() => defaultComposition({ floors: project?.num_floors || 1, activeFloor }));
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [dragState, setDragState] = useState(null);

  // Sync from server only when the *project record* changes. Do NOT depend on
  // `project.submittal_meta` by reference: React Query refetches after autosave
  // return a new object identity for the same data, which was resetting this
  // form on every refetch and made inputs unfocus / "kick" the user out.
  useEffect(() => {
    const m = project?.submittal_meta;
    if (!m || typeof m !== "object") {
      const nextComposition = defaultComposition({ floors: project?.num_floors || 1, activeFloor });
      setSubmittalMeta({ ...DEFAULT_FA0_META });
      setComposition(nextComposition);
      setSelectedPageId(nextComposition.pages?.[0]?.id || null);
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
    const nextComposition = m.sheet_composition?.pages?.length
      ? m.sheet_composition
      : defaultComposition({ floors: project?.num_floors || 1, activeFloor });
    setComposition(nextComposition);
    setSelectedPageId((current) => current || nextComposition.pages?.[0]?.id || null);
  }, [project?.id]);

  useEffect(() => {
    setSelectedPageId((current) => current || composition.pages?.[0]?.id || null);
  }, [composition.pages]);

  const set = (field) => (e) => setSubmittalMeta((m) => ({ ...m, [field]: e.target.value }));
  const setRev = (i, field, value) => setSubmittalMeta((s) => {
    const revs = [...(s.revisions || DEFAULT_FA0_META.revisions)];
    revs[i] = { ...revs[i], [field]: value };
    return { ...s, revisions: revs };
  });

  const persistComposition = (nextComposition) => {
    setComposition(nextComposition);
    const packed = packSubmittalMetaForSave({
      ...submittalMeta,
      template_id: templateId,
      sheet_composition: nextComposition,
    });
    onSaveSubmittalMeta?.(packed);
  };

  const selectedPage = composition.pages?.find((p) => p.id === selectedPageId) || composition.pages?.[0] || null;
  const selectedModule = selectedPage?.modules?.find((m) => m.id === selectedModuleId) || null;

  const updateSelectedPage = (patch) => {
    if (!selectedPage) return;
    const next = {
      ...composition,
      pages: composition.pages.map((page) => page.id === selectedPage.id ? { ...page, ...patch } : page),
    };
    persistComposition(next);
  };

  const updateSelectedModule = (patch) => {
    if (!selectedPage || !selectedModule) return;
    persistComposition(updateModule(composition, selectedPage.id, selectedModule.id, patch));
  };

  const addEditorPage = () => {
    const idx = Math.max(0, composition.pages.findIndex((page) => page.id === selectedPage?.id));
    const next = addPageAfter(composition, idx);
    setSelectedPageId(next.pages[idx + 1]?.id || next.pages[0]?.id);
    setSelectedModuleId(null);
    persistComposition(next);
  };

  const deleteEditorPage = () => {
    if (!selectedPage || composition.pages.length <= 1) return;
    const next = deletePage(composition, selectedPage.id);
    setSelectedPageId(next.pages[0]?.id || null);
    setSelectedModuleId(null);
    persistComposition(next);
  };

  const addEditorModule = (type, rect = defaultModuleRect(type), props = {}) => {
    if (!selectedPage) return;
    const next = addModule(composition, selectedPage.id, type, rect, props);
    const page = next.pages.find((p) => p.id === selectedPage.id);
    const mod = page?.modules?.[page.modules.length - 1];
    setSelectedModuleId(mod?.id || null);
    persistComposition(next);
  };

  const deleteSelectedModule = () => {
    if (!selectedPage || !selectedModule) return;
    setSelectedModuleId(null);
    persistComposition(deleteModule(composition, selectedPage.id, selectedModule.id));
  };

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

  const handleCutSheetFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setCutSheetUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const ok = file.type === "application/pdf" || file.type.startsWith("image/");
        if (!ok) { toast.error(`Skipped ${file.name} — use PDF or image.`); continue; }
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (file_url) uploaded.push({ name: file.name.replace(/\.[^.]+$/, ""), url: file_url, file_type: file.type });
      }
      if (uploaded.length) {
        setSubmittalMeta((prev) => {
          const next = { ...prev, cut_sheets: [...(prev.cut_sheets || []), ...uploaded] };
          onSaveSubmittalMeta?.(packSubmittalMetaForSave(next));
          return next;
        });
        toast.success(`Added ${uploaded.length} cut sheet(s).`);
      }
    } catch (err) {
      toast.error(err?.message || "Cut sheet upload failed.");
    } finally {
      setCutSheetUploading(false);
    }
  };

  const removeCutSheet = (idx) => {
    setSubmittalMeta((prev) => {
      const next = { ...prev, cut_sheets: (prev.cut_sheets || []).filter((_, i) => i !== idx) };
      onSaveSubmittalMeta?.(packSubmittalMetaForSave(next));
      return next;
    });
  };

  const generate = async () => {
    const template = getTemplate(templateId);
    const { ok, missing } = validateRequiredFields(template, project, submittalMeta);
    if (!ok) {
      toast.warning(
        `Required title-block fields missing: ${missing
          .map((f) => FIELD_LABELS[f] || f)
          .join(", ")}. They'll be stamped as red «REQUIRED» placeholders until filled.`
      );
    }
    const packed = packSubmittalMetaForSave({ ...submittalMeta, template_id: templateId });
    setGenerating(true);
    onSaveSubmittalMeta?.(packed);
    try {
      await runConstructionDrawingPdf({
        project, devices, rooms, wires, markups, floorPlans, analysisResults,
        canvasRef, captureRef, activeFloor, submittalMeta: packed, template,
        sheetComposition: composition,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card
        className="w-full max-w-7xl flex flex-col max-h-[95vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between shrink-0 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Construction Drawing Submittal</CardTitle>
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              7-sheet submittal · 36″×24″ · Vector PDF
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* ── Drawing-standard template selector ── */}
          <div className="mx-4 mt-3 shrink-0">
            <Label className="text-[10px] text-slate-600">Drawing standard / template</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {Object.values(SUBMITTAL_TEMPLATES).map((t) => {
                const active = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`text-left rounded-lg border px-3 py-2 transition ${
                      active
                        ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-800">{t.shortLabel}</div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <Tabs defaultValue="editor" className="flex flex-1 flex-col min-h-0">
            <TabsList className="mx-4 mt-3 shrink-0">
              <TabsTrigger value="editor" className="text-xs gap-1">
                <LayoutTemplate className="w-3 h-3" />Visual Editor
              </TabsTrigger>
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

              {/* ── VISUAL SHEET EDITOR ── */}
              <TabsContent value="editor" className="m-0 mt-3 flex-1 min-h-0 overflow-hidden outline-none">
                <div className="grid h-full grid-cols-[220px_minmax(0,1fr)_260px] gap-0 border-t border-slate-200">
                  <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Sheets</p>
                        <p className="text-[10px] text-slate-500">{composition.pages?.length || 0} page layout</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={addEditorPage}>
                        <Plus className="h-3 w-3 mr-1" /> Page
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      {(composition.pages || []).map((page, idx) => (
                        <button
                          type="button"
                          key={page.id}
                          onClick={() => { setSelectedPageId(page.id); setSelectedModuleId(null); }}
                          className={`w-full rounded-lg border px-2 py-2 text-left transition ${
                            selectedPage?.id === page.id ? 'border-orange-400 bg-white shadow-sm' : 'border-slate-200 bg-white/70 hover:bg-white'
                          }`}
                        >
                          <p className="truncate text-xs font-semibold text-slate-800">{page.sheetNo || `Sheet ${idx + 1}`}</p>
                          <p className="truncate text-[10px] text-slate-500">{page.title || 'Untitled sheet'}</p>
                          <p className="text-[10px] text-slate-400">{page.modules?.length || 0} module(s)</p>
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold text-slate-800 mb-2">Drag Modules</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {MODULE_PALETTE.map((type) => (
                          <button
                            key={type}
                            type="button"
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData('application/x-module-type', type)}
                            onClick={() => addEditorModule(type)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                          >
                            {MODULE_LABELS[type] || type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </aside>

                  <main className="min-w-0 overflow-auto bg-slate-200 p-4">
                    <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                      Build the submittal visually before download. Drag modules from the palette, drag placed modules to move them, add pages, and edit the selected module on the right.
                    </div>
                    <div className="flex justify-center">
                      <SheetCanvas
                        page={selectedPage}
                        selectedModuleId={selectedModuleId}
                        setSelectedModuleId={setSelectedModuleId}
                        dragState={dragState}
                        setDragState={setDragState}
                        onMoveModule={(moduleId, patch) => {
                          if (!selectedPage) return;
                          persistComposition(updateModule(composition, selectedPage.id, moduleId, patch));
                        }}
                        onDropModule={(type, x, y) => addEditorModule(type, { ...defaultModuleRect(type), x, y })}
                      />
                    </div>
                  </main>

                  <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Sheet Properties</p>
                      <div className="mt-2 space-y-2">
                        <SubmittalField label="Sheet No">
                          <Input className="h-8 text-xs" value={selectedPage?.sheetNo || ''} onChange={(e) => updateSelectedPage({ sheetNo: e.target.value })} />
                        </SubmittalField>
                        <SubmittalField label="Sheet Title">
                          <Input className="h-8 text-xs" value={selectedPage?.title || ''} onChange={(e) => updateSelectedPage({ title: e.target.value })} />
                        </SubmittalField>
                        <Button type="button" variant="outline" size="sm" className="w-full text-xs text-red-600 hover:text-red-700" disabled={(composition.pages || []).length <= 1} onClick={deleteEditorPage}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Page
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold text-slate-800">Selected Module</p>
                      {selectedModule ? (
                        <div className="mt-2 space-y-2">
                          <p className="rounded bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                            {MODULE_LABELS[selectedModule.type] || selectedModule.type}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {['x','y','w','h'].map((key) => (
                              <SubmittalField key={key} label={key.toUpperCase()}>
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  value={Math.round(Number(selectedModule[key] || 0) * 10) / 10}
                                  onChange={(e) => updateSelectedModule({ [key]: Number(e.target.value) || 0 })}
                                />
                              </SubmittalField>
                            ))}
                          </div>
                          {selectedModule.type === MODULE_TYPES.FLOOR_PLAN && (
                            <SubmittalField label="Floor">
                              <Input type="number" min={1} className="h-8 text-xs" value={selectedModule.props?.floor || activeFloor} onChange={(e) => updateSelectedModule({ props: { floor: Number(e.target.value) || 1 } })} />
                            </SubmittalField>
                          )}
                          {selectedModule.type === MODULE_TYPES.TEXT && (
                            <SubmittalField label="Text">
                              <Textarea className="min-h-[70px] text-xs" value={selectedModule.props?.text || ''} onChange={(e) => updateSelectedModule({ props: { text: e.target.value } })} />
                            </SubmittalField>
                          )}
                          {selectedModule.type === MODULE_TYPES.TITLE_BLOCK && (
                            <>
                              <SubmittalField label="Sheet No">
                                <Input className="h-8 text-xs" value={selectedModule.props?.sheetNo || selectedPage?.sheetNo || ''} onChange={(e) => updateSelectedModule({ props: { sheetNo: e.target.value } })} />
                              </SubmittalField>
                              <SubmittalField label="Title">
                                <Input className="h-8 text-xs" value={selectedModule.props?.sheetTitle || selectedPage?.title || ''} onChange={(e) => updateSelectedModule({ props: { sheetTitle: e.target.value } })} />
                              </SubmittalField>
                            </>
                          )}
                          <Button type="button" variant="outline" size="sm" className="w-full text-xs text-red-600 hover:text-red-700" onClick={deleteSelectedModule}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Module
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                          Select a module on the sheet or drag one from the palette.
                        </p>
                      )}
                    </div>
                  </aside>
                </div>
              </TabsContent>

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
                  <Label className="text-[10px] text-slate-600">Manufacturer Cut Sheets (PDF/image — appended to the submittal as listed pages)</Label>
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    disabled={cutSheetUploading}
                    className="text-xs h-8 file:mr-2 file:text-xs mt-1"
                    onChange={handleCutSheetFiles}
                  />
                  {cutSheetUploading && <p className="text-[10px] text-slate-500 mt-1">Uploading…</p>}
                  {(submittalMeta.cut_sheets || []).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {submittalMeta.cut_sheets.map((cs, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] bg-slate-50 border rounded px-2 py-1">
                          <span className="truncate">{cs.name || cs.url}</span>
                          <button type="button" className="text-red-500 text-[10px] ml-2 shrink-0" onClick={() => removeCutSheet(i)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
            <span className="ml-2 text-slate-400">
              → {(() => {
                const t = getTemplate(templateId);
                const first = t.sheetNumbers.legend || t.sheetNumbers.cover;
                const plan = t.sheetNumbers.floorPlan(activeFloor);
                const last = t.sheetNumbers.riser || t.sheetNumbers.calcs;
                return `${first} · ${plan} · ${last}`;
              })()}
            </span>
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

function SheetCanvas({
  page,
  selectedModuleId,
  setSelectedModuleId,
  dragState,
  setDragState,
  onMoveModule,
  onDropModule,
}) {
  const scale = 0.58;
  const sheetW = SHEET_W_MM * scale;
  const sheetH = SHEET_H_MM * scale;
  const sheetRef = useRef(null);

  const eventToSheetPoint = (event) => {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(SHEET_W_MM, (event.clientX - rect.left) / scale)),
      y: Math.max(0, Math.min(SHEET_H_MM, (event.clientY - rect.top) / scale)),
    };
  };

  const handleMouseMove = (event) => {
    if (!dragState) return;
    const pt = eventToSheetPoint(event);
    onMoveModule(dragState.id, {
      x: Math.max(0, Math.min(SHEET_W_MM - dragState.w, pt.x - dragState.dx)),
      y: Math.max(0, Math.min(SHEET_H_MM - dragState.h, pt.y - dragState.dy)),
    });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-module-type');
    if (!type) return;
    const pt = eventToSheetPoint(event);
    onDropModule(type, Math.max(0, pt.x - 20), Math.max(0, pt.y - 20));
  };

  if (!page) {
    return (
      <div className="flex h-80 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Add a page to start composing the submittal.
      </div>
    );
  }

  return (
    <div
      ref={sheetRef}
      className="relative shrink-0 bg-white shadow-2xl ring-1 ring-slate-300"
      style={{ width: sheetW, height: sheetH }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragState(null)}
      onMouseLeave={() => setDragState(null)}
      onClick={() => setSelectedModuleId(null)}
    >
      <div className="absolute inset-1 border border-slate-900" />
      <div className="absolute inset-2 border border-slate-400" />
      {(page.modules || []).map((mod) => {
        const active = selectedModuleId === mod.id;
        return (
          <button
            key={mod.id}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedModuleId(mod.id);
              const pt = eventToSheetPoint(event);
              setDragState({
                id: mod.id,
                dx: pt.x - Number(mod.x || 0),
                dy: pt.y - Number(mod.y || 0),
                w: Number(mod.w || 0),
                h: Number(mod.h || 0),
              });
            }}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedModuleId(mod.id);
            }}
            className={`absolute overflow-hidden rounded-sm border-2 text-left transition ${TYPE_COLORS[mod.type] || 'border-slate-400 bg-slate-50'} ${
              active ? 'ring-2 ring-orange-400' : ''
            }`}
            style={{
              left: Number(mod.x || 0) * scale,
              top: Number(mod.y || 0) * scale,
              width: Math.max(12, Number(mod.w || 40) * scale),
              height: Math.max(12, Number(mod.h || 30) * scale),
            }}
          >
            <div className="flex h-full flex-col p-1">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-700">
                <GripHorizontal className="h-3 w-3 shrink-0" />
                <span className="truncate">{MODULE_LABELS[mod.type] || mod.type}</span>
              </div>
              <div className="mt-1 min-h-0 flex-1 text-[9px] leading-tight text-slate-500">
                {modulePreviewText(mod, page)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function modulePreviewText(mod, page) {
  if (mod.type === MODULE_TYPES.TITLE_BLOCK) {
    return `${mod.props?.sheetNo || page?.sheetNo || ''} ${mod.props?.sheetTitle || page?.title || ''}`.trim() || 'Title block';
  }
  if (mod.type === MODULE_TYPES.FLOOR_PLAN) return `Floor ${mod.props?.floor || 1}`;
  if (mod.type === MODULE_TYPES.TEXT) return mod.props?.text || 'Text block';
  if (mod.type === MODULE_TYPES.IMAGE) return 'Image placeholder';
  return 'Auto-generated from project data';
}
