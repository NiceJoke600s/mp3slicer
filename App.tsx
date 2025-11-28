import React, { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { Upload, FileAudio, Play, Download, Settings, Music, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProcessedFile, Step } from './types';
import { processAudioFile } from './services/audioService';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.UPLOAD);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [prefix, setPrefix] = useState<string>('abc');
  const [processingIndex, setProcessingIndex] = useState<number>(-1);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles: ProcessedFile[] = Array.from(event.target.files)
        .slice(0, 100) // Limit to 100
        .map((f: File, index) => ({
          id: `${Date.now()}-${index}`,
          originalName: f.name,
          newName: '', // Will be set later
          status: 'pending',
          fileObject: f, // Temporary storage to pass to processor
        }));

      setFiles(newFiles);
      setStep(Step.CONFIG);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
        .filter((f: File) => f.type === 'audio/mpeg' || f.name.endsWith('.mp3'))
        .slice(0, 100);

      if (droppedFiles.length > 0) {
        const newFiles: ProcessedFile[] = droppedFiles.map((f: File, index) => ({
          id: `${Date.now()}-${index}`,
          originalName: f.name,
          newName: '',
          status: 'pending',
          fileObject: f,
        }));
        setFiles(newFiles);
        setStep(Step.CONFIG);
      }
    }
  };

  const startProcessing = async () => {
    if (files.length === 0) return;
    setStep(Step.PROCESSING);
    setProcessingIndex(0);
    setCompletedCount(0);

    const processedFilesResult = [...files];
    const padLength = files.length >= 100 ? 3 : (files.length >= 10 ? 2 : 2); // Ensure at least 01

    // Process sequentially to avoid browser crash/lag
    for (let i = 0; i < processedFilesResult.length; i++) {
      setProcessingIndex(i);
      const fileData = processedFilesResult[i];
      const rawFile = fileData.fileObject!;
      
      // Generate new name: abc-001.mp3
      const fileNumber = (i + 1).toString().padStart(padLength, '0');
      const newName = `${prefix}-${fileNumber}.mp3`;
      processedFilesResult[i].newName = newName;

      try {
        // Process
        const result = await processAudioFile(rawFile);
        processedFilesResult[i].blob = result.blob;
        processedFilesResult[i].status = 'completed';
        processedFilesResult[i].duration = result.duration;
        processedFilesResult[i].startTime = result.startTime;
      } catch (error) {
        console.error(error);
        processedFilesResult[i].status = 'error';
        processedFilesResult[i].errorMsg = "Failed to process";
      }

      setCompletedCount(prev => prev + 1);
      setFiles([...processedFilesResult]); // Update UI
      
      // Small delay to let UI breathe
      await new Promise(r => setTimeout(r, 50));
    }

    setProcessingIndex(-1);
    await generateZip(processedFilesResult);
    setStep(Step.FINISHED);
  };

  const generateZip = async (processedFiles: ProcessedFile[]) => {
    const zip = new JSZip();
    let count = 0;
    
    processedFiles.forEach(f => {
      if (f.status === 'completed' && f.blob) {
        zip.file(f.newName, f.blob);
        count++;
      }
    });

    if (count > 0) {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      setZipUrl(url);
    }
  };

  const resetApp = () => {
    setFiles([]);
    setStep(Step.UPLOAD);
    setZipUrl(null);
    setPrefix('abc');
    setCompletedCount(0);
  };

  // --- Renders ---

  const renderUploadStep = () => (
    <div 
      className="border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer group"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        multiple 
        accept=".mp3,audio/mpeg" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileSelect}
      />
      <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
        <Upload className="w-10 h-10 text-indigo-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Drag & Drop MP3 Files</h3>
      <p className="text-slate-400 mb-6">Or click to browse (Max 100 files)</p>
      <div className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
        <FileAudio className="w-4 h-4 mr-2" />
        Select Files
      </div>
    </div>
  );

  const renderConfigStep = () => (
    <div className="max-w-2xl mx-auto bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Settings className="w-6 h-6 mr-3 text-indigo-400" />
          Configuration
        </h2>
        <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm font-medium">
          {files.length} Files Selected
        </span>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Output Filename Prefix
        </label>
        <div className="flex items-center">
          <div className="relative flex-grow">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
              placeholder="e.g. abc"
              className="w-full bg-slate-900 border border-slate-600 rounded-l-lg py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <div className="absolute right-3 top-3 text-slate-500 text-xs">
              Only alphanumeric, -, _
            </div>
          </div>
          <div className="bg-slate-700 border border-l-0 border-slate-600 py-3 px-4 text-slate-300 rounded-r-lg">
            -001.mp3
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-2">
          Example output: <span className="text-indigo-400">{prefix || 'abc'}-001.mp3</span>
        </p>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-4 mb-8">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Operation Details</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
            Extract random 15 seconds from each file
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
            Rename sequentially ({prefix}-XXX.mp3)
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
            Export as a single ZIP archive
          </li>
        </ul>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={resetApp}
          className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={startProcessing}
          className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center shadow-lg shadow-indigo-500/20"
        >
          <Play className="w-5 h-5 mr-2" />
          Start Processing
        </button>
      </div>
    </div>
  );

  const renderProcessingStep = () => {
    const progress = Math.round((completedCount / files.length) * 100);
    const isFinished = step === Step.FINISHED;

    return (
      <div className="max-w-4xl mx-auto">
        {/* Header Status */}
        <div className="bg-slate-800 rounded-2xl p-8 mb-6 border border-slate-700 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {isFinished ? 'Processing Complete!' : 'Processing Audio Files...'}
              </h2>
              <p className="text-slate-400">
                {completedCount} / {files.length} files processed
              </p>
            </div>
            {isFinished ? (
              zipUrl ? (
                <a 
                  href={zipUrl} 
                  download={`${prefix}-batch-cut.zip`}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download ZIP
                </a>
              ) : (
                <div className="text-red-400 font-medium">No files generated.</div>
              )
            ) : (
              <div className="w-12 h-12 relative flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-4 overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-300 ease-out ${isFinished ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 uppercase font-medium tracking-wider">
            <span>0%</span>
            <span>{progress}%</span>
          </div>
          
          {isFinished && (
             <button 
             onClick={resetApp}
             className="mt-6 text-sm text-slate-400 hover:text-white underline decoration-slate-600 hover:decoration-white underline-offset-4"
           >
             Start Over
           </button>
          )}
        </div>

        {/* File List */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden max-h-[500px] overflow-y-auto">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-10 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Original File</div>
            <div className="col-span-4">New Name</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-slate-800">
            {files.map((file, idx) => (
              <div key={file.id} className="grid grid-cols-12 gap-4 p-4 text-sm hover:bg-slate-800/30 transition-colors items-center">
                 <div className="col-span-1 text-slate-500 font-mono">{idx + 1}</div>
                 <div className="col-span-5 text-slate-300 truncate" title={file.originalName}>
                    {file.originalName}
                 </div>
                 <div className="col-span-4 text-indigo-300 font-mono truncate">
                    {file.newName || '-'}
                 </div>
                 <div className="col-span-2 flex justify-end">
                    {file.status === 'pending' && <span className="text-slate-600">Waiting</span>}
                    {file.status === 'processing' && <span className="text-indigo-400 flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Processing</span>}
                    {file.status === 'completed' && <span className="text-emerald-500 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Done</span>}
                    {file.status === 'error' && <span className="text-red-500 flex items-center"><AlertCircle className="w-4 h-4 mr-1"/> Error</span>}
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12">
      <header className="max-w-4xl mx-auto mb-12 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-500/20">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MP3 Batch Slicer</h1>
            <p className="text-slate-500 text-sm">Random 15s Clip Generator</p>
          </div>
        </div>
        
        {step !== Step.UPLOAD && (
           <div className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
             v1.0.0
           </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto">
        {step === Step.UPLOAD && renderUploadStep()}
        {step === Step.CONFIG && renderConfigStep()}
        {(step === Step.PROCESSING || step === Step.FINISHED) && renderProcessingStep()}
      </main>
    </div>
  );
};

export default App;