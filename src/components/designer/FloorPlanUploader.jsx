import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { extractPdfMetadataAndText } from "@/lib/documentEngine";

export default function FloorPlanUploader({ floorNumber, currentUrl, onUploaded, onAnalyze, analyzing }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (isPdf) {
        const localUrl = URL.createObjectURL(file);
        const metadata = await extractPdfMetadataAndText(localUrl);
        URL.revokeObjectURL(localUrl);
        onUploaded({
          fileUrl: file_url,
          fileType: file.type || "application/pdf",
          fileName: file.name,
          pageCount: metadata.pageCount,
          pages: metadata.pages,
        });
        toast.success(`Imported ${metadata.pageCount} PDF page${metadata.pageCount === 1 ? "" : "s"} as floor plan sheet${metadata.pageCount === 1 ? "" : "s"}`);
      } else {
        onUploaded({
          fileUrl: file_url,
          fileType: file.type || "image/*",
          fileName: file.name,
          pageCount: 1,
        });
        toast.success(`Floor ${floorNumber} plan uploaded`);
      }
    } catch (error) {
      toast.error(`Plan upload failed: ${error?.message || "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  };

  const accept = "application/pdf,image/*";

  if (currentUrl) {
    return (
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs shadow-sm bg-white"
            onClick={() => fileRef.current.click()}
          >
            <ImagePlus className="h-3 w-3" /> Replace Plan
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs shadow-sm bg-white border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={onAnalyze}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {analyzing ? "Analyzing..." : "AI: Detect Rooms"}
          </Button>
        </div>
        <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="text-center">
        <div
          className="w-64 h-48 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all bg-white shadow-sm"
          onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Upload className="w-8 h-8" />
              <FileText className="w-8 h-8" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-700">{uploading ? "Uploading..." : "Upload Floor Plan"}</p>
            <p className="text-xs text-slate-400 mt-0.5">PDF, PNG, JPG — drag & drop or click</p>
            <p className="text-[10px] text-slate-400 mt-1">Multi-page PDFs map pages to consecutive floors starting at floor {floorNumber}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 max-w-xs">
          After uploading, use <span className="text-purple-600 font-medium">AI: Detect Rooms</span> to automatically identify rooms and place devices
        </p>
        <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}