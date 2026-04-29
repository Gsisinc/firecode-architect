import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, ImagePlus, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function FloorPlanUploader({ floorNumber, currentUrl, onUploaded, onAnalyze, analyzing }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    onUploaded(file_url);
    toast.success(`Floor ${floorNumber} plan uploaded`);
  };

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
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
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
            <Upload className="w-8 h-8 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-700">{uploading ? "Uploading..." : "Upload Floor Plan"}</p>
            <p className="text-xs text-slate-400 mt-0.5">PNG, JPG — drag & drop or click</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 max-w-xs">
          After uploading, use <span className="text-purple-600 font-medium">AI: Detect Rooms</span> to automatically identify rooms and place devices
        </p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}