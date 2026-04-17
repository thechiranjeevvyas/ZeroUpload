import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, X, GripVertical, Settings2, Link } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';

// Setup pdfjs worker for reading page counts
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const parsePageRanges = (str, maxPages) => {
    if (!str || str.trim() === '') return Array.from({ length: maxPages }, (_, idx) => idx);
    const indices = []; // Set of indices (0-based)
    const ranges = str.split(',').map(s => s.trim());
    for (const range of ranges) {
        if (range.includes('-')) {
            const parts = range.split('-');
            const start = parseInt(parts[0], 10);
            const end = parseInt(parts[1], 10);
            if (!isNaN(start) && !isNaN(end)) {
                for(let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                    if (i > 0 && i <= maxPages) indices.push(i - 1);
                }
            }
        } else {
            const num = parseInt(range, 10);
            if (!isNaN(num) && num > 0 && num <= maxPages) {
                indices.push(num - 1);
            }
        }
    }
    // Remove duplicates and sort
    return [...new Set(indices)].sort((a, b) => a - b);
};

const MergePdfs = () => {
    const [pdfs, setPdfs] = useState([]); // { id, file, numPages, size, filename, pagesRange: '', expanded: false }
    const [isDragOver, setIsDragOver] = useState(false);
    
    // Merge settings
    const [outputName, setOutputName] = useState('merged.pdf');
    const [globalReverse, setGlobalReverse] = useState(false);
    
    // Progress
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');

    // Drag and Drop ordering refs
    const dragItem = useRef();
    const dragOverItem = useRef();

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        await processNewFiles(files);
        e.target.value = null; // reset
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        
        if (droppedFiles.length === 0) {
            toast.error('Only PDF files are supported.');
            return;
        }
        await processNewFiles(droppedFiles);
    };

    const processNewFiles = async (newFiles) => {
        const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
        if (pdfFiles.length < newFiles.length) {
            toast.error('Only PDF files are added. Others were ignored.');
        }
        if (pdfFiles.length === 0) return;

        toast.loading('Analyzing PDFs...', { id: 'analyze' });
        
        const newItems = [];
        for (const file of pdfFiles) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const numPages = pdfDoc.numPages;
                
                newItems.push({
                    id: Math.random().toString(36).substr(2, 9),
                    file,
                    numPages,
                    size: file.size,
                    filename: file.name,
                    pagesRange: '',
                    expanded: false
                });
            } catch (err) {
                console.error("Error reading PDF:", err);
                toast.error(`Failed to analyze ${file.name}`);
            }
        }
        
        setPdfs(prev => [...prev, ...newItems]);
        toast.dismiss('analyze');
        
        if (newItems.length > 0) {
             toast.success(`${newItems.length} PDF(s) added.`);
        }
    };

    const removePdf = (id) => {
        setPdfs(prev => prev.filter(p => p.id !== id));
    };

    const toggleExpand = (id) => {
        setPdfs(prev => prev.map(p => p.id === id ? { ...p, expanded: !p.expanded } : p));
    };

    const updatePagesRange = (id, val) => {
        setPdfs(prev => prev.map(p => p.id === id ? { ...p, pagesRange: val } : p));
    };

    // Drag and Drop (reorder array) functions
    const dragStart = (e, position) => {
        dragItem.current = position;
        // set opacity or styles if needed
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.parentNode);
        setTimeout(() => {
            if (e.target && e.target.style) {
                 e.target.style.opacity = '0.5';
            }
        }, 0);
    };

    const dragEnter = (e, position) => {
        dragOverItem.current = position;
    };
    
    const dragEnd = (e) => {
        if (e.target && e.target.style) e.target.style.opacity = '1';
        if (dragItem.current === null || dragOverItem.current === null) return;
        
        const copyListItems = [...pdfs];
        const dragItemContent = copyListItems[dragItem.current];
        copyListItems.splice(dragItem.current, 1);
        copyListItems.splice(dragOverItem.current, 0, dragItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        setPdfs(copyListItems);
    };

    const doMerge = async () => {
        if (pdfs.length < 2) return;
        
        setIsProcessing(true);
        setProgress(0);
        setProgressLabel('Initializing merge engine...');
        
        try {
            const mergedPdf = await PDFDocument.create();

            for (let i = 0; i < pdfs.length; i++) {
                setProgressLabel(`Reading PDF ${i + 1} of ${pdfs.length}...`);
                setProgress(Math.round(((i) / pdfs.length) * 50));
                
                const pdfObj = pdfs[i];
                const arrayBuffer = await pdfObj.file.arrayBuffer();
                const sourcePdf = await PDFDocument.load(arrayBuffer);
                
                // Parse page range
                let pageIndices = parsePageRanges(pdfObj.pagesRange, pdfObj.numPages);
                
                if (globalReverse) {
                    pageIndices.reverse();
                }
                
                if (pageIndices.length > 0) {
                    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
                    copiedPages.forEach((page) => {
                        mergedPdf.addPage(page);
                    });
                }
            }
            
            setProgress(80);
            setProgressLabel('Merging pages and generating output...');
            
            const mergedPdfBytes = await mergedPdf.save();
            
            setProgress(100);
            setProgressLabel(`✓ Done! Downloading ${outputName}...`);
            
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            
            // Final check output name
            let finalOutputName = outputName.trim();
            if (!finalOutputName) finalOutputName = 'merged.pdf';
            if (!finalOutputName.toLowerCase().endsWith('.pdf')) {
                finalOutputName += '.pdf';
            }

            saveAs(blob, finalOutputName);
            toast.success(`✓ ${finalOutputName} saved successfully`);
        } catch (error) {
            console.error("Merge error:", error);
            toast.error('An error occurred during merge.');
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProgressLabel('');
                setProgress(0);
            }, 3000);
        }
    };

    // Calculate Summary Stats
    const totalSelectedPages = pdfs.reduce((acc, p) => {
        const selected = parsePageRanges(p.pagesRange, p.numPages).length;
        return acc + selected;
    }, 0);
    
    const estimatedSizeBytes = pdfs.reduce((acc, p) => {
        const selected = parsePageRanges(p.pagesRange, p.numPages).length;
        return acc + (p.size * (selected / p.numPages));
    }, 0);
    
    const estimatedSizeMb = (estimatedSizeBytes / 1024 / 1024).toFixed(2);


    return (
        <div className="h-full flex flex-col pt-16 md:pt-0">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-[#1a1a1a] flex-shrink-0">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-[#e8e8e8] mb-2 flex items-center gap-2">
                        <Link className="text-[#00ff88]" />
                        Merge PDFs
                    </h1>
                    <p className="text-[#666666] text-sm flex items-center gap-2">
                        Combine multiple PDF files into one. Fast, secure, and 100% locally in your browser.
                    </p>
                    <div className="mt-2 text-xs font-mono text-[#00ff88] bg-[#00ff88]/10 w-max px-2 py-1 rounded">
                        📥 Input: Multiple PDF files (2 or more) → 📤 Output: Single merged PDF file
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6 pb-24">
                    
                    {/* Top Upload Zone */}
                    <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors relative group bg-[#0a0a0a]
                                  ${isDragOver ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-[#1a1a1a] hover:border-[#00ff88]/50'}`}
                    >
                        <input
                            type="file"
                            accept="application/pdf"
                            multiple
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-[#111111] border border-[#2a2a2a] flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload size={24} className="text-[#00ff88]" />
                            </div>
                            <div>
                                <p className="text-[#e8e8e8] font-medium mb-1">
                                    Drop {pdfs.length > 0 ? 'more' : ''} PDF files here
                                </p>
                                <p className="text-[#666666] text-sm">
                                    or click to select from your computer
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* PDF List UI */}
                    {pdfs.length > 0 && (
                        <div className="space-y-4">
                            {pdfs.length === 1 && (
                                <div className="text-amber-400 bg-amber-400/10 px-4 py-2 rounded text-sm text-center font-medium border border-amber-400/20">
                                    ⚠ Add at least one more PDF to merge
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <h3 className="text-[#e8e8e8] font-medium">Uploaded Files</h3>
                                <span className="text-[#666666] text-xs">↕ Drag to reorder — top to bottom = first to last</span>
                            </div>

                            <div className="space-y-2">
                                {pdfs.map((pdf, index) => (
                                    <div 
                                        key={pdf.id}
                                        draggable
                                        onDragStart={(e) => dragStart(e, index)}
                                        onDragEnter={(e) => dragEnter(e, index)}
                                        onDragEnd={dragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="bg-[#111111] border border-[#1a1a1a] rounded-lg transition-all"
                                    >
                                        <div className="p-3 flex items-center gap-3">
                                            {/* Drag Handle */}
                                            <div className="text-[#444] cursor-grab hover:text-[#e8e8e8] transition-colors p-1">
                                                <GripVertical size={18} />
                                            </div>
                                            
                                            {/* Icon */}
                                            <div className="w-10 h-10 rounded bg-[#1a1a1a] flex items-center justify-center text-[#ff3366] flex-shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-[#e8e8e8] text-sm font-mono truncate max-w-[200px] md:max-w-[400px]" title={pdf.filename}>
                                                        {pdf.filename}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded font-medium">
                                                        {pdf.numPages} {pdf.numPages === 1 ? 'page' : 'pages'}
                                                    </span>
                                                    <span className="text-[#666] text-xs">
                                                        {(pdf.size / 1024 / 1024).toFixed(2)} MB
                                                    </span>
                                                    
                                                    <button 
                                                        onClick={() => toggleExpand(pdf.id)}
                                                        className="text-[#00ff88] hover:text-[#00cc6a] text-xs font-medium ml-auto transition-colors focus:outline-none"
                                                    >
                                                        {pdf.expanded ? 'Hide Settings' : 'Select Pages'}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Remove Button */}
                                            <button 
                                                onClick={() => removePdf(pdf.id)}
                                                className="w-8 h-8 flex items-center justify-center text-[#666] hover:text-[#ff3366] hover:bg-[#ff3366]/10 rounded transition-colors flex-shrink-0"
                                                title="Remove file"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Expanded Page Settings */}
                                        {pdf.expanded && (
                                            <div className="px-4 py-3 bg-[#0a0a0a] border-t border-[#1a1a1a] rounded-b-lg">
                                                <label className="block text-xs font-medium text-[#888] mb-1">
                                                    Pages to Include
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={pdf.pagesRange}
                                                    onChange={(e) => updatePagesRange(pdf.id, e.target.value)}
                                                    placeholder="e.g. 1-3, 5, 7-9"
                                                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm font-mono text-[#e8e8e8] focus:border-[#00ff88] focus:outline-none transition-colors"
                                                />
                                                <p className="text-[10px] text-[#666] mt-1">Leave empty to include all pages</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions Panel (Sticky) */}
            {pdfs.length > 0 && (
                <div className="bg-[#111111] border-t border-[#1a1a1a] p-4 md:p-6 z-20 flex-shrink-0">
                    <div className="max-w-4xl mx-auto">
                        
                        {/* Summary Stats */}
                        <div className="flex items-center justify-between text-xs text-[#888] font-mono mb-4 px-2">
                            <span>{pdfs.length} PDFs</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{totalSelectedPages} total pages</span>
                            <span className="hidden sm:inline">•</span>
                            <span>~{estimatedSizeMb} MB estimated output</span>
                        </div>

                        {/* Settings Row */}
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-[#888] block mb-1 uppercase tracking-wider">Output Filename</label>
                                <input 
                                    type="text"
                                    value={outputName}
                                    onChange={(e) => setOutputName(e.target.value)}
                                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm font-mono text-[#e8e8e8] focus:border-[#00ff88] focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-[#888] block mb-1 uppercase tracking-wider">Page Order</label>
                                <div className="flex rounded overflow-hidden border border-[#2a2a2a] h-[38px]">
                                    <button
                                        onClick={() => setGlobalReverse(false)}
                                        className={`flex-1 text-xs font-medium transition-colors ${!globalReverse ? 'bg-[#2a2a2a] text-[#e8e8e8]' : 'bg-[#1a1a1a] text-[#666] hover:bg-[#222]'}`}
                                    >
                                        Keep Original
                                    </button>
                                    <button
                                        onClick={() => setGlobalReverse(true)}
                                        className={`flex-1 text-xs font-medium transition-colors ${globalReverse ? 'bg-[#2a2a2a] text-[#e8e8e8]' : 'bg-[#1a1a1a] text-[#666] hover:bg-[#222]'}`}
                                    >
                                        Reverse Each PDF
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Progress */}
                        {isProcessing && (
                            <div className="mb-4 bg-[#0a0a0a] rounded p-3 border border-[#1a1a1a]">
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-[#e8e8e8]">{progressLabel}</span>
                                    <span className="text-[#00ff88] font-mono">{progress}%</span>
                                </div>
                                <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-[#00ff88] h-full rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Download Button */}
                        <div className="flex gap-2">
                            <button
                                onClick={doMerge}
                                disabled={pdfs.length < 2 || isProcessing}
                                className="w-full py-3 rounded bg-[#00ff88] text-black font-bold uppercase tracking-wider hover:bg-[#00e67a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <RefreshCw size={20} className="animate-spin" />
                                ) : (
                                    <Download size={20} />
                                )}
                                Merge & Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MergePdfs;
