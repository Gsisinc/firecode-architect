import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  facp: "Fire Alarm Control Panel",
};

export default function DevicePanel({
  device,
  onClose,
  onUpdateDevice,
  onDeleteDevice,
}) {
  if (!device) return null;

  return (
    <div className="absolute right-4 top-16 w-72 z-20">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{TYPE_LABELS[device.type] || device.type}</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input
                  value={device.address || device.id}
                  onChange={(e) => onUpdateDevice(device.id, { address: e.target.value })}
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">X</Label>
                  <Input
                    type="number"
                    value={Math.round(device.x)}
                    onChange={(e) => onUpdateDevice(device.id, { x: parseFloat(e.target.value) })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Y</Label>
                  <Input
                    type="number"
                    value={Math.round(device.y)}
                    onChange={(e) => onUpdateDevice(device.id, { y: parseFloat(e.target.value) })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>

              {device.candela && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Candela</Label>
                  <Badge variant="secondary" className="text-xs font-mono">{device.candela} cd</Badge>
                </div>
              )}

              {device.db_rating && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">dB Rating</Label>
                  <Badge variant="secondary" className="text-xs font-mono">{device.db_rating} dB</Badge>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mounting Height</Label>
                <p className="text-xs font-mono text-muted-foreground">{device.mounting_height || "N/A"}</p>
              </div>

              {device.code_ref && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Code Reference</Label>
                  <p className="text-[10px] font-mono text-muted-foreground">{device.code_ref}</p>
                </div>
              )}

              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-1.5 mt-2 h-7 text-xs"
                onClick={() => onDeleteDevice(device.id)}
              >
                <Trash2 className="h-3 w-3" /> Remove Device
              </Button>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}