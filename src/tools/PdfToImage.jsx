import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, FileArchive } from 'lucide-react';
import DropZone from '../components/DropZone';
import ProgressBar from '../components/ProgressBar';
import { notify } from '../components/Toast';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const FORMATS = [
    { id: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
    { id: 'png', label: 'PNG', mime: 'image/png' },
    { id: 'webp', label: 'WebP', mime: 'image/webp' },
];

const SCALES = [
    { id: 1, label: '1x' },
    { id: 2, label: '2x' },
    { id: 3, label: '3x' },
];

export default function PdfToImage() {
    const [file, setFile] = useState(null);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [scale, setScale] = useState(2);
    const [format, setFormat] = useState(FORMATS[0]);

    const processPdf = async (selectedFile, currentScale, currentFormat) => {
        if (!selectedFile) return;
        setLoading(true);
        setProgress(0);
        setPages([]);

        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const numPages = pdf.numPages;
            const newPages = [];

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: currentScale });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport,
                };

                await page.render(renderContext).promise;

                // Convert canvas to blob
                const blob = await new Promise((resolve) => {
                    canvas.toBlob(resolve, currentFormat.mime, 0.9);
                });

                newPages.push({
                    pageNumber: i,
                    blob,
                    url: URL.createObjectURL(blob),
                    width: canvas.width,
                    height: canvas.height
                });

                setProgress((i / numPages) * 100);
            }

            setPages(newPages);
            notify.success(`Processed ${numPages} pages successfully`);
        } catch (error) {
            console.error(error);
            notify.error('Failed to process PDF');
        } finally {
            setLoading(false);
        }
    };

    const handleFile = (newFile) => {
        setFile(newFile);
        processPdf(newFile, scale, format);
    };

    const handleScaleChange = (newScale) => {
        setScale(newScale);
        if (file) processPdf(file, newScale, format);
    };

    const handleFormatChange = (newFormat) => {
        setFormat(newFormat);
        if (file) processPdf(file, scale, newFormat);
    };

    const handleDownloadSingle = (page) => {
        const filename = `${file.name.replace('.pdf', '')}_page_${page.pageNumber}.${format.id}`;
        saveAs(page.blob, filename);
        notify.success(`Saved ${filename}`);
    };

    const handleDownloadZip = async () => {
        if (pages.length === 0) return;

        notify.loading('Creating ZIP archive...');
        const zip = new JSZip();
        const folderName = file.name.replace('.pdf', '');
        const folder = zip.folder(folderName);

        pages.forEach((page) => {
            const filename = `${folderName}_page_${page.pageNumber}.${format.id}`;
            folder.file(filename, page.blob);
        });

        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            notify.dismiss();
            saveAs(zipBlob, `${folderName}_images.zip`);
            notify.success('ZIP downloaded successfully');
        } catch (error) {
            notify.dismiss();
            notify.error('Failed to create ZIP');
        }
    };

    const handleDownloadDirectly = async () => {
        if (pages.length === 0) return;
        for (const page of pages) {
            handleDownloadSingle(page);
            await new Promise(r => setTimeout(r, 300));
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
            <div>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-4 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 Input:  PDF</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Output: JPG · PNG · WebP</span>
                </div>
            </div>

            {!file && (
                <DropZone
                    onFile={handleFile}
                    accept="application/pdf"
                    label="Drag & drop a PDF here"
                />
            )}

            {file && (
                <>
                    {/* Controls Panel */}
                    <div className="bg-surface border border-border rounded p-4 flex flex-wrap gap-6 justify-between items-center">
                        <div className="flex flex-wrap gap-4 items-center flex-1">
                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Resolution</p>
                                <div className="flex bg-bg rounded p-1 border border-border">
                                    {SCALES.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleScaleChange(s.id)}
                                            disabled={loading}
                                            className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${scale === s.id ? 'bg-surface text-accent border border-accent/20' : 'text-subtle hover:text-text hover:bg-surface'
                                                }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Format</p>
                                <div className="flex bg-bg rounded p-1 border border-border">
                                    {FORMATS.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => handleFormatChange(f)}
                                            disabled={loading}
                                            className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${format.id === f.id ? 'bg-surface text-accent border border-accent/20' : 'text-subtle hover:text-text hover:bg-surface'
                                                }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => { setFile(null); setPages([]); setProgress(0); }}
                            className="text-subtle text-sm underline hover:text-text disabled:opacity-50"
                            disabled={loading}
                        >
                            Clear PDF
                        </button>
                    </div>

                    {/* Metadata Row */}
                    <div className="flex flex-wrap gap-3">
                        <span className="bg-surface border border-border px-3 py-1 rounded text-xs font-mono text-text">
                            {file.name}
                        </span>
                        <span className="bg-surface border border-border px-3 py-1 rounded text-xs font-mono text-text">
                            {formatFileSize(file.size)}
                        </span>
                        {pages.length > 0 && (
                            <span className="bg-surface border border-border px-3 py-1 rounded text-xs font-mono text-accent">
                                {pages.length} Pages
                            </span>
                        )}
                    </div>

                    {loading && (
                        <div className="bg-surface p-6 rounded border border-border">
                            <ProgressBar value={progress} label="Rendering PDF pages..." />
                        </div>
                    )}

                    {/* Results Grid */}
                    {!loading && pages.length > 0 && (
                        <>
                            <div className="flex justify-between items-end mb-2 mt-4">
                                <h3 className="font-sans text-lg">Preview</h3>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex gap-3">
                                        {pages.length > 1 ? (
                                            <>
                                                <button
                                                    onClick={handleDownloadZip}
                                                    className="flex items-center gap-2 border border-accent text-accent bg-transparent px-4 py-2 rounded font-medium text-sm hover:bg-accent/10 transition-all font-sans"
                                                >
                                                    <FileArchive size={16} />
                                                    Download All as ZIP
                                                </button>
                                                <button
                                                    onClick={handleDownloadDirectly}
                                                    className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded font-bold text-sm hover:brightness-110 transition-all font-sans"
                                                >
                                                    <Download size={16} />
                                                    Download Directly
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleDownloadSingle(pages[0])}
                                                className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded font-bold text-sm hover:brightness-110 transition-all font-sans"
                                            >
                                                <Download size={16} />
                                                Download
                                            </button>
                                        )}
                                    </div>
                                    {pages.length > 1 && (
                                        <span className="text-xs text-subtle font-mono mt-1">ZIP recommended for 5+ files</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pages.map((page) => (
                                    <div key={page.pageNumber} className="bg-surface border border-border rounded overflow-hidden flex flex-col group">
                                        <div className="aspect-[1/1.4] bg-bg relative flex items-center justify-center overflow-hidden p-4">
                                            <img
                                                src={page.url}
                                                alt={`Page ${page.pageNumber}`}
                                                className="max-w-full max-h-full object-contain shadow-lg"
                                            />
                                            <div className="absolute inset-0 bg-bg/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <button
                                                    onClick={() => handleDownloadSingle(page)}
                                                    className="flex items-center gap-2 bg-[#00ff88] text-[#0a0a0a] px-4 py-2 rounded font-medium text-sm hover:scale-105 transition-transform"
                                                >
                                                    <Download size={16} />
                                                    Download
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-3 border-t border-border flex justify-between items-center text-xs font-mono">
                                            <span className="text-text">Page {page.pageNumber}</span>
                                            <span className="text-subtle">{page.width}x{page.height}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
