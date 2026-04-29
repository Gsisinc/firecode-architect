import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FolderOpen, Trash2, Clock, Building2, AlertTriangle, Flame, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

const OCCUPANCY_COLORS = {
  'A': 'bg-purple-500/20 text-purple-300',
  'B': 'bg-blue-500/20 text-blue-300',
  'E': 'bg-green-500/20 text-green-300',
  'F': 'bg-yellow-500/20 text-yellow-300',
  'H': 'bg-red-500/20 text-red-300',
  'I-1': 'bg-orange-500/20 text-orange-300',
  'I-2': 'bg-orange-500/20 text-orange-300',
  'I-3': 'bg-red-500/20 text-red-300',
  'I-4': 'bg-orange-500/20 text-orange-300',
  'M': 'bg-teal-500/20 text-teal-300',
  'R-1': 'bg-indigo-500/20 text-indigo-300',
  'R-2': 'bg-indigo-500/20 text-indigo-300',
  'R-3': 'bg-cyan-500/20 text-cyan-300',
  'R-4': 'bg-indigo-500/20 text-indigo-300',
  'S': 'bg-gray-500/20 text-gray-300',
  'High Rise': 'bg-red-600/20 text-red-300',
};

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
    <div className="min-h-screen bg-[hsl(222,47%,8%)] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[hsl(222,47%,6%)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Fire Alarm Design Assistant</h1>
              <p className="text-xs text-white/40">NFPA 72 · NFPA 101 · IBC · NEC</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/code-reference')}
              variant="outline"
              className="border-white/20 text-white/60 hover:bg-white/10 gap-2 text-sm"
            >
              <BookOpen className="w-4 h-4" /> Code Reference
            </Button>
            <Button
              onClick={() => navigate('/project/new')}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects by name, address, or occupancy..."
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white/60 mb-2">No Projects Yet</h3>
            <p className="text-white/30 mb-6 max-w-sm mx-auto">
              Create your first fire alarm design project to get started
            </p>
            <Button
              onClick={() => navigate('/project/new')}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(project => (
              <div
                key={project.id}
                className="group relative bg-white/5 border border-white/10 rounded-xl p-5 hover:border-orange-500/40 hover:bg-white/8 transition-all cursor-pointer"
                onClick={() => navigate(`/project/${project.id}/design`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge className={OCCUPANCY_COLORS[project.occupancy_group] || 'bg-gray-500/20 text-gray-300'}>
                    Group {project.occupancy_group}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/project/${project.id}/setup`);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm('Delete this project?')) deleteMutation.mutate(project.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-white mb-1 truncate">{project.name}</h3>
                <p className="text-sm text-white/40 mb-3 truncate">{project.address || 'No address'}</p>

                <div className="flex items-center gap-3 text-xs text-white/30">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {project.num_floors} {project.num_floors === 1 ? 'floor' : 'floors'}
                  </span>
                  {project.sprinkler_status && project.sprinkler_status !== 'None' && (
                    <span className="text-green-400/60">Sprinklered</span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1 text-xs text-white/20">
                  <Clock className="w-3 h-3" />
                  {project.updated_date ? format(new Date(project.updated_date), 'MMM d, yyyy') : 'Never'}
                </div>

                {project.analysis_results?.fireAlarmRequired === false && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400/60">
                    <AlertTriangle className="w-3 h-3" />
                    Fire alarm may not be required
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}