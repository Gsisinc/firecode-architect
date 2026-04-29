import { useState, useEffect } from 'react';
import { X, Trash2, ChevronRight, MapPin, Radio, Tag, Ruler, Zap, Volume2, Hash, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const DEVICE_TYPE_LABELS = {
  smoke_detector: 'Smoke Detector',
  heat_detector: 'Heat Detector',
  pull_station: 'Manual Pull Station',
  horn_strobe: 'Horn / Strobe',
  strobe: 'Strobe',
  horn: 'Horn',
  speaker: 'Speaker / Strobe',
  duct_detector: 'Duct Detector',
  waterflow_switch: 'Waterflow Switch',
  valve_tamper: 'Valve Tamper Switch',
  co_detector: 'CO Detector',
  facp: 'Fire Alarm Control Panel',
  elevator_recall: 'Elevator Recall Detector',
};

const DEVICE_COLORS = {
  smoke_detector: '#3b82f6',
  heat_detector: '#f59e0b',
  pull_station: '#ef4444',
  horn_strobe: '#f97316',
  strobe: '#8b5cf6',
  speaker: '#06b6d4',
  duct_detector: '#6366f1',
  waterflow_switch: '#10b981',
  valve_tamper: '#14b8a6',
  co_detector: '#84cc16',
  facp: '#ef4444',
  elevator_recall: '#a78bfa',
};

function Field({ label, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function DevicePanel({ device, onUpdate, onDelete, onClose }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (device) setForm({ ...device });
  }, [device?.id]);

  if (!device || !form) return null;

  const handleChange = (key, value) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    onUpdate(device.id, updated);
  };

  const deviceColor = DEVICE_COLORS[form.type] || DEVICE_COLORS[form.subtype] || '#94a3b8';
  const typeLabel = DEVICE_TYPE_LABELS[form.type] || DEVICE_TYPE_LABELS[form.subtype] || form.type;
  const isNotification = ['horn_strobe', 'strobe', 'horn', 'speaker'].includes(form.type || form.subtype);
  const isStrobe = ['strobe', 'horn_strobe', 'speaker'].includes(form.type || form.subtype);
  const isHorn = ['horn', 'horn_strobe'].includes(form.type || form.subtype);

  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-[hsl(222,47%,8%)] border-l border-white/10 flex flex-col shadow-2xl z-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: deviceColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{typeLabel}</p>
          <p className="text-[10px] text-white/30 font-mono">{form.id}</p>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white p-1 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Identity */}
        <section className="space-y-3">
          <p className="text-[9px] uppercase tracking-widest text-white/20 font-medium">Identity</p>

          <Field label="Custom Label" icon={Tag}>
            <Input
              value={form.label || ''}
              onChange={e => handleChange('label', e.target.value)}
              className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="e.g. SD-101"
            />
          </Field>

          <Field label="SLC Address" icon={Hash}>
            <Input
              value={form.address || ''}
              onChange={e => handleChange('address', e.target.value)}
              className="h-7 text-xs font-mono bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="1-001"
            />
          </Field>
        </section>

        <Separator className="bg-white/10" />

        {/* Circuit & Zone */}
        <section className="space-y-3">
          <p className="text-[9px] uppercase tracking-widest text-white/20 font-medium">Circuit & Zone</p>

          <Field label="Circuit ID" icon={Radio}>
            <Input
              value={form.circuit || ''}
              onChange={e => handleChange('circuit', e.target.value)}
              className="h-7 text-xs font-mono bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="SLC-1 / NAC-1"
            />
          </Field>

          <Field label="Zone" icon={MapPin}>
            <Input
              value={form.zone || ''}
              onChange={e => handleChange('zone', e.target.value)}
              className="h-7 text-xs font-mono bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="F1-Z1"
            />
          </Field>
        </section>

        <Separator className="bg-white/10" />

        {/* Mounting */}
        <section className="space-y-3">
          <p className="text-[9px] uppercase tracking-widest text-white/20 font-medium">Mounting</p>

          <Field label="Mounting Location" icon={Ruler}>
            <Select value={form.mounting_height || 'Ceiling'} onValueChange={v => handleChange('mounting_height', v)}>
              <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ceiling">Ceiling</SelectItem>
                <SelectItem value="Wall - High">Wall – High (≥80" AFF)</SelectItem>
                <SelectItem value="Wall - 84 AFF">Wall – 84" AFF</SelectItem>
                <SelectItem value="Wall - 72 AFF">Wall – 72" AFF</SelectItem>
                <SelectItem value="Wall - 48 AFF">Wall – 48" AFF</SelectItem>
                <SelectItem value="Floor">Floor Level</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="X (px)">
              <Input
                type="number"
                value={Math.round(form.x || 0)}
                onChange={e => handleChange('x', +e.target.value)}
                className="h-7 text-xs font-mono bg-white/5 border-white/10 text-white"
              />
            </Field>
            <Field label="Y (px)">
              <Input
                type="number"
                value={Math.round(form.y || 0)}
                onChange={e => handleChange('y', +e.target.value)}
                className="h-7 text-xs font-mono bg-white/5 border-white/10 text-white"
              />
            </Field>
          </div>
        </section>

        {/* Notification-specific */}
        {isNotification && (
          <>
            <Separator className="bg-white/10" />
            <section className="space-y-3">
              <p className="text-[9px] uppercase tracking-widest text-white/20 font-medium">Notification Settings</p>

              {isStrobe && (
                <Field label="Candela Rating" icon={Zap}>
                  <Select value={String(form.candela || 15)} onValueChange={v => handleChange('candela', +v)}>
                    <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[15, 30, 60, 75, 95, 110, 135, 150, 177, 185].map(cd => (
                        <SelectItem key={cd} value={String(cd)}>{cd} cd</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {isHorn && (
                <Field label="dB Rating" icon={Volume2}>
                  <Select value={String(form.db_rating || 75)} onValueChange={v => handleChange('db_rating', +v)}>
                    <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[70, 75, 80, 85, 90, 95, 100].map(db => (
                        <SelectItem key={db} value={String(db)}>{db} dB</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </section>
          </>
        )}

        {/* Notes / Code refs */}
        {(form.note || form.codeRef) && (
          <>
            <Separator className="bg-white/10" />
            <section className="space-y-2">
              {form.note && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-amber-400/80">{form.note}</p>
                </div>
              )}
              {form.codeRef && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-start gap-1.5">
                  <FileText className="w-3 h-3 text-blue-400/60 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-blue-400/80 font-mono">{form.codeRef}</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(device.id)}
          className="w-full text-red-400/80 hover:text-red-400 hover:bg-red-500/10 gap-2 text-xs h-8"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Device
        </Button>
      </div>
    </div>
  );
}