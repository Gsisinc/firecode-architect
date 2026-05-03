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

export default function SubmittalPackage({ project, devices, rooms, wires = [], floorPlans = [], analysisResults, canvasRef, onClose, onSaveSubmittalMeta }) {
  const [generating, setGenerating] = useState(false);
  const [ahjCover, setAhjCover] = useState(true);
  const [submittalMeta, setSubmittalMeta] = useState({
    scope_of_work: "",
    contractor_license: "",
  });
  useEffect(() => {
    const m = project?.submittal_meta;
    if (m && typeof m === "object") {
      setSubmittalMeta((s) => ({
        scope_of_work: m.scope_of_work || s.scope_of_work,
        contractor_license: m.contractor_license || s.contractor_license,
      }));
    }
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
    setGenerating(true);
    onSaveSubmittalMeta?.(submittalMeta);
    try {
      await runSubmittalPackagePdf({
        project,
        devices,
        rooms,
        wires,
        floorPlans,
        analysisResults,
        canvasRef,
        sections,
        ahjCover,
        submittalMeta,
      });
    } finally {
      setGenerating(false);
    }
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
    { key: "floorPlanSnapshot", label: "Floor Plan Snapshot (canvas)" },
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
                Include professional cover: scope, drawing index, legend with CSFM placeholders (replace with uploaded cut sheets), sequence matrix, battery/NAC summary, Temporal Code-3 note.
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600">Scope of work (printed on FA-0)</Label>
              <Textarea
                className="text-xs min-h-[56px]"
                placeholder="e.g. Tenant improvement — new addressable devices, duct smoke per mechanical…"
                value={submittalMeta.scope_of_work}
                onChange={(e) => setSubmittalMeta((m) => ({ ...m, scope_of_work: e.target.value }))}
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
                      <Camera className="w-2.5 h-2.5 mr-1" />canvas capture
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