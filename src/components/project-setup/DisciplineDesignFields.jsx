import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DISCIPLINE_IDS } from '@/lib/disciplines';

function Field({ label, required, children, hint }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="font-semibold text-slate-500 mb-4 text-sm tracking-wide uppercase">{title}</h2>
      {children}
    </div>
  );
}

export default function DisciplineDesignFields({ form, setForm }) {
  const id = form.primary_discipline;

  if (id === DISCIPLINE_IDS.ACCESS_CONTROL) {
    return (
      <Section title="Access control — design basis">
        <p className="text-sm text-slate-600 mb-4">
          Information that supports reader counts, door hardware, and head-end planning — not building fire code triggers.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Estimated door openings" hint="Rough count of controlled openings / readers.">
            <Input
              type="number"
              min={0}
              value={form.access_estimated_doors}
              onChange={(e) => setForm((p) => ({ ...p, access_estimated_doors: e.target.value }))}
              className="bg-white border-slate-200"
            />
          </Field>
          <Field label="Reader / credential focus">
            <Select
              value={form.access_reader_technology || 'card'}
              onValueChange={(v) => setForm((p) => ({ ...p, access_reader_technology: v }))}
            >
              <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card / fob</SelectItem>
                <SelectItem value="mobile">Mobile / BLE</SelectItem>
                <SelectItem value="biometric">Biometric</SelectItem>
                <SelectItem value="pin">PIN / keypad</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Panel / head-end location notes" hint="IDF, telecom, or security room.">
            <Textarea
              value={form.access_head_end_notes}
              onChange={(e) => setForm((p) => ({ ...p, access_head_end_notes: e.target.value }))}
              className="bg-white border-slate-200 min-h-[72px]"
              placeholder="e.g. Main IDF room 101, dual readers at lobby…"
            />
          </Field>
          <Field label="Integration with fire / life safety" hint="Door unlock on FA, stair re-entry, etc.">
            <Textarea
              value={form.access_fire_interface_notes}
              onChange={(e) => setForm((p) => ({ ...p, access_fire_interface_notes: e.target.value }))}
              className="bg-white border-slate-200 min-h-[72px]"
              placeholder="Coordinate with FA release, AHJ requirements…"
            />
          </Field>
          <div className="col-span-2">
            <Field label="UL / listing / standards notes">
              <Textarea
                value={form.access_compliance_notes}
                onChange={(e) => setForm((p) => ({ ...p, access_compliance_notes: e.target.value }))}
                className="bg-white border-slate-200 min-h-[64px]"
                placeholder="UL 294, vestibule rules, path of egress…"
              />
            </Field>
          </div>
        </div>
      </Section>
    );
  }

  if (id === DISCIPLINE_IDS.VIDEO_SURVEILLANCE) {
    return (
      <Section title="Video surveillance — design basis">
        <p className="text-sm text-slate-600 mb-4">
          VMS, retention, and image targets drive switch sizing, storage, and camera density — separate from IBC fire alarm rules.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="VMS / recording platform">
            <Input
              value={form.video_vms_platform}
              onChange={(e) => setForm((p) => ({ ...p, video_vms_platform: e.target.value }))}
              className="bg-white border-slate-200"
              placeholder="e.g. Genetec, Milestone, Avigilon"
            />
          </Field>
          <Field label="Retention target (days)">
            <Input
              type="number"
              min={0}
              value={form.video_retention_days}
              onChange={(e) => setForm((p) => ({ ...p, video_retention_days: e.target.value }))}
              className="bg-white border-slate-200"
            />
          </Field>
          <Field label="Resolution / bitrate target">
            <Input
              value={form.video_resolution_target}
              onChange={(e) => setForm((p) => ({ ...p, video_resolution_target: e.target.value }))}
              className="bg-white border-slate-200"
              placeholder="e.g. 4 MP @ 15 fps, 6 Mbps"
            />
          </Field>
          <Field label="PoE / switching notes" hint="VLANs, PoE budget, uplinks.">
            <Textarea
              value={form.video_poe_notes}
              onChange={(e) => setForm((p) => ({ ...p, video_poe_notes: e.target.value }))}
              className="bg-white border-slate-200 min-h-[64px]"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Coverage goals (interior / perimeter / parking)">
              <Textarea
                value={form.video_coverage_notes}
                onChange={(e) => setForm((p) => ({ ...p, video_coverage_notes: e.target.value }))}
                className="bg-white border-slate-200 min-h-[72px]"
                placeholder="Key views, PPF targets, privacy zones…"
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Lighting / cyber / privacy notes">
              <Textarea
                value={form.video_lighting_cyber_notes}
                onChange={(e) => setForm((p) => ({ ...p, video_lighting_cyber_notes: e.target.value }))}
                className="bg-white border-slate-200 min-h-[64px]"
                placeholder="Lux expectations, hardening, NDAA / IT policy…"
              />
            </Field>
          </div>
        </div>
      </Section>
    );
  }

  if (id === DISCIPLINE_IDS.AUDIO_VISUAL) {
    return (
      <Section title="Audio visual — design basis">
        <p className="text-sm text-slate-600 mb-4">
          Space types and signal paths inform display scale, DSP, and cable plant — not NFPA smoke spacing.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Primary space types / rooms">
              <Textarea
                value={form.av_primary_spaces}
                onChange={(e) => setForm((p) => ({ ...p, av_primary_spaces: e.target.value }))}
                className="bg-white border-slate-200 min-h-[72px]"
                placeholder="e.g. Boardroom, divisible training, digital signage wall…"
              />
            </Field>
          </div>
          <Field label="Display standard">
            <Select
              value={form.av_display_standard || '4K'}
              onValueChange={(v) => setForm((p) => ({ ...p, av_display_standard: v }))}
            >
              <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="4K">4K / UHD</SelectItem>
                <SelectItem value="8K">8K (future)</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Control / DSP environment">
            <Input
              value={form.av_control_platform}
              onChange={(e) => setForm((p) => ({ ...p, av_control_platform: e.target.value }))}
              className="bg-white border-slate-200"
              placeholder="e.g. Crestron, Q-SYS, Extron"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Audio / video scope notes">
              <Textarea
                value={form.av_audio_video_notes}
                onChange={(e) => setForm((p) => ({ ...p, av_audio_video_notes: e.target.value }))}
                className="bg-white border-slate-200 min-h-[80px]"
                placeholder="PTZ vs fixed, BYOD, recording, assistive listening…"
              />
            </Field>
          </div>
        </div>
      </Section>
    );
  }

  if (id === DISCIPLINE_IDS.LOW_VOLTAGE) {
    return (
      <Section title="Structured cabling — design basis">
        <p className="text-sm text-slate-600 mb-4">
          MDF/IDF and media class set backbone design — aligned with TIA / BICSI practice instead of NFPA device spacing.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="MDF location / room">
            <Input
              value={form.lv_mdf_location}
              onChange={(e) => setForm((p) => ({ ...p, lv_mdf_location: e.target.value }))}
              className="bg-white border-slate-200"
              placeholder="e.g. Basement TR, Suite 100"
            />
          </Field>
          <Field label="IDF count (estimate)">
            <Input
              type="number"
              min={0}
              value={form.lv_idf_quantity}
              onChange={(e) => setForm((p) => ({ ...p, lv_idf_quantity: e.target.value }))}
              className="bg-white border-slate-200"
            />
          </Field>
          <Field label="Cable / media class">
            <Select
              value={form.lv_cable_media || 'Cat6A'}
              onValueChange={(v) => setForm((p) => ({ ...p, lv_cable_media: v }))}
            >
              <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cat6">Cat6</SelectItem>
                <SelectItem value="Cat6A">Cat6A</SelectItem>
                <SelectItem value="Cat8">Cat8</SelectItem>
                <SelectItem value="Fiber OM4">Fiber OM4</SelectItem>
                <SelectItem value="Mixed">Mixed copper / fiber</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pathway type">
            <Select
              value={form.lv_pathway_type || 'J-hook / basket'}
              onValueChange={(v) => setForm((p) => ({ ...p, lv_pathway_type: v }))}
            >
              <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Conduit">Conduit</SelectItem>
                <SelectItem value="J-hook / basket">J-hook / basket tray</SelectItem>
                <SelectItem value="Cable tray">Cable tray</SelectItem>
                <SelectItem value="Underfloor">Underfloor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="col-span-2">
            <Field label="Testing / certification target">
              <Input
                value={form.lv_testing_standard}
                onChange={(e) => setForm((p) => ({ ...p, lv_testing_standard: e.target.value }))}
                className="bg-white border-slate-200"
                placeholder="e.g. TIA-568.2, ISO/IEC 11801 Class EA"
              />
            </Field>
          </div>
        </div>
      </Section>
    );
  }

  return null;
}
