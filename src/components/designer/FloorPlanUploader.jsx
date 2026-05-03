import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getPdfPageCount } from "@/lib/documentEngine";

const UPLOAD_STEPS = {
  idle: { label: "", ceiling: 0 },
  uploading: { label: "Uploading file...", ceiling: 65 },
  processing: { label: "Reading PDF sheet list...", ceiling: 92 },
  saving: { label: "Saving sheet set...", ceiling: 98 },
};

export default function FloorPlanUploader({ floorNumber, currentUrl, onUploaded, onAnalyze, analyzing }) {
  const fileRef = useRef();
  const [uploadState, setUploadState] = useState("idle");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploading = uploadState !== "idle";
  const uploadStatus = UPLOAD_STEPS[uploadState] || UPLOAD_STEPS.idle;

  useEffect(() => {
    if (!uploading) return undefined;
    const timer = window.setInterval(() => {
      setUploadProgress((current) => {
        const ceiling = uploadStatus.ceiling || 98;
        if (current >= ceiling) return current;
        return Math.min(ceiling, current + Math.max(0.5, (ceiling - current) * 0.08));
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [uploadStatus.ceiling, uploading]);

  const resetInput = () => {
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file) => {
    if (!file || uploading) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    setUploadFileName(file.name);
    setUploadProgress(2);
    setUploadState("uploading");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploadProgress(66);
      if (isPdf) {
        setUploadState("processing");
        const localUrl = URL.createObjectURL(file);
        let pageCount;
        try {
          pageCount = await getPdfPageCount(localUrl);
          setUploadProgress(90);
        } finally {
          URL.revokeObjectURL(localUrl);
        }
        const pages = Array.from({ length: pageCount }, (_, index) => ({
          page: index + 1,
          text: '',
        }));
        setUploadState("saving");
        setUploadProgress(96);
        await Promise.resolve(onUploaded({
          fileUrl: file_url,
          fileType: file.type || "application/pdf",
          fileName: file.name,
          pageCount,
          pages,
          localPdfUrl: localUrl,
        }));
        setUploadProgress(100);
        toast.success(`Imported ${pageCount} PDF sheet${pageCount === 1 ? "" : "s"} for assignment`);
      } else {
        setUploadState("saving");
        setUploadProgress(94);
        await Promise.resolve(onUploaded({
          fileUrl: file_url,
          fileType: file.type || "image/*",
          fileName: file.name,
          pageCount: 1,
        }));
        setUploadProgress(100);
        toast.success(`Floor ${floorNumber} plan uploaded`);
      }
    } catch (error) {
      toast.error(`Plan upload failed: ${error?.message || "Unknown error"}`);
    } finally {
      setUploadState("idle");
      setUploadFileName("");
      setUploadProgress(0);
      resetInput();
    }
  };

  const accept = "application/pdf,image/*";
  const input = (
    <input
      ref={fileRef}
      type="file"
      accept={accept}
      className="hidden"
      disabled={uploading}
      onChange={event => event.target.files[0] && handleFile(event.target.files[0])}
    />
  );

  if (currentUrl) {
    return (
      <div className="absolute top-4 right-14 z-10 flex flex-col gap-2 items-end">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs shadow-sm bg-white"
            onClick={() => fileRef.current.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {uploading ? "Uploading..." : "Replace Plan"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs shadow-sm bg-white border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={onAnalyze}
            disabled={analyzing || uploading}
          >
            {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {analyzing ? "Analyzing..." : "AI: Detect Rooms"}
          </Button>
        </div>
        {uploading && <UploadProgressCard fileName={uploadFileName} status={uploadStatus} progress={uploadProgress} />}
        {input}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="text-center">
        <div
          className={`w-64 min-h-48 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all bg-white shadow-sm p-5 ${
            uploading ? "cursor-wait" : "cursor-pointer hover:border-orange-400 hover:bg-orange-50/50"
          }`}
          onClick={() => !uploading && fileRef.current.click()}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            handleFile(event.dataTransfer.files[0]);
          }}
        >
          {uploading ? (
            <UploadProgressCard fileName={uploadFileName} status={uploadStatus} progress={uploadProgress} inline />
          ) : (
            <>
              <div className="flex items-center gap-2 text-slate-400">
                <Upload className="w-8 h-8" />
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Upload Floor Plan</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF, PNG, JPG - drag & drop or click</p>
                <p className="text-[10px] text-slate-400 mt-1">Multi-page PDFs import as sheets for manual floor/type assignment</p>
              </div>
            </>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3 max-w-xs">
          After uploading, use <span className="text-purple-600 font-medium">AI: Detect Rooms</span> to automatically identify rooms and place devices
        </p>
        {input}
      </div>
    </div>
  );
}

function UploadProgressCard({ fileName, status, progress, inline = false }) {
  const displayedProgress = Math.max(1, Math.min(100, Math.round(progress || 0)));
  return (
    <div className={`${inline ? "w-full border-0 shadow-none p-0" : "w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"} text-left`}>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{fileName || "Floor plan"}</p>
          <p className="text-[11px] text-slate-500">{status.label}</p>
        </div>
        <span className="text-[11px] font-mono text-slate-500">{displayedProgress}%</span>
      </div>
      <Progress value={displayedProgress} className="mt-2 h-1.5" />
    </div>
  );
}
