import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DISCIPLINES, DISCIPLINE_IDS } from '@/lib/disciplines';
import { getProjectPrimaryDiscipline, normalizeDisciplineParam, SYSTEMS_LAST_PROJECT_KEY } from '@/lib/projectDiscipline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { determineSystemRequirements } from '@/lib/codeEngine';
import { CODE_SAFETY_DISCLAIMER } from '@/lib/productInfo';
import { Flame, ArrowLeft, Upload, ChevronRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const OCCUPANCY_GROUPS = ['A', 'B', 'E', 'F', 'H', 'I-1', 'I-2', 'I-3', 'I-4', 'M', 'R-1', 'R-2', 'R-3', 'R-4', 'S', 'High Rise'];
const SPRINKLER_OPTIONS = ['None', 'Partial', 'Full (NFPA 13)', 'Full (NFPA 13R)', 'Full (NFPA 13D)'];
const CEILING_TYPES = ['smooth_flat', 'sloped', 'beamed', 'open_web_joist'];
const CEILING_TYPE_LABELS = { smooth_flat: 'Smooth Flat', sloped: 'Sloped', beamed: 'Beamed', open_web_joist: 'Open Web Joist' };
const COMM_PATHWAYS = ['POTS', 'IP/GSM', 'Fiber'];

const defaultFloor = (n) => ({ floor: n, load: 0, sqft: 0, image_url: '' });

export default function ProjectSetup() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    address: '',
    primary_discipline: DISCIPLINE_IDS.FIRE_ALARM,
    owner_name: '',
    installer_name: '',
    occupancy_group: '',
    total_occupant_load: '',
    num_floors: 1,
    sprinkler_status: 'None',
    default_ceiling_height: 9,
    default_ceiling_type: 'smooth_flat',
    /** false until designer confirms (new projects); omitted/true on legacy loads — see useEffect */
    ceiling_height_confirmed: false,
    elevator_count: 0,
    air_handling_units: '',
    level_of_exit_discharge_floor: 1,
    ahj_contact: '',
    adopted_code_edition: '2021 IBC / 2022 NFPA 72',
    communication_pathway: 'IP/GSM',
    total_sleeping_units: 0,
    occupant_load_per_floor: [defaultFloor(1)],
    gross_sqft_per_floor: [defaultFloor(1)],
    floor_plans: [{ floor_number: 1, image_url: '' }],
  });

  const [analysisPreview, setAnalysisPreview] = useState(null);
  const [uploading, setUploading] = useState({});

  const { data: existingProjects = [], isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', id],
    queryFn: () => base44.entities.Project.filter({ id }),
    enabled: !isNew,
  });

  const existingProject = existingProjects[0];

  useEffect(() => {
    if (isNew) {
      const d = normalizeDisciplineParam(searchParams.get('discipline'));
      if (d) setForm((f) => ({ ...f, primary_discipline: d }));
    }
  }, [isNew, searchParams]);

  useEffect(() => {
    if (existingProject) {
      setForm({
        ...existingProject,
        primary_discipline: getProjectPrimaryDiscipline(existingProject),
        ceiling_height_confirmed: existingProject.ceiling_height_confirmed ?? true,
      });
      setAnalysisPreview(existingProject.analysis_results || null);
    }
  }, [existingProject]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const normalized = {
        ...data,
        default_ceiling_height:
          data.default_ceiling_height === '' || data.default_ceiling_height == null
            ? 0
            : Number(data.default_ceiling_height),
      };
      const analysis = determineSystemRequirements(normalized);

      if (isNew) {
        const payload = { ...normalized, analysis_results: analysis };
        return base44.entities.Project.create(payload);
      }

      // For existing projects, only update setup fields — never overwrite
      // devices, rooms, wires, markups, floor_plans, etc. saved by the designer.
      const setupOnlyFields = {
        name: normalized.name,
        address: normalized.address,
        primary_discipline: normalized.primary_discipline,
        owner_name: normalized.owner_name,
        installer_name: normalized.installer_name,
        occupancy_group: normalized.occupancy_group,
        total_occupant_load: normalized.total_occupant_load,
        total_sleeping_units: normalized.total_sleeping_units,
        num_floors: normalized.num_floors,
        sprinkler_status: normalized.sprinkler_status,
        default_ceiling_height: normalized.default_ceiling_height,
        default_ceiling_type: normalized.default_ceiling_type,
        ceiling_height_confirmed: normalized.ceiling_height_confirmed,
        elevator_count: normalized.elevator_count,
        air_handling_units: normalized.air_handling_units,
        level_of_exit_discharge_floor: normalized.level_of_exit_discharge_floor,
        ahj_contact: normalized.ahj_contact,
        adopted_code_edition: normalized.adopted_code_edition,
        communication_pathway: normalized.communication_pathway,
        occupant_load_per_floor: normalized.occupant_load_per_floor,
        gross_sqft_per_floor: normalized.gross_sqft_per_floor,
        analysis_results: analysis,
      };
      return base44.entities.Project.update(id, setupOnlyFields);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      const projectId = result?.id || id;
      const disc = getProjectPrimaryDiscipline({ ...variables, ...result });
      toast({ title: 'Project saved', description: 'Code analysis complete.' });
      try {
        localStorage.setItem(SYSTEMS_LAST_PROJECT_KEY, projectId);
      } catch {
        /* ignore */
      }
      navigate(`/project/${projectId}/designer/${disc}`);
    },
    onError: (error) => {
      toast({
        title: 'Project save failed',
        description: error?.message || 'Please try again before leaving this page.',
        variant: 'destructive',
      });
    },
  });

  const setFloorCount = (n) => {
    const count = Math.max(1, Math.min(50, parseInt(n) || 1));
    const loads = Array.from({ length: count }, (_, i) => form.occupant_load_per_floor[i] || defaultFloor(i + 1));
    const sqfts = Array.from({ length: count }, (_, i) => form.gross_sqft_per_floor[i] || defaultFloor(i + 1));
    const plans = Array.from({ length: count }, (_, i) => form.floor_plans[i] || { floor_number: i + 1, image_url: '' });
    setForm(f => ({ ...f, num_floors: count, occupant_load_per_floor: loads, gross_sqft_per_floor: sqfts, floor_plans: plans }));
  };

  const handleUpload = async (floorIndex, file) => {
    setUploading(u => ({ ...u, [floorIndex]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => {
        const plans = [...f.floor_plans];
        plans[floorIndex] = { ...plans[floorIndex], image_url: file_url };
        return { ...f, floor_plans: plans };
      });
      toast({ title: 'Floor plan uploaded', description: `Floor ${floorIndex + 1} is ready for design.` });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error?.message || 'The floor plan could not be uploaded.',
        variant: 'destructive',
      });
    } finally {
      setUploading(u => ({ ...u, [floorIndex]: false }));
    }
  };

  const runAnalysisPreview = () => {
    const result = determineSystemRequirements(form);
    setAnalysisPreview(result);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const f = form;
  const liveCodeAnalysis = determineSystemRequirements(f);
  const chNum = Number(f.default_ceiling_height);
  const ceilingInvalid = !Number.isFinite(chNum) || chNum <= 0;
  const ceilingNeedsDesigner =
    !!liveCodeAnalysis.fireAlarmRequired &&
    (ceilingInvalid || f.ceiling_height_confirmed === false);

  if (!isNew && isLoadingProject) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-600 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isNew && !existingProject) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Project not found</h1>
          <p className="text-sm text-slate-500 mb-6">This project may have been deleted or you may not have access to it.</p>
          <Button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white">
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-white/10 bg-[#2c456d] sticky top-0 z-10 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button type="button" onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold tracking-tight">{isNew ? 'New project' : 'Edit project'}</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Project Info */}
            <Section title="Project Information">
              <ComplianceNotice />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Project Name" required>
                  <Input value={f.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Oak Creek Office Building" className="bg-white border-slate-200" required />
                </Field>
                <Field label="Address">
                  <Input value={f.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, City, State" className="bg-white border-slate-200" />
                </Field>
                <Field label="Primary discipline" required>
                  <Select
                    value={f.primary_discipline || DISCIPLINE_IDS.FIRE_ALARM}
                    onValueChange={(v) => setForm((p) => ({ ...p, primary_discipline: v }))}
                  >
                    <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(DISCIPLINES).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500 mt-1">Used for the dashboard badge and which designer opens first after save.</p>
                </Field>
                <Field label="Owner Name">
                  <Input value={f.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} className="bg-white border-slate-200" />
                </Field>
                <Field label="Installer Name">
                  <Input value={f.installer_name} onChange={e => setForm(p => ({ ...p, installer_name: e.target.value }))} className="bg-white border-slate-200" />
                </Field>
                <Field label="AHJ Contact">
                  <Input value={f.ahj_contact} onChange={e => setForm(p => ({ ...p, ahj_contact: e.target.value }))} className="bg-white border-slate-200" />
                </Field>
                <Field label="Adopted Code Edition">
                  <Input value={f.adopted_code_edition} onChange={e => setForm(p => ({ ...p, adopted_code_edition: e.target.value }))} className="bg-white border-slate-200" />
                </Field>
              </div>
            </Section>

            {/* Building Data */}
            <Section title="Building Data">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Occupancy Group" required>
                  <Select value={f.occupancy_group} onValueChange={v => setForm(p => ({ ...p, occupancy_group: v }))}>
                    <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {OCCUPANCY_GROUPS.map(g => <SelectItem key={g} value={g}>Group {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Number of Floors" required>
                  <Input type="number" min={1} max={50} value={f.num_floors} onChange={e => setFloorCount(e.target.value)} className="bg-white border-slate-200" />
                </Field>
                <Field label="Level of exit discharge (floor #)">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={f.level_of_exit_discharge_floor ?? 1}
                    onChange={e => setForm(p => ({ ...p, level_of_exit_discharge_floor: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                    className="bg-white border-slate-200"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Used with per-floor OL for IBC §907.2.7 “{'>'}100 above/below discharge” (Group M, B).</p>
                </Field>
                <Field label="Total Occupant Load">
                  <Input type="number" min={0} value={f.total_occupant_load} onChange={e => setForm(p => ({ ...p, total_occupant_load: +e.target.value }))} className="bg-white border-slate-200" />
                </Field>
                <Field label="Total Sleeping Units (if applicable)">
                  <Input type="number" min={0} value={f.total_sleeping_units} onChange={e => setForm(p => ({ ...p, total_sleeping_units: +e.target.value }))} className="bg-white border-slate-200" />
                </Field>
                <Field label="Sprinkler Status" required>
                  <Select value={f.sprinkler_status} onValueChange={v => setForm(p => ({ ...p, sprinkler_status: v }))}>
                    <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SPRINKLER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Elevator Count">
                  <Input type="number" min={0} value={f.elevator_count} onChange={e => setForm(p => ({ ...p, elevator_count: +e.target.value }))} className="bg-white border-slate-200" />
                </Field>
                <Field label="Air handlers (RTU/AHU)">
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 3"
                    value={f.air_handling_units === '' || f.air_handling_units == null ? '' : f.air_handling_units}
                    onChange={e => setForm(p => ({
                      ...p,
                      air_handling_units: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))}
                    className="bg-white border-slate-200"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                    Used for duct smoke detector placeholders on auto-place (IBC Ch.9 system scope + IMC / NFPA 72 coordination). Leave blank to assume one unit (supply + return pair).
                  </p>
                </Field>
                <div
                  className={`col-span-2 rounded-xl border p-4 space-y-3 transition-colors ${
                    ceilingNeedsDesigner
                      ? 'border-red-300 bg-red-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${ceilingNeedsDesigner ? 'text-red-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Ceiling height &amp; type (NFPA 72 spacing)</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        When a fire alarm system applies, enter the real default deck-to-deck or finish ceiling height and confirm below. Plans rarely embed this — it must come from the designer or field verification.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Default Ceiling Height (ft)">
                      <Input
                        type="number"
                        min={7}
                        max={100}
                        value={f.default_ceiling_height === '' || f.default_ceiling_height == null ? '' : f.default_ceiling_height}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            default_ceiling_height: e.target.value === '' ? '' : +e.target.value,
                            ceiling_height_confirmed: true,
                          }))
                        }
                        className={`bg-white border-slate-200 ${ceilingInvalid && liveCodeAnalysis.fireAlarmRequired ? 'ring-2 ring-red-400' : ''}`}
                      />
                    </Field>
                    <Field label="Default Ceiling Type">
                      <Select
                        value={f.default_ceiling_type}
                        onValueChange={(v) => setForm((p) => ({ ...p, default_ceiling_type: v, ceiling_height_confirmed: true }))}
                      >
                        <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CEILING_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {CEILING_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-slate-300"
                      checked={!!f.ceiling_height_confirmed}
                      onChange={(e) => setForm((p) => ({ ...p, ceiling_height_confirmed: e.target.checked }))}
                    />
                    <span>
                      Confirmed — default ceiling height and type match the construction documents (or agreed basis of design).
                    </span>
                  </label>
                </div>
                <Field label="Communication Pathway">
                  <Select value={f.communication_pathway} onValueChange={v => setForm(p => ({ ...p, communication_pathway: v }))}>
                    <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMM_PATHWAYS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            {/* Per-Floor Data */}
            <Section title="Per-Floor Data">
              <div className="space-y-3">
                {Array.from({ length: f.num_floors }).map((_, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3 items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="text-sm font-medium text-slate-600">Floor {i + 1}</div>
                    <Field label="Occupant Load">
                      <Input
                        type="number" min={0}
                        value={f.occupant_load_per_floor[i]?.load || ''}
                        onChange={e => {
                          const arr = [...f.occupant_load_per_floor];
                          arr[i] = { ...arr[i], floor: i + 1, load: +e.target.value };
                          setForm(p => ({ ...p, occupant_load_per_floor: arr }));
                        }}
                        className="bg-white border-slate-200 h-8 text-sm"
                      />
                    </Field>
                    <Field label="Gross Sq Ft">
                      <Input
                        type="number" min={0}
                        value={f.gross_sqft_per_floor[i]?.sqft || ''}
                        onChange={e => {
                          const arr = [...f.gross_sqft_per_floor];
                          arr[i] = { ...arr[i], floor: i + 1, sqft: +e.target.value };
                          setForm(p => ({ ...p, gross_sqft_per_floor: arr }));
                        }}
                        className="bg-white border-slate-200 h-8 text-sm"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </Section>

            {/* Floor Plan Uploads */}
            <Section title="Floor Plan Uploads">
              <p className="text-xs text-slate-500 mb-3">Upload blank floor plans (PNG, JPG) — devices will be overlaid during design</p>
              <div className="space-y-3">
                {Array.from({ length: f.num_floors }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-sm text-slate-600 w-16">Floor {i + 1}</span>
                    {f.floor_plans[i]?.image_url ? (
                      <div className="flex items-center gap-2 flex-1">
                        <img src={f.floor_plans[i].image_url} alt="" className="w-12 h-8 object-cover rounded border border-slate-200" />
                        <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Uploaded</span>
                        <button
                          type="button"
                          onClick={() => {
                            const plans = [...f.floor_plans];
                            plans[i] = { ...plans[i], image_url: '' };
                            setForm(p => ({ ...p, floor_plans: plans }));
                          }}
                          className="ml-auto text-xs text-slate-500 hover:text-red-600"
                        >Remove</button>
                      </div>
                    ) : (
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg hover:border-red-400 hover:bg-white transition-colors">
                          {uploading[i] ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="text-sm text-slate-500">{uploading[i] ? 'Uploading...' : 'Upload floor plan'}</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => e.target.files[0] && handleUpload(i, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={runAnalysisPreview}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Preview Code Analysis
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || !f.name || !f.occupancy_group}
                className="bg-red-600 hover:bg-red-700 text-white gap-2 flex-1"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save & Open Designer'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Right: Analysis Preview */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm sticky top-24">
              <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-red-600" />
                Code Analysis Preview
              </h3>
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Preliminary guidance only. Confirm final requirements with the AHJ and a licensed fire alarm professional.
              </div>
              {analysisPreview ? (
                <div className="space-y-2">
                  <ResultRow label="Fire Alarm Required" value={analysisPreview.fireAlarmRequired} />
                  <ResultRow label="Voice Evacuation" value={analysisPreview.voiceEvacRequired} />
                  <ResultRow label="Sprinkler Required" value={analysisPreview.sprinklerRequired} />
                  <ResultRow label="Smoke Detection" value={analysisPreview.smokeDetectionRequired} />
                  <ResultRow label="CO Detection" value={analysisPreview.coDetectionRequired} />
                  <ResultRow label="Elevator Recall" value={analysisPreview.elevatorRecallRequired} />
                  <ResultRow label="Mini Horns" value={analysisPreview.miniHornsInSleepingRooms} />
                  {analysisPreview.handicappedRoomsRequired > 0 && (
                    <div className="text-xs text-orange-800 mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                      Accessible rooms required: {analysisPreview.handicappedRoomsRequired}
                    </div>
                  )}
                  {analysisPreview.pullStationException && (
                    <div className="text-xs text-sky-800 mt-2 p-2 bg-sky-50 border border-sky-200 rounded">
                      {analysisPreview.pullStationException}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500 font-medium mb-2">Code References:</p>
                    {analysisPreview.codeReferences.map((ref, i) => (
                      <span key={i} className="block text-xs text-slate-600">{ref}</span>
                    ))}
                  </div>
                  {analysisPreview.specialNotes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                      <p className="text-xs text-slate-500 font-medium">Notes:</p>
                      {analysisPreview.specialNotes.map((note, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-600">{note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-6">
                  Fill out the form and click<br />&quot;Preview Code Analysis&quot;
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
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

function ComplianceNotice() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <p>{CODE_SAFETY_DISCLAIMER}</p>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{label}{required && <span className="text-red-600 ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-600">{label}</span>
      {typeof value === 'boolean' ? (
        value
          ? <span className="text-xs font-medium text-emerald-600">Yes</span>
          : <span className="text-xs text-slate-400">No</span>
      ) : (
        <span className="text-xs font-medium text-slate-900">{value}</span>
      )}
    </div>
  );
}