import { useMemo } from 'react';
import { X, Download, FileText, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { calculateWireLengthSummary } from '@/lib/designValidation';
import { exportBillOfMaterialsPdf } from '@/lib/bomPdfExport';

const DEVICE_TYPE_LABELS = {
  smoke_detector: 'Smoke Detector',
  heat_detector: 'Heat Detector',
  pull_station: 'Manual Pull Station',
  horn_strobe: 'Horn / Strobe',
  strobe: 'Visual Appliance (Strobe)',
  horn: 'Audible Appliance (Horn)',
  speaker: 'Speaker / Strobe',
  duct_detector: 'Duct Smoke Detector',
  waterflow_switch: 'Waterflow Switch',
  valve_tamper: 'Valve Tamper Switch',
  co_detector: 'CO Detector',
  facp: 'Fire Alarm Control Panel',
  elevator_recall: 'Elevator Recall Detector',
  monitor_module: 'Monitor Module (sprinkler input)',
  control_module: 'Control / Relay Module',
  door_holder: 'Door Holder / Release',
};

const NFPA_REFS = {
  smoke_detector: 'NFPA 72 §17.7',
  heat_detector: 'NFPA 72 §17.6',
  pull_station: 'NFPA 72 §17.14',
  horn_strobe: 'NFPA 72 §18',
  strobe: 'NFPA 72 §18.5',
  horn: 'NFPA 72 §18.4',
  speaker: 'NFPA 72 §24',
  duct_detector: 'NFPA 72 §17.7.5',
  waterflow_switch: 'NFPA 13 / NFPA 72 §17.12',
  valve_tamper: 'NFPA 13 / NFPA 72 §17.13',
  co_detector: 'NFPA 720 / IBC §915',
  facp: 'NFPA 72 §10',
  elevator_recall: 'ASME A17.1 / IBC §3006',
  monitor_module: 'NFPA 72 §17.16',
  control_module: 'NFPA 72 ch. 23 / §21',
  door_holder: 'NFPA 101 / NFPA 72 interface',
};

function buildBOM(devices) {
  const grouped = {};
  devices.forEach(d => {
    const key = d.type || d.subtype || 'unknown';
    if (!grouped[key]) grouped[key] = { type: key, count: 0, devices: [] };
    grouped[key].count++;
    grouped[key].devices.push(d);
  });
  return Object.values(grouped).sort((a, b) =>
    (DEVICE_TYPE_LABELS[a.type] || a.type).localeCompare(DEVICE_TYPE_LABELS[b.type] || b.type)
  );
}

export default function BillOfMaterials({ project, devices, floorPlans = [], wires = [], onClose }) {
  const bom = useMemo(() => buildBOM(devices), [devices]);
  const wireSummary = useMemo(
    () => calculateWireLengthSummary({ devices, wires, floorPlans }),
    [devices, wires, floorPlans]
  );
  const totalDevices = devices.length;

  const exportCSV = () => {
    const headers = ['#', 'Device Type', 'NFPA Reference', 'Quantity', 'Addresses', 'Floors'];
    const rows = bom.map((item, i) => {
      const addrs = item.devices.map(d => d.address || '—').join('; ');
      const floors = [...new Set(item.devices.map(d => d.floor))].sort().join(', ');
      return [i + 1, DEVICE_TYPE_LABELS[item.type] || item.type, NFPA_REFS[item.type] || '—', item.count, `"${addrs}"`, floors];
    });

    // Detail sheet
    const detailHeaders = ['Item', 'Type', 'Label', 'Address', 'Zone', 'Circuit', 'Floor', 'Mounting', 'Candela', 'dB'];
    const detailRows = devices.map((d, i) => [
      i + 1,
      DEVICE_TYPE_LABELS[d.type] || d.type,
      d.label || '—',
      d.address || '—',
      d.zone || '—',
      d.circuit || '—',
      d.floor || 1,
      d.mounting_height || 'Ceiling',
      d.candela || '—',
      d.db_rating || '—',
    ]);

    const csv = [
      `Bill of Materials — ${project?.name || 'Project'}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `Total Devices: ${totalDevices}`,
      '',
      '=== SUMMARY ===',
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '',
      '=== DEVICE DETAIL ===',
      detailHeaders.join(','),
      ...detailRows.map(r => r.join(',')),
      '',
      '=== FIELD WIRE ===',
      'Circuit,Floor,Segments,Estimated Feet',
      ...wireSummary.byCircuit.map(w => [w.circuit, w.floor, w.segments, w.feet].join(',')),
      `TOTAL,,${wires.length},${wireSummary.totalFeet}`,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project?.name || 'project').replace(/\s+/g, '_')}_BOM.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    await exportBillOfMaterialsPdf({ project, devices, floorPlans, wires });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between shrink-0 border-b">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Bill of Materials</CardTitle>
            <Badge variant="secondary" className="text-xs">{totalDevices} devices</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 text-xs gap-1.5">
              <FileText className="h-3 w-3" /> CSV
            </Button>
            <Button size="sm" onClick={exportPDF} className="h-7 text-xs gap-1.5 bg-orange-500 hover:bg-orange-600">
              <Download className="h-3 w-3" /> PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Summary */}
          <div className="px-4 pt-4 pb-2 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-3">Summary by Type</p>
            <div className="flex flex-wrap gap-2">
              {bom.map(item => (
                <div key={item.type} className="flex items-center gap-1.5 bg-muted rounded-md px-2.5 py-1.5">
                  <span className="text-xs font-medium">{DEVICE_TYPE_LABELS[item.type] || item.type}</span>
                  <Badge className="text-[10px] h-4 px-1.5">{item.count}</Badge>
                </div>
              ))}
            </div>
            {wireSummary.totalFeet > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Field wire: <span className="font-mono font-semibold text-slate-800">{wireSummary.totalFeet} ft</span> across {wires.length} saved segment{wires.length === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* Detail table */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Device Detail</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] w-8">#</TableHead>
                    <TableHead className="text-[10px]">Type</TableHead>
                    <TableHead className="text-[10px]">Label</TableHead>
                    <TableHead className="text-[10px]">Address</TableHead>
                    <TableHead className="text-[10px]">Circuit</TableHead>
                    <TableHead className="text-[10px]">Zone</TableHead>
                    <TableHead className="text-[10px]">Floor</TableHead>
                    <TableHead className="text-[10px]">Mount</TableHead>
                    <TableHead className="text-[10px]">NFPA Ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d, i) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-[10px]">{DEVICE_TYPE_LABELS[d.type] || d.type}</TableCell>
                      <TableCell className="text-[10px] font-mono">{d.label || '—'}</TableCell>
                      <TableCell className="text-[10px] font-mono">{d.address || '—'}</TableCell>
                      <TableCell className="text-[10px] font-mono">{d.circuit || '—'}</TableCell>
                      <TableCell className="text-[10px] font-mono">{d.zone || '—'}</TableCell>
                      <TableCell className="text-[10px]">{d.floor || 1}</TableCell>
                      <TableCell className="text-[10px]">{d.mounting_height || 'Ceiling'}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground font-mono">{NFPA_REFS[d.type] || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}