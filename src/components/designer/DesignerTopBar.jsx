import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, FileDown, FileText, Table2, FileType, Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export default function DesignerTopBar({
  project,
  saving,
  onSave,
  onExportPDF,
  onExportDeviceSchedule,
  onExportSequence,
  deviceCount = 0,
}) {
  return (
    <div className="h-12 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium truncate max-w-[300px]">{project.name}</h2>
        <Badge variant="secondary" className="text-[10px]">
          Floor {project.num_floors}
        </Badge>
        {deviceCount > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {deviceCount} devices
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-1.5 h-8 text-xs">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {saving ? "Saving..." : "Save"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <FileDown className="h-3 w-3" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportPDF} className="text-xs gap-2">
              <FileText className="h-3 w-3" /> Full PDF Report
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportDeviceSchedule} className="text-xs gap-2">
              <Table2 className="h-3 w-3" /> Device Schedule (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportSequence} className="text-xs gap-2">
              <FileType className="h-3 w-3" /> Sequence of Operations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}