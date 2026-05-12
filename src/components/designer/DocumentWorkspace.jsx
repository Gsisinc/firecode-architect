import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Bot,
  CheckCircle2,
  FileDown,
  FileText,
  FolderKanban,
  GitBranch,
  History,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Package,
  Play,
  Search,
  Shield,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  buildDocumentSet,
  createBatchJob,
  createCollaborationSession,
  createDocumentRecord,
  extractDocumentText,
  flattenSearchResults,
  grantPermission,
  recordDocumentComment,
  runBatchJob,
  searchDocuments,
  normalizeDocumentWorkspace,
} from '@/lib/documentEngine';
import { exportBillOfMaterialsPdf } from '@/lib/bomPdfExport';
import { exportVoltageDropPdf } from '@/lib/voltageDropPdfExport';
import { downloadNfpaDesignReportPdf } from '@/lib/nfpaDesignReportPdf';
import { exportFloorPlanLayoutPdf } from '@/lib/floorPlanLayoutPdf';
import { runSubmittalPackagePdf, DEFAULT_SUBMITTAL_SECTIONS } from '@/lib/submittalPackagePdf';

const BATCH_TYPES = [
  { value: 'ocr', label: 'Batch OCR', icon: Bot },
  { value: 'search-index', label: 'Build Search Index', icon: Search },
  { value: 'stamp', label: 'Apply Stamp', icon: FileText },
  { value: 'link', label: 'Auto-Link Sheets', icon: Link2 },
  { value: 'archive', label: 'Archive Package', icon: Archive },
];

