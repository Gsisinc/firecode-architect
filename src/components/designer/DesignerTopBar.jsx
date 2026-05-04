import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Download, Flame, CheckCircle2, Loader2, Table, GitBranch, Layout, BookOpen, LayoutDashboard, Files, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadNfpaDesignReportPdf } from '@/lib/nfpaDesignReportPdf';

export default function DesignerTopBar({
  project,
  projectId,
  discipline,
  isSaving,
  onSave,
  activeTab,
  onTabChange,
}) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const accent = discipline?.theme?.primary || '#ea580c';

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await downloadNfpaDesignReportPdf(project);
    } finally {
      setExporting(false);
    }
  };

  const TABS = [
    { id: 'canvas', label: 'Floor Plan', icon: Layout },
    { id: 'plans', label: 'Plans', icon: Files },
    { id: 'documents', label: 'Documents', icon: Files },
    { id: 'simulation', label: 'Simulation', icon: Play },
    { id: 'riser', label: 'Riser Diagram', icon: GitBranch },
    { id: 'calculations', label: 'Calculations', icon: Table },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="h-14 bg-[hsl(222,47%,6%)] border-b border-white/10 flex items-center px-4 gap-3 shrink-0">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white shrink-0"
        title="All systems"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: accent }}
        >
          <Flame className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{project?.name || 'Untitled Project'}</p>
          <p className="text-xs text-white/30 leading-tight">
            {discipline?.label || 'Designer'}
            <span className="text-white/20"> · </span>
            Group {project?.occupancy_group || '—'} · {project?.num_floors || 1} floors
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 ml-4 bg-white/5 rounded-lg p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
              style={activeTab === tab.id ? { backgroundColor: accent } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {isSaving ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving...
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-green-400/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved
          </div>
        )}

        <Button
          onClick={onSave}
          variant="outline"
          size="sm"
          className="border-white/20 text-white/70 hover:bg-white/10 gap-1.5 text-xs"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </Button>

        <Button
          onClick={handleExportPDF}
          disabled={exporting}
          size="sm"
          className="text-white gap-1.5 text-xs border-0"
          style={{ backgroundColor: accent }}
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export PDF
        </Button>

        <Button
          onClick={() => navigate('/code-reference')}
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white text-xs gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> Code Ref
        </Button>
        <Button
          onClick={() => navigate(`/project/${project?.id}/setup`)}
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white text-xs"
        >
          Edit Setup
        </Button>
      </div>
    </div>
  );
}