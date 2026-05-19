import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function DeviceImportModal({ isOpen, onClose, onImportComplete }) {
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setUploading(true);
    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Upload file
      const response = await base44.integrations.Core.UploadFile({
        file: base64
      });

      setUploadedFile({
        name: file.name,
        url: response.file_url
      });
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!uploadedFile?.url) return;

    setImporting(true);
    try {
      const response = await base44.functions.invoke('importDevices', {
        file_url: uploadedFile.url
      });

      if (response.data.success) {
        setImportResult({
          success: true,
          count: response.data.count
        });
        toast.success(`Imported ${response.data.count} devices`);
        onImportComplete?.();
      } else {
        setImportResult({
          success: false,
          error: response.data.error
        });
        toast.error(response.data.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        error: error.message
      });
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = `name,ip_address,mac_address,category,location,model,serial_number,firmware,notes
Router-Core,192.168.1.1,00:1A:2B:3C:4D:5E,Network,Bridge,UniFi Dream Machine Pro,ABC123,7.4.156,Main router
Switch-Bridge,192.168.1.2,00:1A:2B:3C:4D:5F,Network,Bridge,UniFi Switch Pro 24,DEF456,7.4.156,Main switch
Camera-Lobby,192.168.1.10,00:1A:2B:3C:4D:60,Camera,Lobby,UniFi AI Bullet,GHI789,4.2.10,Entrance camera
AP-Deck,192.168.1.20,00:1A:2B:3C:4D:61,Network,Deck,UniFi 6 Pro,JKL012,7.4.156,Outdoor AP`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'device_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setUploadedFile(null);
    setImportResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            Import Devices from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import devices into your network topology.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Download template */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-200">Step 1: Get the template</h4>
            <p className="text-xs text-slate-400">
              Download our CSV template with the required columns and example data.
            </p>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="gap-2"
            >
              <Download size={16} />
              Download CSV Template
            </Button>
          </div>

          {/* Step 2: Upload file */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-200">Step 2: Upload your CSV</h4>
            <p className="text-xs text-slate-400">
              Upload your filled CSV file. Supported format: .csv
            </p>
            
            {!uploadedFile ? (
              <label className="block">
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors cursor-pointer">
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Loader2 size={20} className="animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        CSV files only
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-300">{uploadedFile.name}</p>
                  <p className="text-xs text-green-400/70">Ready to import</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                  className="border-green-500/30 text-green-300 hover:bg-green-500/20"
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Step 3: Import */}
          {uploadedFile && !importResult && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-200">Step 3: Import devices</h4>
              <p className="text-xs text-slate-400">
                Click the button below to import all devices from your CSV file.
              </p>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import Devices
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`p-4 rounded-lg border ${
              importResult.success 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-start gap-3">
                {importResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`text-sm font-medium ${
                    importResult.success ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {importResult.success 
                      ? `Successfully imported ${importResult.count} devices` 
                      : 'Import failed'}
                  </h4>
                  {!importResult.success && importResult.error && (
                    <p className="text-xs text-red-400/70 mt-1">{importResult.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}