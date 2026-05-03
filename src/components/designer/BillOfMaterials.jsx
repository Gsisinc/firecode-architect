import { useMemo } from 'react';
import { X, Download, FileText, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import { calculateWireLengthSummary } from '@/lib/designValidation';
import { loadSubmittalLogoDataUrl, drawGsisLetterheadHeader, GSIS_HEADER_BAR_MM } from '@/lib/submittalBranding';

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
    const logoDataUrl = await loadSubmittalLogoDataUrl({ width: 560, height: 280 });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pName = project?.name || 'Fire Alarm System';
    const now = new Date().toLocaleDateString();

    // Cover header — white + logo
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(0.45);
    doc.line(0, 42, 210, 42);
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 146, 8, 54, 15);
      } catch {
        /* ignore */
      }
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL OF MATERIALS', 14, 20);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text(pName, 14, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${now}  ·  Total Devices: ${totalDevices}`, 14, 36);

    // Summary table
    let y = 50;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Summary', 14, y);
    y += 6;

    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('#', 16, y + 5);
    doc.text('Device Type', 24, y + 5);
    doc.text('NFPA Ref', 110, y + 5);
    doc.text('Qty', 155, y + 5);
    doc.text('Floors', 170, y + 5);
    y += 8;

    bom.forEach((item, i) => {
      if (y > 270) {
        doc.addPage();
        drawGsisLetterheadHeader(doc, 210, logoDataUrl);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, "F");
        y = 20 + GSIS_HEADER_BAR_MM;
      }
      const bg = i % 2 === 0 ? 255 : 248;
      doc.setFillColor(bg, bg, bg);
      doc.rect(14, y - 1, 182, 7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(i + 1), 16, y + 4);
      doc.text(DEVICE_TYPE_LABELS[item.type] || item.type, 24, y + 4);
      doc.setTextColor(71, 85, 105);
      doc.text(NFPA_REFS[item.type] || '—', 110, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(249, 115, 22);
      doc.text(String(item.count), 157, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const floors = [...new Set(item.devices.map(d => d.floor))].sort().join(', ');
      doc.text(floors, 170, y + 4);
      y += 7;
    });

    // Detail page
    doc.addPage();
    drawGsisLetterheadHeader(doc, 210, logoDataUrl);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, "F");
    y = 20 + GSIS_HEADER_BAR_MM;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Device Detail', 14, y);
    y += 6;

    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    ['#', 'Type', 'Label', 'Address', 'Zone', 'Circuit', 'Fl', 'Mount', 'cd', 'dB'].forEach((h, hi) => {
      const xs = [16, 22, 70, 100, 122, 143, 158, 164, 183, 192];
      doc.text(h, xs[hi], y + 5);
    });
    y += 8;

    devices.forEach((d, i) => {
      if (y > 278) {
        doc.addPage();
        drawGsisLetterheadHeader(doc, 210, logoDataUrl);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, "F");
        y = 15 + GSIS_HEADER_BAR_MM;
      }
      const bg = i % 2 === 0 ? 255 : 248;
      doc.setFillColor(bg, bg, bg);
      doc.rect(14, y - 1, 182, 6, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      const xs = [16, 22, 70, 100, 122, 143, 158, 164, 183, 192];
      const vals = [
        i + 1,
        (DEVICE_TYPE_LABELS[d.type] || d.type || '').slice(0, 16),
        (d.label || '—').slice(0, 12),
        d.address || '—',
        (d.zone || '—').slice(0, 8),
        (d.circuit || '—').slice(0, 8),
        d.floor || 1,
        (d.mounting_height || 'Ceil').slice(0, 5),
        d.candela || '—',
        d.db_rating || '—',
      ];
      vals.forEach((v, vi) => doc.text(String(v), xs[vi], y + 4));
      y += 6;
    });

    if (wireSummary.byCircuit.length) {
      doc.addPage();
      drawGsisLetterheadHeader(doc, 210, logoDataUrl);
      doc.setFillColor(248, 250, 252);
      doc.rect(0, GSIS_HEADER_BAR_MM, 210, 297 - GSIS_HEADER_BAR_MM, "F");
      y = 20 + GSIS_HEADER_BAR_MM;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Field Wire Summary', 14, y);
      y += 8;
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      wireSummary.byCircuit.forEach(w => {
        doc.text(`${w.circuit} | Floor ${w.floor} | ${w.segments} segment(s) | ${w.feet} ft`, 16, y);
        y += 6;
      });
      doc.setFont('helvetica', 'bold');
      doc.text(`Total estimated field wire: ${wireSummary.totalFeet} ft`, 16, y + 4);
    }

    doc.save(`${(project?.name || 'project').replace(/\s+/g, '_')}_BOM.pdf`);
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