export default function DocumentWorkspace({
  project,
  workspace,
  onWorkspaceChange,
  onSave,
  devices = [],
  wires = [],
  floorPlans = [],
  analysisResults,
  canvasRef,
  captureRef,
  rooms = [],
  activeFloor = 1,
}) {
  const { documents, documentSets, permissions, collaboration, batchJobs } = useMemo(
    () => normalizeDocumentWorkspace(workspace),
    [workspace]
  );

  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(documents[0]?.id || null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [comment, setComment] = useState('');
  const [batchType, setBatchType] = useState('ocr');
  const [pdfBusy, setPdfBusy] = useState(null);

  useEffect(() => {
    if (!documents.some((d) => d.id === selectedDocId)) {
      setSelectedDocId(documents[0]?.id || null);
    }
  }, [documents, selectedDocId]);

  const selectedDoc = documents.find(doc => doc.id === selectedDocId) || documents[0] || null;
  const searchResults = useMemo(() => flattenSearchResults(searchDocuments(documents, query)), [documents, query]);
  const activeSession = collaboration.sessions?.[0];
  const comments = collaboration.comments || [];
  const audit = collaboration.audit || [];

  const commit = useCallback(
    (patch) => {
      const next = {
        documents: patch.documents ?? documents,
        documentSets: patch.documentSets ?? documentSets,
        permissions: patch.permissions ?? permissions,
        collaboration: patch.collaboration ?? collaboration,
        batchJobs: patch.batchJobs ?? batchJobs,
      };
      onWorkspaceChange?.(next);
      onSave?.(next);
    },
    [documents, documentSets, permissions, collaboration, batchJobs, onWorkspaceChange, onSave]
  );

  const update = (patch) => commit(patch);

  const runPdf = async (key, fn) => {
    setPdfBusy(key);
    try {
      await fn();
    } finally {
      setPdfBusy(null);
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const documentRecord = createDocumentRecord(file, {
        uploadedBy: project?.owner_name || 'Current user',
        discipline: 'Fire Alarm',
        tags: ['source-plan'],
      });
      const withText = await extractDocumentText(documentRecord, file);
      const nextDocuments = [withText, ...documents];
      const nextSets = documentSets.length
        ? documentSets
        : [buildDocumentSet(project?.name || 'Drawing Set', nextDocuments)];
      setSelectedDocId(withText.id);
      update({
        documents: nextDocuments,
        documentSets: nextSets,
        collaboration: {
          ...collaboration,
          audit: [
            { id: `audit_${Date.now()}`, action: 'document_uploaded', actor: 'Current user', targetId: withText.id, at: new Date().toISOString() },
            ...audit,
          ],
        },
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreateSet = () => {
    const nextSet = buildDocumentSet(`${project?.name || 'Project'} Set ${documentSets.length + 1}`, documents);
    update({ documentSets: [nextSet, ...documentSets] });
  };

  const handleStartSession = () => {
    const session = createCollaborationSession({
      name: `${project?.name || 'Project'} Review`,
      documentIds: documents.map((d) => d.id),
    });
    update({
      collaboration: {
        ...collaboration,
        sessions: [session, ...(collaboration.sessions || [])],
        audit: [
          { id: `audit_${Date.now()}`, action: 'session_started', actor: 'Current user', targetId: session.id, at: new Date().toISOString() },
          ...audit,
        ],
      },
    });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    update({
      permissions: grantPermission(permissions, inviteEmail.trim(), 'reviewer', ['view', 'markup', 'comment']),
    });
    setInviteEmail('');
  };

  const handleComment = () => {
    if (!selectedDoc || !comment.trim()) return;
    update({
      collaboration: recordDocumentComment(collaboration, selectedDoc.id, {
        author: 'Current user',
        body: comment.trim(),
        status: 'open',
      }),
    });
    setComment('');
  };

  const handleRunBatch = async () => {
    const job = createBatchJob(batchType, documents.map(doc => doc.id));
    const completed = await runBatchJob(job, documents);
    update({ batchJobs: [completed, ...batchJobs] });
  };

  return (
    <div className="h-full overflow-auto bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Documents &amp; deliverables</h2>
            <p className="text-xs text-white/40">
              Project PDFs below. Upload source sheets for OCR, search, sets, and collaboration in the panels.
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              className="hidden"
              type="file"
              accept="application/pdf,image/*"
              onChange={event => event.target.files?.[0] && handleUpload(event.target.files[0])}
            />
            <span className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600">
              <Upload className="h-4 w-4" />
              {uploading ? 'Indexing...' : 'Upload PDF/Image'}
            </span>
          </label>
        </div>
      </div>

      <div className="border-b border-white/10 bg-gradient-to-r from-slate-900/95 to-orange-950/20 px-6 py-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
          <FileDown className="h-4 w-4 text-orange-400" />
          Project deliverables
        </h3>
        <p className="text-[11px] text-white/45 mb-4 max-w-3xl">
          Each button downloads a separate branded PDF. Submittal matches the toolbar package (AHJ cover optional). For the floor plan, open the Floor Plan tab first so the canvas renders.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          <DeliverableButton
            icon={Package}
            label="Bill of materials"
            sub="Summary, detail & wire"
            busy={pdfBusy === 'bom'}
            onClick={() =>
              runPdf('bom', () =>
                exportBillOfMaterialsPdf({ project, devices, floorPlans, wires })
              )
            }
          />
          <DeliverableButton
            icon={Zap}
            label="Voltage drop (NAC)"
            sub="18 AWG · 24 V default"
            busy={pdfBusy === 'vd'}
            onClick={() =>
              runPdf('vd', () =>
                exportVoltageDropPdf({ project, devices, wires, floorPlans })
              )
            }
          />
          <DeliverableButton
            icon={FileText}
            label="NFPA 72 design report"
            sub="Narrative, code, schedule…"
            busy={pdfBusy === 'nfpa'}
            onClick={() =>
              runPdf('nfpa', () =>
                downloadNfpaDesignReportPdf(project, { devices, analysisResults })
              )
            }
          />
          <DeliverableButton
            icon={LayoutGrid}
            label="Floor plan layout"
            sub="Canvas snapshot"
            busy={pdfBusy === 'plan'}
            onClick={() =>
              runPdf('plan', () =>
                exportFloorPlanLayoutPdf({ project, canvasRef, captureRef, floorPlans, activeFloor })
              )
            }
          />
          <DeliverableButton
            icon={GitBranch}
            label="Full submittal package"
            sub="AHJ cover + all sections"
            busy={pdfBusy === 'sub'}
            onClick={() =>
              runPdf('sub', () =>
                runSubmittalPackagePdf({
                  project,
                  devices,
                  rooms,
                  wires,
                  floorPlans,
                  analysisResults,
                  canvasRef,
                  captureRef,
                  sections: DEFAULT_SUBMITTAL_SECTIONS,
                  ahjCover: true,
                  submittalMeta: project?.submittal_meta || {},
                  activeFloor,
                })
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px] gap-4 p-4">
        <aside className="space-y-4">
          <Panel title="Documents" icon={FileText}>
            <div className="space-y-2">
              {documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedDoc?.id === doc.id ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="mt-1 text-[11px] text-white/40">{doc.pageCount} page{doc.pageCount === 1 ? '' : 's'} · {doc.ocrStatus}</p>
                </button>
              ))}
              {documents.length === 0 && <EmptyState text="Upload a PDF or plan image to create searchable project sheets." />}
            </div>
          </Panel>

          <Panel title="Drawing Sets" icon={FolderKanban}>
            <Button onClick={handleCreateSet} size="sm" variant="outline" className="mb-3 w-full border-white/20 text-white/70 hover:bg-white/10">
              Create Set from Documents
            </Button>
            <div className="space-y-2">
              {documentSets.map(set => (
                <div key={set.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-medium">{set.name}</p>
                  <p className="text-[11px] text-white/40">{set.sheets.length} sheets · rev {set.revision}</p>
                </div>
              ))}
              {documentSets.length === 0 && <EmptyState text="No drawing sets yet." />}
            </div>
          </Panel>
        </aside>

        <main className="space-y-4">
          <Panel title="OCR Search" icon={Search}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search sheet text, OCR content, tags, and markups..."
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/30"
              />
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {searchResults.map(result => (
                <button
                  key={`${result.documentId}-${result.pageNumber}-${result.index}`}
                  onClick={() => setSelectedDocId(result.documentId)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-orange-300">{result.documentName}</span>
                    <span className="text-[10px] text-white/40">Page {result.pageNumber}</span>
                  </div>
                  <p className="text-xs text-white/60">{result.excerpt}</p>
                </button>
              ))}
              {query && searchResults.length === 0 && <EmptyState text="No matching OCR/search results." />}
              {!query && <EmptyState text="Enter a search term to query indexed sheets." />}
            </div>
          </Panel>

          <Panel title="Sheet Preview and Metadata" icon={FileText}>
            {selectedDoc ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{selectedDoc.name}</h3>
                      <p className="text-xs text-white/40">{selectedDoc.mimeType || selectedDoc.kind} · {selectedDoc.pageCount} page{selectedDoc.pageCount === 1 ? '' : 's'}</p>
                    </div>
                    <StatusPill status={selectedDoc.ocrStatus} />
                  </div>
                  <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-white/10 bg-slate-900 text-center">
                    <div>
                      <FileText className="mx-auto mb-3 h-10 w-10 text-white/20" />
                      <p className="text-sm text-white/60">PDF/image rendering layer registered</p>
                      <p className="mt-1 max-w-md text-xs text-white/35">Uploaded files are stored as document records with extracted text, pages, permissions, set membership, comments, and batch history.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Metric label="Searchable pages" value={selectedDoc.pages?.filter(page => page.text).length || 0} />
                  <Metric label="Markups" value={selectedDoc.markups?.length || 0} />
                  <Metric label="Tags" value={selectedDoc.tags?.join(', ') || 'none'} />
                  <Metric label="Revision" value={selectedDoc.revision || 'A'} />
                </div>
              </div>
            ) : (
              <EmptyState text="Select or upload a document to view metadata." />
            )}
          </Panel>

          <Panel title="Batch Processing" icon={Play}>
            <div className="flex flex-wrap gap-2">
              {BATCH_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setBatchType(type.value)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      batchType === type.value ? 'border-orange-500 bg-orange-500/10 text-orange-200' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {type.label}
                  </button>
                );
              })}
              <Button onClick={handleRunBatch} disabled={documents.length === 0} size="sm" className="bg-orange-500 hover:bg-orange-600">
                Run on {documents.length} document{documents.length === 1 ? '' : 's'}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {batchJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium">{job.type}</p>
                    <p className="text-[11px] text-white/40">
                      {(job.document_ids || job.documentIds || []).length} docs · {job.result_summary || job.summary || 'Queued'}
                    </p>
                  </div>
                  <StatusPill status={job.status} />
                </div>
              ))}
              {batchJobs.length === 0 && <EmptyState text="No batch jobs have been run." />}
            </div>
          </Panel>
        </main>

        <aside className="space-y-4">
          <Panel title="Permissions" icon={Shield}>
            <div className="flex gap-2">
              <Input
                value={inviteEmail}
                onChange={event => setInviteEmail(event.target.value)}
                placeholder="reviewer@example.com"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
              <Button onClick={handleInvite} size="sm" className="bg-orange-500 hover:bg-orange-600">Grant</Button>
            </div>
            <div className="mt-3 space-y-2">
              {(permissions.users || []).map(user => (
                <div key={user.email} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                    <Lock className="h-3.5 w-3.5 text-white/30" />
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">{user.role} · {user.capabilities.join(', ')}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Collaboration" icon={Users}>
            <Button onClick={handleStartSession} size="sm" variant="outline" className="mb-3 w-full border-white/20 text-white/70 hover:bg-white/10">
              Start Studio-Style Session
            </Button>
            {activeSession ? (
              <div className="mb-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                <p className="text-sm font-medium text-green-200">{activeSession.name}</p>
                <p className="text-[11px] text-green-200/60">
                  {(activeSession.document_ids || activeSession.documentIds || []).length} docs · {activeSession.status}
                </p>
              </div>
            ) : (
              <EmptyState text="No active review session." />
            )}
            <div className="flex gap-2">
              <Input
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="Add sheet comment..."
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
              <Button onClick={handleComment} size="sm" className="bg-orange-500 hover:bg-orange-600">
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-3 max-h-52 space-y-2 overflow-auto">
              {comments.map(item => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/70">{item.body}</p>
                  <p className="mt-1 text-[10px] text-white/35">
                    {item.author} · {new Date(item.createdAt || item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Audit Trail" icon={History}>
            <div className="max-h-64 space-y-2 overflow-auto">
              {audit.map(item => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/70">{item.action.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-[10px] text-white/35">{item.actor} · {new Date(item.at).toLocaleString()}</p>
                </div>
              ))}
              {audit.length === 0 && <EmptyState text="No audit events yet." />}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function DeliverableButton({ icon: Icon, label, sub, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!busy}
      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:border-orange-500/40 hover:bg-white/[0.07] disabled:opacity-50"
    >
      <div className="mt-0.5 rounded-lg bg-orange-500/15 p-2 text-orange-300">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>
      </div>
    </button>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-400" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs text-white/35">
      <AlertCircle className="mx-auto mb-2 h-4 w-4" />
      {text}
    </div>
  );
}

function StatusPill({ status }) {
  const done = ['ready', 'complete', 'completed', 'indexed'].includes(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${done ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
      {done ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-white/35">{label}</p>
      <p className="mt-1 break-words text-sm text-white/75">{value}</p>
    </div>
  );
}

export function normalizeDocumentState(project) {
  return normalizeDocumentWorkspace(project?.document_workspace || project);
}
