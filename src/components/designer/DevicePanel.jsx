import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DevicePanel({ device, onUpdate, onDelete, onClose }) {
  const [form, setForm] = useState({ ...device });

  const handleChange = (key, value) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    onUpdate(updated);
  };

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-800">Device Properties</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="Device ID">
          <Input value={form.id} readOnly className="bg-gray-50 text-xs font-mono" />
        </Field>

        <Field label="Label">
          <Input value={form.label || ''} onChange={e => handleChange('label', e.target.value)} className="text-sm" />
        </Field>

        <Field label="Address">
          <Input value={form.address || ''} onChange={e => handleChange('address', e.target.value)} className="text-sm font-mono" placeholder="1-001" />
        </Field>

        <Field label="Zone">
          <Input value={form.zone || ''} onChange={e => handleChange('zone', e.target.value)} className="text-sm font-mono" placeholder="F1-Z1" />
        </Field>

        <Field label="Circuit">
          <Input value={form.circuit || ''} onChange={e => handleChange('circuit', e.target.value)} className="text-sm font-mono" placeholder="NAC-1" />
        </Field>

        <Field label="Mounting Height">
          <Input value={form.mounting_height || ''} onChange={e => handleChange('mounting_height', e.target.value)} className="text-sm" placeholder='e.g., Ceiling, 84" AFF' />
        </Field>

        {(form.type === 'strobe' || form.type === 'horn_strobe') && (
          <Field label="Candela Rating">
            <Select value={String(form.candela || 15)} onValueChange={v => handleChange('candela', +v)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[15, 30, 60, 75, 95, 110, 135].map(cd => (
                  <SelectItem key={cd} value={String(cd)}>{cd} cd</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {(form.type === 'horn' || form.type === 'horn_strobe') && (
          <Field label="dB Rating">
            <Select value={String(form.db_rating || 75)} onValueChange={v => handleChange('db_rating', +v)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[75, 85, 90, 95].map(db => (
                  <SelectItem key={db} value={String(db)}>{db} dB</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {form.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700">{form.note}</p>
          </div>
        )}

        {form.codeRef && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-mono">{form.codeRef}</p>
          </div>
        )}

        <Field label="Position X">
          <Input type="number" value={Math.round(form.x || 0)} onChange={e => handleChange('x', +e.target.value)} className="text-sm font-mono" />
        </Field>
        <Field label="Position Y">
          <Input type="number" value={Math.round(form.y || 0)} onChange={e => handleChange('y', +e.target.value)} className="text-sm font-mono" />
        </Field>
      </div>

      <div className="p-4 border-t border-gray-100">
        <Button
          variant="outline"
          onClick={() => onDelete(device.id)}
          className="w-full border-red-200 text-red-600 hover:bg-red-50 gap-2 text-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Device
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      {children}
    </div>
  );
}