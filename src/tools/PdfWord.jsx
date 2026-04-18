import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, RefreshCw, AlertCircle, FileEdit, CheckCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';

// Setup pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const PdfWord = () => {
    const [mode, setMode] = useState('pdf2word'); // 'pdf2word', 'word2pdf', or 'compress'
    
    // State
    const [file, setFile] = useState(null);
    const [previewContent, setPreviewContent] = useState(null); // HTML (string) for word2pdf
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('cloudconvert_api_key') || '');
    const previewRef = useRef(null);

    // Compress State
    const [compressionLevel, setCompressionLevel] = useState(0); // 0: Normal, 1: Moderate, 2: Strict
    const [fileMetadata, setFileMetadata] = useState(null); // { name, numPages, size }
    const [compressResult, setCompressResult] = useState(null); // { originalSize, finalSize, spaceSaved, level }

    // Reset state on mode change
    useEffect(() => {
        resetTool();
    }, [mode]);

    const handleApiKeyChange = (e) => {
        const val = e.target.value;
        setApiKey(val);
        localStorage.setItem('cloudconvert_api_key', val);
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setPreviewContent(null);
        setProgress(0);
        setCompressResult(null);
        setCompressionLevel(0);
        
        if (mode === 'pdf2word') {
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Please upload a valid PDF file.');
                setFile(null);
                return;
            }
        } else if (mode === 'compress') {
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Please upload a valid PDF file.');
                setFile(null);
                return;
            }
            try {
                const arrayBuffer = await selectedFile.arrayBuffer();
                const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                setFileMetadata({
                    name: selectedFile.name,
                    numPages: pdfDocument.numPages,
                    size: selectedFile.size
                });
            } catch (err) {
                console.error(err);
                toast.error('Failed to read PDF file metadata.');
                setFile(null);
                return;
            }
        } else {
            if (!selectedFile.name.match(/\.(docx|doc)$/i)) {
                toast.error('Please upload a valid Word document (.docx or .doc).');
                setFile(null);
                return;
            }
            await processWord(selectedFile);
        }
        
        // Reset file input target value so the same file can be uploaded again if needed
        e.target.value = null;
    };

    const processWord = async (wordFile) => {
        setIsProcessing(true);
        setProgressLabel('Reading Word document...');
        
        try {
            const arrayBuffer = await wordFile.arrayBuffer();
            setProgress(50);
            setProgressLabel('Converting to HTML...');
            
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setPreviewContent(result.value); 
            
            setProgress(100);
            setProgressLabel('Document loaded successfully!');
            toast.success('Word document loaded for preview.');
        } catch (error) {
            console.error('Error processing Word document:', error);
            toast.error('Failed to read Word document.');
        } finally {
            setIsProcessing(false);
        }
    };

    const runCloudConvert = async () => {
        if (!apiKey) {
            toast.error('⚠ Please enter your CloudConvert API key to use this feature', { duration: 4000 });
            return;
        }
        
        setIsProcessing(true);
        setProgress(10);
        setProgressLabel('Uploading PDF to CloudConvert...');
        
        try {
            // Create Job
            const createJobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tasks: {
                        'import-1': { operation: 'import/upload' },
                        'task-1': { operation: 'convert', input_format: 'pdf', output_format: 'docx', input: ['import-1'] },
                        'export-1': { operation: 'export/url', input: ['task-1'] }
                    }
                })
            });

            if (!createJobRes.ok) {
                const errorText = await createJobRes.text();
                console.error('Job Creation Error:', errorText);
                throw new Error('Failed to create CloudConvert job. Please check your API key.');
            }

            const jobData = await createJobRes.json();
            const uploadTask = jobData.data.tasks.find(t => t.name === 'import-1');
            
            setProgress(30);
            setProgressLabel('Converting to Word format...');
            const formData = new FormData();
            for (const key in uploadTask.result.form.parameters) {
                formData.append(key, uploadTask.result.form.parameters[key]);
            }
            formData.append('file', file);
            
            const uploadRes = await fetch(uploadTask.result.form.url, {
                method: 'POST',
                body: formData
            });
            
            if (!uploadRes.ok) throw new Error('Failed to upload file to CloudConvert.');

            // Poll status
            let jobFinished = false;
            let finalUrl = '';
            
            setProgress(50);
            while (!jobFinished) {
                await new Promise(r => setTimeout(r, 1500));
                const statusRes = await fetch(jobData.data.links.self, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                const statusData = await statusRes.json();
                
                if (statusData.data.status === 'error') {
                    throw new Error('CloudConvert failed to process the file.');
                }
                if (statusData.data.status === 'finished') {
                    jobFinished = true;
                    const exportTask = statusData.data.tasks.find(t => t.name === 'export-1');
                    if (exportTask && exportTask.result && exportTask.result.files) {
                        finalUrl = exportTask.result.files[0].url;
                    } else {
                        throw new Error('Conversion completed but no output file found.');
                    }
                } else {
                    setProgress(prev => Math.min(prev + 5, 90));
                }
            }
            
            setProgress(95);
            setProgressLabel('Preparing your download...');
            
            const downloadRes = await fetch(finalUrl);
            const blob = await downloadRes.blob();
            
            setProgress(100);
            setProgressLabel('✓ Done! Downloading your Word file...');
            
            const originalName = file?.name?.replace(/\.[^/.]+$/, "") || "Document";
            saveAs(blob, `${originalName}_converted.docx`);
            toast.success('File converted and downloaded successfully!');
            
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'An error occurred during conversion.');
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProgressLabel('');
                setProgress(0);
            }, 2000);
        }
    };

    const downloadPdf = async () => {
        if (!previewContent || !previewRef.current) return;
        
        setIsProcessing(true);
        setProgress(0);
        setProgressLabel('Capturing Document...');
        
        try {
            // Give the browser a moment to ensure rendering finishes
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const element = previewRef.current;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            
            setProgress(50);
            setProgressLabel('Generating PDF file...');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // If the content is longer than one page, add new pages.
            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
            
            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }
            
            setProgress(100);
            const originalName = file?.name?.replace(/\.[^/.]+$/, "") || "Document";
            pdf.save(`${originalName}_converted.pdf`);
            toast.success('File downloaded successfully!');
        } catch (error) {
            console.error('Error creating PDF:', error);
            toast.error('Failed to create PDF file.');
        } finally {
            setIsProcessing(false);
            setProgressLabel('');
        }
    };

    const compressPdf = async () => {
        setIsProcessing(true);
        setProgress(0);
        setProgressLabel('Reading PDF...');
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            setProgress(10);
            setProgressLabel('Applying compression...');
            
            let finalBytes = null;
            
            if (compressionLevel === 0) {
                // Normal
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const newDoc = await PDFDocument.create();
                const pages = await newDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
                pages.forEach(p => newDoc.addPage(p));
                
                setProgress(80);
                setProgressLabel('Finalizing output...');
                finalBytes = await newDoc.save({ objectsPerTick: 50 });
            } else {
                // Moderate or Strict
                const pdfData = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const newDoc = await PDFDocument.create();
                
                const numPages = pdfData.numPages;
                const scale = compressionLevel === 1 ? 1.5 : 1.0;
                const quality = compressionLevel === 1 ? 0.75 : 0.40;
                
                for (let i = 1; i <= numPages; i++) {
                    setProgressLabel(`Processing page ${i} of ${numPages}...`);
                    setProgress(10 + Math.round(((i - 1) / numPages) * 70));
                    
                    const page = await pdfData.getPage(i);
                    const viewport = page.getViewport({ scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    await page.render({ canvasContext: context, viewport }).promise;
                    
                    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                    const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
                    
                    const img = await newDoc.embedJpg(jpegBytes);
                    const newPage = newDoc.addPage([img.width, img.height]);
                    newPage.drawImage(img, {
                        x: 0,
                        y: 0,
                        width: img.width,
                        height: img.height,
                    });
                }
                setProgress(85);
                setProgressLabel('Finalizing output...');
                finalBytes = await newDoc.save({ objectsPerTick: 50 });
            }
            
            setProgress(100);
            setProgressLabel('✓ Done! Downloading compressed PDF');
            
            if (finalBytes.length >= file.size) {
                 toast('ℹ This PDF is already well optimized. Compression saved minimal space.', { icon: 'ℹ' });
            }
            
            const originalName = file.name.replace(/\.[^/.]+$/, "");
            const outName = `${originalName}-compressed.pdf`;
            const blob = new Blob([finalBytes], { type: 'application/pdf' });
            saveAs(blob, outName);
            toast.success('✓ Compressed PDF saved');
            
            const originalSz = (file.size / 1024 / 1024).toFixed(2);
            const finalSz = (finalBytes.length / 1024 / 1024).toFixed(2);
            const saved = ((file.size - finalBytes.length) / 1024 / 1024).toFixed(2);
            let percentage = (((file.size - finalBytes.length) / file.size) * 100).toFixed(0);
            if (percentage < 0) percentage = 0;
            const lvlName = compressionLevel === 0 ? 'Normal' : compressionLevel === 1 ? 'Moderate' : 'Strict';
            
            setCompressResult({
                 originalSize: originalSz,
                 finalSize: finalSz,
                 spaceSaved: `${saved > 0 ? saved : 0} MB (${percentage}% smaller)`,
                 level: lvlName
            });
            
        } catch(error) {
            console.error('Compression error:', error);
            toast.error('An error occurred during compression.');
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProgressLabel('');
                setProgress(0);
            }, 2000);
        }
    };

    const handleDownload = () => {
        if (mode === 'pdf2word') runCloudConvert();
        else if (mode === 'word2pdf') downloadPdf();
        else if (mode === 'compress') compressPdf();
    };

    const resetTool = () => {
        setFile(null);
        setPreviewContent(null);
        setProgress(0);
        setProgressLabel('');
        setIsProcessing(false);
        setCompressionLevel(0);
        setFileMetadata(null);
        setCompressResult(null);
    };

    const getCompressionEstimate = () => {
        if (!fileMetadata) return null;
        let factor = 0.45;
        if (compressionLevel === 1) factor = 0.30;
        if (compressionLevel === 2) factor = 0.15;
        const estSize = fileMetadata.size * factor;
        const reduction = ((1 - factor) * 100).toFixed(0);
        return {
            estimatedMB: (estSize / 1024 / 1024).toFixed(2),
            reduction
        };
    };

    return (
        <div className="h-full flex flex-col pt-16 md:pt-0">
            <div className="p-4 md:p-6 border-b border-[#1a1a1a]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-[#e8e8e8] mb-2 flex items-center gap-2">
                        <FileEdit className="text-[#00ff88]" />
                        {mode === 'compress' ? 'Compress PDF' : 'PDF & Word'}
                    </h1>
                    <p className="text-[#666666] text-sm flex items-center gap-2">
                        {mode === 'compress' ? 'Reduce the file size of your PDF documents easily.' : 'Convert between PDF and Word documents directly in your browser.'}
                    </p>
                    <div className="mt-2 text-xs font-mono text-[#00ff88] bg-[#00ff88]/10 w-max px-2 py-1 rounded">
                        {mode === 'pdf2word' && '📥 Input: PDF → 📤 Output: DOCX'}
                        {mode === 'word2pdf' && '📥 Input: DOCX · DOC → 📤 Output: PDF'}
                        {mode === 'compress' && '📥 Input: PDF → 📤 Output: Compressed PDF (smaller file size)'}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* Mode Toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-[#1a1a1a]">
                        <button
                            onClick={() => setMode('pdf2word')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                mode === 'pdf2word' 
                                ? 'bg-[#00ff88] text-black' 
                                : 'bg-[#111111] text-[#666666] hover:text-[#e8e8e8] hover:bg-[#161616]'
                            }`}
                        >
                            📄 PDF → Word
                        </button>
                        <button
                            onClick={() => setMode('word2pdf')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-x border-[#1a1a1a] ${
                                mode === 'word2pdf' 
                                ? 'bg-[#00ff88] text-black' 
                                : 'bg-[#111111] text-[#666666] hover:text-[#e8e8e8] hover:bg-[#161616]'
                            }`}
                        >
                            📝 Word → PDF
                        </button>
                        <button
                            onClick={() => setMode('compress')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                mode === 'compress' 
                                ? 'bg-[#00ff88] text-black' 
                                : 'bg-[#111111] text-[#666666] hover:text-[#e8e8e8] hover:bg-[#161616]'
                            }`}
                        >
                            🗜 Compress PDF
                        </button>
                    </div>

                    {mode === 'pdf2word' && (
                        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 mb-6">
                            <label className="text-sm font-medium text-[#e8e8e8] mb-2 flex items-center gap-2">
                                CloudConvert API Key
                                {apiKey && <span className="text-xs text-[#00ff88] flex items-center gap-1 bg-[#00ff88]/10 px-2 py-0.5 rounded"><CheckCircle size={12} /> Key saved</span>}
                            </label>
                            <input 
                                type="password"
                                value={apiKey}
                                onChange={handleApiKeyChange}
                                placeholder="Enter your free API key..."
                                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#e8e8e8] focus:outline-none focus:border-[#00ff88] transition-colors mb-2"
                            />
                            <p className="text-xs text-[#666666]">
                                Get your free key at <a href="https://cloudconvert.com" target="_blank" rel="noopener noreferrer" className="text-[#00ff88] hover:underline">cloudconvert.com</a> — 250 free conversions/month
                            </p>
                        </div>
                    )}

                    {!file ? (
                        <div className="border-2 border-dashed border-[#1a1a1a] rounded-lg p-12 text-center hover:border-[#00ff88] transition-colors relative group bg-[#0a0a0a]">
                            <input
                                type="file"
                                accept={mode === 'pdf2word' || mode === 'compress' ? "application/pdf" : ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-[#111111] flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload size={24} className="text-[#00ff88]" />
                                </div>
                                <div>
                                    <p className="text-[#e8e8e8] font-medium mb-1">
                                        Drop your {mode === 'word2pdf' ? 'Word' : 'PDF'} document here
                                    </p>
                                    <p className="text-[#666666] text-sm">
                                        or click to browse from your computer
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* File Status Header */}
                            <div className="bg-[#111111] rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-[#1a1a1a]">
                                <div className="flex items-center gap-4 text-[#e8e8e8]">
                                    <div className="w-12 h-12 rounded bg-[#1a1a1a] flex items-center justify-center text-[#00ff88]">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium truncate max-w-[200px] md:max-w-md" title={file.name}>
                                            {file.name}
                                        </h3>
                                        {mode !== 'compress' && (
                                            <p className="text-[#666666] text-sm">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        )}
                                        {mode === 'compress' && fileMetadata && (
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                 <span className="bg-[#1a1a1a] px-2 py-0.5 rounded text-[10px] text-[#e8e8e8] font-mono border border-[#333]">{fileMetadata.numPages} pages</span>
                                                 <span className="bg-[#1a1a1a] px-2 py-0.5 rounded text-[10px] text-[#e8e8e8] font-mono border border-[#333]">{(fileMetadata.size / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Common actions if not compress result */}
                                {(!compressResult) && (
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button
                                            onClick={resetTool}
                                            disabled={isProcessing}
                                            className="flex-1 md:flex-none p-3 rounded bg-[#1a1a1a] text-[#e8e8e8] hover:bg-[#222222] transition-colors disabled:opacity-50 flex items-center justify-center"
                                            title="Start Over"
                                        >
                                            <RefreshCw size={20} className={isProcessing && progress > 0 && progress < 100 ? "animate-spin" : ""} />
                                        </button>
                                        
                                        {mode !== 'compress' && (
                                            <button
                                                onClick={handleDownload}
                                                disabled={(mode === 'word2pdf' && !previewContent) || isProcessing}
                                                className="flex-1 md:flex-none px-6 py-3 rounded bg-[#00ff88] text-black font-medium hover:bg-[#00e67a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isProcessing ? (
                                                    <RefreshCw size={20} className="animate-spin" />
                                                ) : (
                                                    <Download size={20} />
                                                )}
                                                {mode === 'pdf2word' ? 'Convert & Download DOCX' : 'Download PDF'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Compress Dashboard */}
                            {mode === 'compress' && !compressResult && (
                                <div className="mt-6 space-y-6">
                                    <div className="bg-[#111111] rounded-lg p-6 border border-[#1a1a1a]">
                                        <div className="text-center mb-8">
                                            <h3 className="text-2xl font-bold text-[#00ff88]">
                                                {compressionLevel === 0 ? 'Normal Compression' : compressionLevel === 1 ? 'Moderate Compression' : 'Strict Compression'}
                                            </h3>
                                            <p className="text-[#a0a0a0] text-sm mt-2 max-w-lg mx-auto">
                                                {compressionLevel === 0 && 'Reduces file size with no visible quality loss. Recommended for most files.'}
                                                {compressionLevel === 1 && 'Noticeably smaller file with slight reduction in image sharpness.'}
                                                {compressionLevel === 2 && 'Maximum compression. Text and images may appear degraded.'}
                                            </p>
                                        </div>

                                        <div className="px-6 mb-8 max-w-2xl mx-auto">
                                            <input 
                                                type="range" 
                                                min="0" max="2" step="1" 
                                                value={compressionLevel}
                                                onChange={(e) => setCompressionLevel(parseInt(e.target.value))}
                                                className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#00ff88]"
                                            />
                                            <div className="flex justify-between text-xs text-[#888888] font-medium mt-3 px-1">
                                                <span className="w-16 text-left -translate-x-1/2">Normal</span>
                                                <span className="w-16 text-center">Moderate</span>
                                                <span className="w-16 text-right translate-x-1/2">Strict</span>
                                            </div>
                                        </div>

                                        {compressionLevel === 2 && (
                                            <div className="bg-[#1a1500] border-l-4 border-yellow-400 p-4 rounded mb-6 max-w-2xl mx-auto">
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={18} />
                                                    <div>
                                                        <h4 className="text-yellow-400 font-medium text-sm">Strict Compression Warning</h4>
                                                        <p className="text-[#a0a0a0] text-xs mt-1 leading-relaxed">This level applies maximum compression and may significantly reduce the quality of text, images, and formatting in your PDF. Only use this if file size is the top priority over quality.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-[#0a0a0a] rounded-lg p-5 border border-[#1a1a1a] font-mono text-sm max-w-2xl mx-auto">
                                            <div className="flex justify-between mb-3 pb-3 border-b border-[#1a1a1a] border-dashed">
                                                <span className="text-[#666666]">Original:</span>
                                                <span className="text-[#e8e8e8]">{fileMetadata ? (fileMetadata.size / 1024 / 1024).toFixed(2) : '0'} MB</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[#666666]">Estimated:</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[#e8e8e8] font-bold">~{getCompressionEstimate()?.estimatedMB} MB</span>
                                                    <span className="bg-[#00ff88]/10 text-[#00ff88] px-2 py-0.5 rounded text-xs border border-[#00ff88]/20">-{getCompressionEstimate()?.reduction}%</span>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-[#444444] mt-4 text-right italic font-sans">
                                                * Actual size may vary based on PDF content
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-center mt-8">
                                            <button
                                                onClick={handleDownload}
                                                disabled={isProcessing}
                                                className="w-full max-w-md py-4 rounded bg-[#00ff88] text-black font-bold tracking-wide hover:bg-[#00e67a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                            >
                                                {isProcessing ? (
                                                    <RefreshCw size={22} className="animate-spin" />
                                                ) : (
                                                    <Download size={22} />
                                                )}
                                                Compress & Download PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Compress Result Card */}
                            {mode === 'compress' && compressResult && (
                                <div className="mt-8 bg-[#0a0a0a] p-6 md:p-8 rounded-lg border border-[#00ff88]/30 font-mono text-sm shadow-[0_0_20px_rgba(0,255,136,0.05)] mx-auto max-w-2xl">
                                    <div className="flex items-center justify-center gap-3 text-[#00ff88] text-xl font-bold mb-8">
                                        <CheckCircle size={28} />
                                        Compression Complete
                                    </div>
                                    <div className="space-y-4 mb-8 text-[#e8e8e8]">
                                        <div className="flex justify-between items-center pb-4 border-b border-[#1a1a1a]">
                                            <span className="text-[#666666]">Original size</span>
                                            <span className="text-lg">{compressResult.originalSize} MB</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-4 border-b border-[#1a1a1a]">
                                            <span className="text-[#666666]">Compressed size</span>
                                            <span className="text-lg">{compressResult.finalSize} MB</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-4 border-b border-[#1a1a1a]">
                                            <span className="text-[#00ff88] font-bold">Space saved</span>
                                            <span className="text-[#00ff88] font-bold text-lg">{compressResult.spaceSaved}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-[#666666]">Level used</span>
                                            <span className="bg-[#111111] px-3 py-1 rounded text-[#e8e8e8]">{compressResult.level}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={resetTool}
                                        className="w-full py-3 hover:bg-[#111111] rounded text-[#e8e8e8] font-sans font-medium text-sm transition-colors border border-[#2a2a2a]"
                                    >   
                                        Compress Another PDF
                                    </button>
                                </div>
                            )}

                            {/* Progress Section */}
                            {(isProcessing || (progress > 0 && progress < 100)) && (
                                <div className="bg-[#111111] p-4 rounded-lg border border-[#1a1a1a]">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-[#e8e8e8]">{progressLabel || 'Processing...'}</span>
                                        <span className="text-[#00ff88] font-mono">{progress}%</span>
                                    </div>
                                    <div className="w-full bg-[#1a1a1a] rounded-full h-2">
                                        <div 
                                            className="bg-[#00ff88] h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Disclaimers (Not shown in compress mode unless stated) */}
                            {mode !== 'compress' && (
                                <div className="flex flex-col gap-1 items-center justify-center text-center">
                                    {mode === 'pdf2word' ? (
                                        <>
                                            <p className="text-[#666666] text-xs flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                🔒 Your file is sent to CloudConvert for conversion and immediately
                                            </p>
                                            <p className="text-[#666666] text-xs">
                                                deleted from their servers after download. No data is stored.
                                            </p>
                                            <p className="text-[#666666] text-xs mt-1 font-medium">
                                                Free tier allows 250 conversions per month.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-[#666666] text-xs flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                Client-side conversion preserves text and basic formatting.
                                            </p>
                                            <p className="text-[#666666] text-xs">
                                                Complex layouts, tables, and images may not be fully preserved.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Preview Area (Word to PDF only) */}
                            {mode === 'word2pdf' && previewContent && (
                                <div className="space-y-2">
                                    <h3 className="text-[#e8e8e8] font-medium flex items-center gap-2">
                                        Preview Document
                                    </h3>
                                    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a] max-h-[600px] overflow-y-auto custom-scrollbar">
                                        <div className="bg-[#e8e8e8] text-black p-8 md:p-12 min-h-[842px] max-w-[595px] mx-auto shadow-lg" ref={previewRef}>
                                            <div 
                                                className="word-preview-content font-serif text-sm leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: previewContent }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {mode === 'word2pdf' && (
                <style dangerouslySetInnerHTML={{__html: `
                    .word-preview-content h1 { font-size: 2em; font-weight: bold; margin-bottom: 0.5em; }
                    .word-preview-content h2 { font-size: 1.5em; font-weight: bold; margin-bottom: 0.5em; }
                    .word-preview-content h3 { font-size: 1.17em; font-weight: bold; margin-bottom: 0.5em; }
                    .word-preview-content p { margin-bottom: 1em; }
                    .word-preview-content ul { list-style-type: disc; margin-left: 2em; margin-bottom: 1em; }
                    .word-preview-content ol { list-style-type: decimal; margin-left: 2em; margin-bottom: 1em; }
                    .word-preview-content table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
                    .word-preview-content th, .word-preview-content td { border: 1px solid #999; padding: 0.5em; }
                `}} />
            )}
        </div>
    );
};

export default PdfWord;
