import { useEffect, useState } from 'react';
import {
  Activity, CalendarDays, FileText, ImagePlus, Link2, MapPin, PackagePlus,
  Radio, Save, Trash2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { isVideoCameraType } from '@/lib/disciplines';

const STATUS_OPTIONS = ['Proposed', 'In Place', 'To Be Replaced', 'To Be Upgraded', 'To Be Removed'];
const COLOR_OPTIONS = ['#d40b15', '#2563eb', '#ea580c', '#059669', '#7c3aed', '#0f172a'];
const BASE_SECTIONS = [
  { id: 'attributes', label: 'Attributes' },
  { id: 'profile', label: 'Element Profile' },
  { id: 'files', label: 'Files & Photos' },
  { id: 'name', label: 'Name' },
  { id: 'installation', label: 'Installation' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'notes', label: 'Notes' },
];

function buildNavSections(formType) {
  if (!isVideoCameraType(formType)) return BASE_SECTIONS;
  const next = [...BASE_SECTIONS];
  next.splice(1, 0, { id: 'camera', label: 'Camera / video' });
  return next;
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-slate-500 bg-white px-1 w-fit">
        {label} {required && <span className="text-blue-500 text-base leading-none">*</span>}
      </Label>
      {children}
    </div>
  );
}

function PanelInput(props) {
  return <Input {...props} className={`h-10 text-sm bg-white border-slate-300 ${props.className || ''}`} />;
}

