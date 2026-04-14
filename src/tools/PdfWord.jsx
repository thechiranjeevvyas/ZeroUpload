import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, RefreshCw, AlertCircle, FileEdit, CheckCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
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
    const [mode, setMode] = useState('pdf2word'); // 'pdf2word' or 'word2pdf'
    
    // State
    const [file, setFile] = useState(null);
    const [previewContent, setPreviewContent] = useState(null); // HTML (string) for word2pdf
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('cloudconvert_api_key') || '');
    
    const previewRef = useRef(null);

    // Reset state on mode change
    useEffect(() => {
        setFile(null);
        setPreviewContent(null);
        setIsProcessing(false);
        setProgress(0);
        setProgressLabel('');
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
        
        if (mode === 'pdf2word') {
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Please upload a valid PDF file.');
                setFile(null);
                return;
            }
            // For pdf2word, we wait for user to click convert.
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

    const handleDownload = () => {
        if (mode === 'pdf2word') {
            runCloudConvert();
        } else {
            downloadPdf();
        }
    };

    const resetTool = () => {
        setFile(null);
        setPreviewContent(null);
        setProgress(0);
        setProgressLabel('');
        setIsProcessing(false);
    };

    return (
        <div className="h-full flex flex-col pt-16 md:pt-0">
            <div className="p-4 md:p-6 border-b border-[#1a1a1a]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-[#e8e8e8] mb-2 flex items-center gap-2">
                        <FileEdit className="text-[#00ff88]" />
                        PDF & Word
                    </h1>
                    <p className="text-[#666666] text-sm flex items-center gap-2">
                        Convert between PDF and Word documents directly in your browser.
                    </p>
                    <div className="mt-2 text-xs font-mono text-[#00ff88] bg-[#00ff88]/10 w-max px-2 py-1 rounded">
                        {mode === 'pdf2word' ? 'Input PDF → Output DOCX' : 'Input DOCX · DOC → Output PDF'}
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
                            PDF to Word
                        </button>
                        <button
                            onClick={() => setMode('word2pdf')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                mode === 'word2pdf' 
                                ? 'bg-[#00ff88] text-black' 
                                : 'bg-[#111111] text-[#666666] hover:text-[#e8e8e8] hover:bg-[#161616]'
                            }`}
                        >
                            Word to PDF
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
                                accept={mode === 'pdf2word' ? "application/pdf" : ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-[#111111] flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload size={24} className="text-[#00ff88]" />
                                </div>
                                <div>
                                    <p className="text-[#e8e8e8] font-medium mb-1">
                                        Drop your {mode === 'pdf2word' ? 'PDF' : 'Word'} document here
                                    </p>
                                    <p className="text-[#666666] text-sm">
                                        or click to browse from your computer
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-[#111111] rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-[#1a1a1a]">
                                <div className="flex items-center gap-4 text-[#e8e8e8]">
                                    <div className="w-12 h-12 rounded bg-[#1a1a1a] flex items-center justify-center text-[#00ff88]">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium truncate max-w-[200px] md:max-w-md" title={file.name}>
                                            {file.name}
                                        </h3>
                                        <p className="text-[#666666] text-sm">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={resetTool}
                                        disabled={isProcessing}
                                        className="flex-1 md:flex-none p-3 rounded bg-[#1a1a1a] text-[#e8e8e8] hover:bg-[#222222] transition-colors disabled:opacity-50 flex items-center justify-center"
                                        title="Start Over"
                                    >
                                        <RefreshCw size={20} className={isProcessing && progress > 0 && progress < 100 ? "animate-spin" : ""} />
                                    </button>
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
                                </div>
                            </div>

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

                            {/* Disclaimers */}
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
