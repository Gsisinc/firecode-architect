import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Battery, Zap, FileText, Cable } from "lucide-react";
import {
  calculateBatterySizing,
  calculateNacLoading,
  calculateSlcCapacity,
  determineWiringType,
  generateDeviceSchedule,
  generateSequenceOfOperations,
} from "@/lib/codeEngine";

const TYPE_LABELS = {
  smoke_detector: "Smoke Detector",
  heat_detector: "Heat Detector",
  pull_station: "Pull Station",
  horn_strobe: "Horn/Strobe",
  strobe: "Strobe",
  horn: "Horn",
  speaker: "Speaker",
  waterflow_switch: "Waterflow Switch",
  valve_tamper: "Valve/Tamper Switch",
  facp: "FACP",
};

export default function CalculationsPanel({ project, devices, analysisResults, onClose }) {
  const battery = calculateBatterySizing(devices.length, 24, 5);
  const nacLoading = calculateNacLoading(devices);
  const wiring = determineWiringType(project);
  const slcCapacity = calculateSlcCapacity(devices.length);
  const schedule = generateDeviceSchedule(devices);
  const sequence = analysisResults
    ? generateSequenceOfOperations(analysisResults, project)
    : "Run code analysis first to generate sequence.";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between shrink-0 border-b">
          <CardTitle className="text-base">Calculations & Reports</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <Tabs defaultValue="battery" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-3 shrink-0">
              <TabsTrigger value="battery" className="text-xs gap-1">
                <Battery className="h-3 w-3" /> Battery
              </TabsTrigger>
              <TabsTrigger value="nac" className="text-xs gap-1">
                <Zap className="h-3 w-3" /> NAC Loading
              </TabsTrigger>
              <TabsTrigger value="wiring" className="text-xs gap-1">
                <Cable className="h-3 w-3" /> Wiring
              </TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs gap-1">
                <FileText className="h-3 w-3" /> Device Schedule
              </TabsTrigger>
              <TabsTrigger value="sequence" className="text-xs gap-1">
                <FileText className="h-3 w-3" /> Sequence
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="battery" className="mt-0">
                <div className="max-w-lg space-y-4">
                  <h3 className="text-sm font-semibold">Battery Sizing Calculation</h3>
                  <p className="text-xs text-muted-foreground font-mono">{battery.code_ref}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Standby Current", `${battery.standby_current_mA} mA`],
                      ["Alarm Current", `${battery.alarm_current_mA} mA`],
                      ["Standby Ah", `${battery.standby_Ah} Ah`],
                      ["Alarm Ah", `${battery.alarm_Ah} Ah`],
                      ["Derating ×1.20", `${battery.raw_Ah} → ${battery.required_Ah} Ah`],
                      ["Required Ah", `${battery.required_Ah} Ah`],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-muted rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-sm font-mono font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <p className="text-xs font-medium">Recommended Battery</p>
                    <p className="text-sm font-mono mt-1">{battery.recommended_batteries}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{battery.code_ref}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="nac" className="mt-0">
                <h3 className="text-sm font-semibold mb-3">NAC Circuit Loading</h3>
                {nacLoading.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notification devices placed yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Circuit</TableHead>
                        <TableHead className="text-xs">Floor</TableHead>
                        <TableHead className="text-xs">Devices</TableHead>
                        <TableHead className="text-xs">Current (mA)</TableHead>
                        <TableHead className="text-xs">Rated (A)</TableHead>
                        <TableHead className="text-xs">% Used</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nacLoading.map((nac) => (
                        <TableRow key={nac.circuit}>
                          <TableCell className="text-xs font-mono">{nac.circuit}</TableCell>
                          <TableCell className="text-xs">{nac.floor}</TableCell>
                          <TableCell className="text-xs">{nac.device_count}</TableCell>
                          <TableCell className="text-xs font-mono">{nac.total_current_mA}</TableCell>
                          <TableCell className="text-xs font-mono">{nac.rated_current_A}</TableCell>
                          <TableCell className="text-xs font-mono">{nac.percent_of_rating}%</TableCell>
                          <TableCell>
                            <Badge variant={nac.compliant ? "secondary" : "destructive"} className="text-[9px]">
                              {nac.compliant ? "OK" : "Over 80%"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="mt-4 bg-muted rounded-lg p-3">
                  <h4 className="text-xs font-semibold mb-2">SLC Loop Capacity</h4>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Used</p>
                      <p className="text-sm font-mono">{slcCapacity.used_percent}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Spare</p>
                      <p className="text-sm font-mono">{slcCapacity.spare_percent}%</p>
                    </div>
                    <Badge variant={slcCapacity.compliant ? "secondary" : "destructive"} className="text-[9px]">
                      {slcCapacity.compliant ? "≥20% Spare" : "Below 20% Spare"}
                    </Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="wiring" className="mt-0">
                <div className="max-w-lg space-y-4">
                  <h3 className="text-sm font-semibold">Wiring Specification</h3>
                  <p className="text-xs text-muted-foreground font-mono">{wiring.nec_article}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Wire Type", wiring.wire_type],
                      ["Conductor Size", wiring.conductor_size],
                      ["Configuration", wiring.conductor_count],
                      ["Survivability", wiring.survivability_level],
                      ["Circuit Class", wiring.circuit_class],
                      ["CI Cable", wiring.ci_cable_required ? "Required" : "Not Required"],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-muted rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-sm font-mono font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {(wiring.notes || []).map((note, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {note}</p>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="mt-0">
                <h3 className="text-sm font-semibold mb-3">Device Schedule ({schedule.length} devices)</h3>
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">#</TableHead>
                        <TableHead className="text-[10px]">Type</TableHead>
                        <TableHead className="text-[10px]">Address</TableHead>
                        <TableHead className="text-[10px]">Zone</TableHead>
                        <TableHead className="text-[10px]">Floor</TableHead>
                        <TableHead className="text-[10px]">Height</TableHead>
                        <TableHead className="text-[10px]">cd/dB</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((item) => (
                        <TableRow key={item.item}>
                          <TableCell className="text-[10px] font-mono">{item.item}</TableCell>
                          <TableCell className="text-[10px]">{TYPE_LABELS[item.device_type] || item.type_label || item.device_type}</TableCell>
                          <TableCell className="text-[10px] font-mono">{item.address}</TableCell>
                          <TableCell className="text-[10px]">{item.zone}</TableCell>
                          <TableCell className="text-[10px]">{item.floor}</TableCell>
                          <TableCell className="text-[10px] font-mono">{item.mounting_height}</TableCell>
                          <TableCell className="text-[10px] font-mono">
                            {item.candela ? `${item.candela}cd` : item.db_rating ? `${item.db_rating}dB` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="sequence" className="mt-0">
                <h3 className="text-sm font-semibold mb-3">Sequence of Operations</h3>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-auto">
                  {sequence}
                </pre>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}