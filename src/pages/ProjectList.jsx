import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FolderOpen, Trash2, Clock, Building2, AlertTriangle, Flame, BookOpen, ChevronRight, ShieldCheck, Layers } from 'lucide-react';
import { format } from 'date-fns';

const OCCUPANCY_CONFIG = {
  'A':         { bg: 'bg-purple-50',   text: 'text-purple-700',   border: 'border-purple-200',   dot: 'bg-purple-500',   accent: 'bg-purple-500',  label: 'Assembly' },
  'B':         { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200',     dot: 'bg-blue-500',     accent: 'bg-blue-500',    label: 'Business' },
  'E':         { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200',  dot: 'bg-emerald-500',  accent: 'bg-emerald-500', label: 'Educational' },
  'F':         { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',    dot: 'bg-amber-500',    accent: 'bg-amber-500',   label: 'Factory' },
  'H':         { bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-200',      dot: 'bg-red-500',      accent: 'bg-red-500',     label: 'High-Hazard' },
  'I-1':       { bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200',   dot: 'bg-violet-500',   accent: 'bg-violet-500',  label: 'Institutional' },
  'I-2':       { bg: 'bg-pink-50',     text: 'text-pink-700',     border: 'border-pink-200',     dot: 'bg-pink-500',     accent: 'bg-pink-500',    label: 'Healthcare' },
  'I-3':       { bg: 'bg-rose-50',     text: 'text-rose-700',     border: 'border-rose-200',     dot: 'bg-rose-500',     accent: 'bg-rose-500',    label: 'Detention' },
  'I-4':       { bg: 'bg-teal-50',     text: 'text-teal-700',     border: 'border-teal-200',     dot: 'bg-teal-500',     accent: 'bg-teal-500',    label: 'Day Care' },
  'M':         { bg: 'bg-lime-50',     text: 'text-lime-700',     border: 'border-lime-200',     dot: 'bg-lime-600',     accent: 'bg-lime-600',    label: 'Mercantile' },
  'R-1':       { bg: 'bg-cyan-50',     text: 'text-cyan-700',     border: 'border-cyan-200',     dot: 'bg-cyan-500',     accent: 'bg-cyan-500',    label: 'Hotel/Motel' },
  'R-2':       { bg: 'bg-sky-50',      text: 'text-sky-700',      border: 'border-sky-200',      dot: 'bg-sky-500',      accent: 'bg-sky-500',     label: 'Apartments' },
  'R-3':       { bg: 'bg-indigo-50',   text: 'text-indigo-700',   border: 'border-indigo-200',   dot: 'bg-indigo-500',   accent: 'bg-indigo-500',  label: 'Residential' },
  'R-4':       { bg: 'bg-purple-50',   text: 'text-purple-700',   border: 'border-purple-200',   dot: 'bg-purple-500',   accent: 'bg-purple-500',  label: 'Assisted Living' },
  'S':         { bg: 'bg-slate-50',    text: 'text-slate-600',    border: 'border-slate-200',    dot: 'bg-slate-400',    accent: 'bg-slate-400',   label: 'Storage' },
  'High Rise': { bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-200',      dot: 'bg-red-600',      accent: 'bg-red-600',     label: 'High Rise' },
};

const FALLBACK = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400', accent: 'bg-gray-400', label: 'Unknown' };

export default function ProjectList() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const filtered = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase()) ||
    p.occupancy_group?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-md">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Fire Alarm Design Assistant</h1>
              <p className="text-xs text-slate-400 font-medium">NFPA 72 · NFPA 101 · IBC · NEC</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/code-reference')}
              variant="outline"
              className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 gap-2 text-sm font-medium"
            >
              <BookOpen className="w-4 h-4 text-blue-500" /> Code Reference
            </Button>
            <Button
              onClick={() => navigate('/project/new')}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white gap-2 shadow-md font-medium"
            >
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        </div>
      </header>

      {/* Hero bar */}
      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">My Projects</h2>
            <p className="text-orange-100 text-sm mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} · NFPA 72 compliant design workflow</p>
          </div>
          <div className="flex gap-4 text-center">
            <div className="bg-white/20 rounded-xl px-4 py-2">
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-xs text-orange-100">Total</p>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2">
              <p className="text-2xl font-bold">{projects.filter(p => p.status === 'in_progress').length}</p>
              <p className="text-xs text-orange-100">In Progress</p>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2">
              <p className="text-2xl font-bold">{projects.filter(p => p.status === 'completed').length}</p>
              <p className="text-xs text-orange-100">Completed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, address, or occupancy group..."
            className="pl-10 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 shadow-sm h-11 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Building2 className="w-10 h-10 text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Projects Yet</h3>
            <p className="text-slate-400 mb-7 max-w-sm mx-auto">
              Start your first NFPA 72 fire alarm design project to get code analysis, auto-placement, and professional reports.
            </p>
            <Button
              onClick={() => navigate('/project/new')}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white gap-2 shadow-md h-11 px-6"
            >
              <Plus className="w-4 h-4" /> Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(project => {
              const cfg = OCCUPANCY_CONFIG[project.occupancy_group] || FALLBACK;
              const statusColor = project.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500';
              const statusLabel = project.status === 'completed' ? 'Completed' : project.status === 'in_progress' ? 'In Progress' : 'Draft';

              return (
                <div
                  key={project.id}
                  className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-orange-300 transition-all duration-200 cursor-pointer"
                  onClick={() => navigate(`/project/${project.id}/designer`)}
                >
                  {/* Color accent top bar */}
                  <div className={`h-1.5 w-full ${cfg.accent}`} />

                  <div className="p-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          Group {project.occupancy_group}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/project/${project.id}/setup`); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Edit setup"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm('Delete this project?')) deleteMutation.mutate(project.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Project name & address */}
                    <h3 className="font-bold text-slate-900 mb-1 truncate text-base leading-tight">{project.name}</h3>
                    <p className="text-sm text-slate-500 mb-4 truncate flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      {project.address || 'No address set'}
                    </p>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                      <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {project.num_floors} {project.num_floors === 1 ? 'floor' : 'floors'}
                      </span>
                      {project.sprinkler_status && project.sprinkler_status !== 'None' && (
                        <span className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 text-emerald-700">
                          <ShieldCheck className="w-3 h-3" />
                          Sprinklered
                        </span>
                      )}
                      {project.analysis_results?.fireAlarmRequired === false && (
                        <span className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 text-amber-700">
                          <AlertTriangle className="w-3 h-3" />
                          FA may not be req.
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {project.updated_date ? format(new Date(project.updated_date), 'MMM d, yyyy') : 'Never saved'}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-orange-500 group-hover:gap-2 transition-all">
                        Open Designer <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}