function PanelSelect({ value, onValueChange, children, placeholder }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 text-sm bg-white border-slate-300">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

export default function DevicePanel({
  device,
  onUpdate,
  onDelete,
  onClose,
  devicePalette = [],
  circuitTypes = [],
  disciplineConfig,
}) {
  const [form, setForm] = useState(null);
  const [activeSection, setActiveSection] = useState('attributes');

  const DEVICE_TYPE_LABELS = Object.fromEntries(devicePalette.map((d) => [d.type, d.label]));
  const DEVICE_COLORS = Object.fromEntries(devicePalette.map((d) => [d.type, d.color]));

  useEffect(() => {
    if (device) setForm({ ...device });
  }, [device]);

  if (!device || !form) return null;

  const navSections = buildNavSections(form.type);

  const handleChange = (key, value) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    onUpdate(device.id, updated);
  };

  const typeLabel = DEVICE_TYPE_LABELS[form.type] || form.element_name || form.type;
  const color = form.color || DEVICE_COLORS[form.type] || '#d40b15';
  const activityLog = form.activity_log || [];
  const accessories = form.accessories || [];

  return (
    <div className="absolute top-0 right-0 h-full w-[720px] max-w-[calc(100%-2rem)] bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20">
      <div className="h-16 border-b border-slate-200 flex items-center gap-3 px-5 shrink-0">
        <div className="w-8 h-8 rounded border-2 flex items-center justify-center text-[9px] font-bold" style={{ borderColor: color, color }}>
          {(form.label || typeLabel || 'NODE').slice(0, 4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl text-slate-900 truncate">{form.label || form.id}</h2>
          <p className="text-xs text-slate-500 truncate">
            {typeLabel} · {form.nfpa_symbol_reference || disciplineConfig?.symbolReference || '—'}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
          <X className="w-7 h-7" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <nav className="w-48 border-r border-slate-200 bg-slate-50/60 py-4 shrink-0">
          {navSections.map(section => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                activeSection === section.id ? 'bg-white text-slate-950 border-l-4' : 'text-slate-600 hover:bg-white'
              }`}
              style={
                activeSection === section.id
                  ? { borderLeftColor: disciplineConfig?.theme?.primary || '#3b82f6' }
                  : undefined
              }
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section id="attributes" className="space-y-4">
            <h3 className="text-2xl text-slate-950">Attributes</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Installation Status">
                <PanelSelect value={form.installation_status || 'Proposed'} onValueChange={value => handleChange('installation_status', value)}>
                  {STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </PanelSelect>
              </Field>
              <Field label="Color" required>
                <PanelSelect value={color} onValueChange={value => handleChange('color', value)}>
                  {COLOR_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: option }} />
                        {option.replace('#', '')}
                      </span>
                    </SelectItem>
                  ))}
                </PanelSelect>
              </Field>
              <Field label="Circuit Type" required>
                <PanelSelect value={form.circuit_type || circuitTypes[0]?.value || 'SLC'} onValueChange={value => {
                  handleChange('circuit_type', value);
                  if (!form.circuit || circuitTypes.some(c => form.circuit?.startsWith(c.value))) {
                    handleChange('circuit', `${value}-${form.floor || 1}`);
                  }
                }}>
                  {circuitTypes.map(circuit => <SelectItem key={circuit.value} value={circuit.value}>{circuit.label} - {circuit.description}</SelectItem>)}
                </PanelSelect>
              </Field>
              <Field label="Circuit ID" required>
                <PanelInput value={form.circuit || ''} onChange={event => handleChange('circuit', event.target.value)} placeholder="POE-1 / SLC-1" />
              </Field>
              <Field label="Cable / media type">
                <PanelInput value={form.cable_type || ''} onChange={event => handleChange('cable_type', event.target.value)} placeholder="Cat6A, fiber, etc." />
              </Field>
              <Field label="Component Manufacturer" required>
                <PanelInput value={form.manufacturer || ''} onChange={event => handleChange('manufacturer', event.target.value)} />
              </Field>
              <Field label="Component Model #" required>
                <PanelInput value={form.model_number || ''} onChange={event => handleChange('model_number', event.target.value)} />
              </Field>
              <Field label="Element Quantity" required>
                <PanelInput type="number" min="1" value={form.quantity || 1} onChange={event => handleChange('quantity', Number(event.target.value))} />
              </Field>
              <Field label="Installation Hours" required>
                <PanelInput type="number" step="0.25" min="0" value={form.installation_hours ?? 1} onChange={event => handleChange('installation_hours', Number(event.target.value))} />
              </Field>
            </div>
          </section>

          {isVideoCameraType(form.type) && (
            <>
              <Separator />
              <section id="camera" className="space-y-4">
                <h3 className="text-2xl text-slate-950">Field of view &amp; aim</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="FOV angle (°)">
                    <PanelInput type="number" min="1" max="360" value={form.fov_degrees ?? 90} onChange={e => handleChange('fov_degrees', Number(e.target.value))} />
                  </Field>
                  <Field label="FOV range (ft)">
                    <PanelInput type="number" min="1" value={form.fov_range_ft ?? 35} onChange={e => handleChange('fov_range_ft', Number(e.target.value))} />
                  </Field>
                  <Field label="Aim azimuth (°)">
                    <PanelInput type="number" value={form.fov_aim_deg ?? 0} onChange={e => handleChange('fov_aim_deg', Number(e.target.value))} placeholder="0 = +X on plan" />
                  </Field>
                  <Field label="Mount height (AFF)">
                    <PanelInput value={form.mount_height_aff || ''} onChange={e => handleChange('mount_height_aff', e.target.value)} placeholder="e.g. 10 ft AFF" />
                  </Field>
                </div>
                <p className="text-sm text-slate-600">
                  On the plan, select the camera and drag the white dot at the end of the dashed boresight to rotate aim. Hold Shift for 15° steps.
                </p>
                <h3 className="text-xl text-slate-950 pt-2">Imaging &amp; stream</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Resolution">
                    <PanelInput value={form.camera_resolution || ''} onChange={e => handleChange('camera_resolution', e.target.value)} placeholder="e.g. 4 MP / 1080p" />
                  </Field>
                  <Field label="Lens / focal">
                    <PanelInput value={form.camera_lens || ''} onChange={e => handleChange('camera_lens', e.target.value)} placeholder="mm or varifocal range" />
                  </Field>
                  <Field label="Codec">
                    <PanelSelect value={form.camera_codec || 'H.265'} onValueChange={v => handleChange('camera_codec', v)}>
                      <SelectItem value="H.265">H.265</SelectItem>
                      <SelectItem value="H.264">H.264</SelectItem>
                      <SelectItem value="MJPEG">MJPEG</SelectItem>
                    </PanelSelect>
                  </Field>
                  <Field label="IR / low light">
                    <PanelInput value={form.camera_ir_mode || ''} onChange={e => handleChange('camera_ir_mode', e.target.value)} placeholder="Smart IR, EXIR, none" />
                  </Field>
                  <Field label="Stream / VMS channel">
                    <PanelInput value={form.camera_stream_id || ''} onChange={e => handleChange('camera_stream_id', e.target.value)} />
                  </Field>
                  <Field label="IP address">
                    <PanelInput value={form.ip_address || ''} onChange={e => handleChange('ip_address', e.target.value)} />
                  </Field>
                </div>
                {form.type === 'cam_ptz' && (
                  <>
                    <h3 className="text-xl text-slate-950 pt-2">PTZ</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Pan range (°)">
                        <PanelInput value={form.ptz_pan_range || ''} onChange={e => handleChange('ptz_pan_range', e.target.value)} placeholder="e.g. 360" />
                      </Field>
                      <Field label="Tilt range (°)">
                        <PanelInput value={form.ptz_tilt_range || ''} onChange={e => handleChange('ptz_tilt_range', e.target.value)} placeholder="e.g. -15 to 90" />
                      </Field>
                      <Field label="Optical zoom (×)">
                        <PanelInput type="number" step="0.1" value={form.ptz_zoom_optical ?? ''} onChange={e => handleChange('ptz_zoom_optical', e.target.value === '' ? '' : Number(e.target.value))} />
                      </Field>
                      <Field label="Presets (#)">
                        <PanelInput type="number" min="0" value={form.ptz_presets_count ?? ''} onChange={e => handleChange('ptz_presets_count', e.target.value === '' ? '' : Number(e.target.value))} />
                      </Field>
                      <Field label="Patrol / pattern">
                        <PanelInput value={form.ptz_patrol || ''} onChange={e => handleChange('ptz_patrol', e.target.value)} placeholder="Pattern A, tour name" />
                      </Field>
                      <Field label="Auto-tracking">
                        <PanelSelect value={form.ptz_auto_track ? 'yes' : 'no'} onValueChange={v => handleChange('ptz_auto_track', v === 'yes')}>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                        </PanelSelect>
                      </Field>
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          <Separator />

          <section id="profile" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl text-slate-950">Element Profile</h3>
              <div className="flex gap-3 text-sm text-blue-600">
                <button onClick={() => handleChange('profile_name', '')}>Clear</button>
                <button className="inline-flex items-center gap-1"><Save className="w-4 h-4" />Save As</button>
              </div>
            </div>
            <Field label="Element Profile">
              <PanelSelect value={form.profile_name || 'none'} onValueChange={value => handleChange('profile_name', value === 'none' ? '' : value)}>
                <SelectItem value="none">No Profiles Found</SelectItem>
                <SelectItem value="standard-addressable">Standard Addressable Device</SelectItem>
                <SelectItem value="notification-wall">Wall Notification Appliance</SelectItem>
              </PanelSelect>
            </Field>
            <p className="text-sm text-slate-700">Estimated Budget Range: ${Number(form.device_price || 0).toFixed(2)}</p>
          </section>

          <Separator />

          <section id="files" className="space-y-4">
            <h3 className="text-2xl text-slate-950">Files & Photos</h3>
            <div className="flex gap-3">
              <Button variant="outline" className="h-12 w-14"><ImagePlus className="w-5 h-5 text-slate-700" /></Button>
              <Button variant="outline" className="h-12 w-14"><FileText className="w-5 h-5 text-slate-700" /></Button>
              <Button variant="outline" className="h-12 w-14"><Link2 className="w-5 h-5 text-slate-700" /></Button>
            </div>
            <p className="text-xs text-slate-500">Attach product cut sheets, field photos, inspection records, or external links.</p>
          </section>

          <Separator />

          <section id="name" className="space-y-4">
            <h3 className="text-2xl text-slate-950">Name</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="ID"><PanelInput value={form.label || ''} onChange={event => handleChange('label', event.target.value)} /></Field>
              <Field label="Element Name"><PanelInput value={form.element_name || typeLabel} onChange={event => handleChange('element_name', event.target.value)} /></Field>
              <Field label="Descriptive Label" required><PanelInput value={form.descriptive_label || ''} onChange={event => handleChange('descriptive_label', event.target.value)} /></Field>
              <Field label="Room # / Location"><PanelInput value={form.room_location || ''} onChange={event => handleChange('room_location', event.target.value)} /></Field>
              <Field label="Address"><PanelInput value={form.address || ''} onChange={event => handleChange('address', event.target.value)} /></Field>
              <Field label="Zone"><PanelInput value={form.zone || ''} onChange={event => handleChange('zone', event.target.value)} /></Field>
            </div>
          </section>

          <Separator />

          <section id="installation" className="space-y-4">
            <h3 className="text-2xl text-slate-950">Installation</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Responsible Party"><PanelInput value={form.responsible_party || ''} onChange={event => handleChange('responsible_party', event.target.value)} /></Field>
              <Field label="Node Location Type">
                <PanelSelect value={form.node_location_type || ''} onValueChange={value => handleChange('node_location_type', value)} placeholder="Select">
                  <SelectItem value="ceiling">Ceiling</SelectItem>
                  <SelectItem value="wall">Wall</SelectItem>
                  <SelectItem value="cabinet">Cabinet</SelectItem>
                  <SelectItem value="riser">Riser Room</SelectItem>
                </PanelSelect>
              </Field>
              <Field label="Mounting Location"><PanelInput value={form.mounting_height || ''} onChange={event => handleChange('mounting_height', event.target.value)} /></Field>
              <Field label="Installation Date"><PanelInput type="date" value={form.installation_date || ''} onChange={event => handleChange('installation_date', event.target.value)} /></Field>
              <Field label="Available Rack/Cabinet Space (inches)">
                <PanelInput type="number" step="0.25" value={form.available_rack_space ?? 0} onChange={event => handleChange('available_rack_space', Number(event.target.value))} />
              </Field>
              <Field label="Available Electrical Service">
                <PanelSelect value={form.available_electrical_service || ''} onValueChange={value => handleChange('available_electrical_service', value)} placeholder="Select">
                  <SelectItem value="120v-20a">120 VAC / 20 A</SelectItem>
                  <SelectItem value="24vdc">24 VDC</SelectItem>
                  <SelectItem value="not-required">Not Required</SelectItem>
                </PanelSelect>
              </Field>
              <Field label="Installation Considerations"><PanelInput value={form.installation_considerations || ''} onChange={event => handleChange('installation_considerations', event.target.value)} /></Field>
              <Field label="Fire Sprinkler in area">
                <PanelSelect value={form.fire_sprinkler_area || ''} onValueChange={value => handleChange('fire_sprinkler_area', value)} placeholder="Select">
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </PanelSelect>
              </Field>
            </div>
          </section>

          <Separator />

          <section id="maintenance" className="space-y-4">
            <h3 className="text-2xl text-slate-950">Maintenance</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Installed by"><PanelInput value={form.installed_by || ''} onChange={event => handleChange('installed_by', event.target.value)} /></Field>
              <Field label="Maintenance Frequency"><PanelInput value={form.maintenance_frequency || ''} onChange={event => handleChange('maintenance_frequency', event.target.value)} placeholder="Annual / Semi-annual" /></Field>
              <Field label="Last Inspection Date"><PanelInput type="date" value={form.last_inspection_date || ''} onChange={event => handleChange('last_inspection_date', event.target.value)} /></Field>
              <Field label="Last Inspection Performed by"><PanelInput value={form.last_inspection_by || ''} onChange={event => handleChange('last_inspection_by', event.target.value)} /></Field>
              <Field label="Next Inspection Date"><PanelInput type="date" value={form.next_inspection_date || ''} onChange={event => handleChange('next_inspection_date', event.target.value)} /></Field>
              <Field label="Warranty Expiration Date"><PanelInput type="date" value={form.warranty_expiration_date || ''} onChange={event => handleChange('warranty_expiration_date', event.target.value)} /></Field>
              <Field label="Projected End of Life Date"><PanelInput type="date" value={form.projected_end_of_life_date || ''} onChange={event => handleChange('projected_end_of_life_date', event.target.value)} /></Field>
            </div>
          </section>

          <Separator />

          <section id="activity" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl text-slate-950">Activity Log</h3>
              <Button variant="ghost" className="text-blue-600 gap-1" onClick={() => handleChange('activity_log', [...activityLog, { date: new Date().toISOString(), note: 'New log entry' }])}>
                <Activity className="w-4 h-4" /> Add Log
              </Button>
            </div>
            {activityLog.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : activityLog.map((entry, index) => (
              <div key={`${entry.date}-${index}`} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">{entry.note}</p>
                <p className="text-xs text-slate-500">{entry.date}</p>
              </div>
            ))}
          </section>

          <Separator />

          <section id="accessories" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl text-slate-950">Accessories</h3>
              <Button variant="ghost" className="text-blue-600 gap-1" onClick={() => handleChange('accessories', [...accessories, { name: 'Accessory', quantity: 1 }])}>
                <PackagePlus className="w-4 h-4" /> Add Accessory
              </Button>
            </div>
            {accessories.length === 0 ? <p className="text-sm text-slate-500">No accessories attached.</p> : accessories.map((accessory, index) => (
              <div key={`${accessory.name}-${index}`} className="grid grid-cols-[1fr_80px] gap-2">
                <PanelInput value={accessory.name} onChange={event => {
                  const next = [...accessories];
                  next[index] = { ...next[index], name: event.target.value };
                  handleChange('accessories', next);
                }} />
                <PanelInput type="number" value={accessory.quantity} onChange={event => {
                  const next = [...accessories];
                  next[index] = { ...next[index], quantity: Number(event.target.value) };
                  handleChange('accessories', next);
                }} />
              </div>
            ))}
          </section>

          <Separator />

          <section id="notes" className="space-y-4 pb-8">
            <h3 className="text-2xl text-slate-950">Notes</h3>
            <Textarea
              value={form.notes || ''}
              onChange={event => handleChange('notes', event.target.value)}
              className="min-h-36 bg-white border-slate-300"
              placeholder="Notes"
            />
          </section>
        </div>
      </div>

      <div className="h-14 border-t border-slate-200 flex items-center justify-between px-5 shrink-0 bg-white">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> X {Math.round(form.x || 0)}, Y {Math.round(form.y || 0)}</span>
          <span className="inline-flex items-center gap-1"><Radio className="w-3.5 h-3.5" /> {form.circuit || 'No circuit'}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {form.installation_status || 'Proposed'}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDelete(device.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2">
          <Trash2 className="w-4 h-4" /> Delete Element
        </Button>
      </div>
    </div>
  );
}
