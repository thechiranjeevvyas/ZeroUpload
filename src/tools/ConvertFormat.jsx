import { useState, useCallback } from 'react';
import { Download, FileArchive, Trash2, ArrowRight } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import DropZone from '../components/DropZone';
import { notify } from '../components/Toast';

const FORMATS = [
    { id: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
    { id: 'png', label: 'PNG', mime: 'image/png' },
    { id: 'webp', label: 'WebP', mime: 'image/webp' },
];

export default function ConvertFormat() {
    const [files, setFiles] = useState([]);
    const [outputFormat, setOutputFormat] = useState(FORMATS[1]); // Default PNG
    const [quality, setQuality] = useState(90);
    const [processing, setProcessing] = useState(false);

    const handleFiles = (newFiles) => {
        const validFiles = newFiles.filter(f => f.type.startsWith('image/'));
        if (validFiles.length < newFiles.length) {
            notify.error(`${newFiles.length - validFiles.length} files ignored (not images)`);
        }

        if (validFiles.length > 0) {
            const fileObjects = validFiles.map(f => ({
                id: crypto.randomUUID(),
                file: f,
                originalUrl: URL.createObjectURL(f),
                status: 'pending', // pending, processing, done, error
                resultBlob: null,
            }));
            setFiles(prev => [...prev, ...fileObjects]);
        }
    };

    const removeFile = (id) => {
        setFiles(prev => {
            const remaining = prev.filter(f => f.id !== id);
            const removed = prev.find(f => f.id === id);
            if (removed && removed.originalUrl) URL.revokeObjectURL(removed.originalUrl);
            return remaining;
        });
    };

    const processFile = async (fileObj) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Fill white background for formats that don't support transparency like JPG 
                if (outputFormat.mime === 'image/jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, outputFormat.mime, quality / 100);
            };
            img.onerror = () => resolve(null);
            img.src = fileObj.originalUrl;
        });
    };

    const handleConvertAll = async () => {
        setProcessing(true);
        const updatedFiles = [...files];

        for (let i = 0; i < updatedFiles.length; i++) {
            if (updatedFiles[i].status === 'done') continue;

            updatedFiles[i] = { ...updatedFiles[i], status: 'processing' };
            setFiles([...updatedFiles]); // trigger re-render for processing state

            const blob = await processFile(updatedFiles[i]);

            if (blob) {
                updatedFiles[i] = { ...updatedFiles[i], status: 'done', resultBlob: blob };
            } else {
                updatedFiles[i] = { ...updatedFiles[i], status: 'error' };
                notify.error(`Failed to process ${updatedFiles[i].file.name}`);
            }
            setFiles([...updatedFiles]);
        }

        setProcessing(false);
        notify.success('All files processed');
    };

    const handleDownloadSingle = (fileObj) => {
        if (!fileObj.resultBlob) return;
        const oldName = fileObj.file.name;
        const baseName = oldName.substring(0, oldName.lastIndexOf('.')) || oldName;
        const filename = `${baseName}.${outputFormat.id}`;
        saveAs(fileObj.resultBlob, filename);
        notify.success(`Saved ${filename}`);
    };

    const handleDownloadZip = async () => {
        const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);
        if (doneFiles.length === 0) return;

        notify.loading('Creating ZIP archive...');
        const zip = new JSZip();

        doneFiles.forEach((fileObj) => {
            const oldName = fileObj.file.name;
            const baseName = oldName.substring(0, oldName.lastIndexOf('.')) || oldName;
            const filename = `${baseName}.${outputFormat.id}`;
            // ensure unique names
            zip.file(filename, fileObj.resultBlob);
        });

        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            notify.dismiss();
            saveAs(zipBlob, `converted_images.zip`);
            notify.success('ZIP downloaded successfully');
        } catch (error) {
            notify.dismiss();
            notify.error('Failed to create ZIP');
        }
    };

    const handleDownloadDirectly = async () => {
        const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);
        if (doneFiles.length === 0) return;
        for (const fileObj of doneFiles) {
            handleDownloadSingle(fileObj);
            await new Promise(r => setTimeout(r, 300));
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
            <div>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 Input:  JPG · PNG · WebP · GIF · BMP</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Output: JPG · PNG · WebP · GIF · BMP</span>
                </div>
                <p className="text-xs font-mono text-subtle mb-4">⚠ GIF output is static (canvas export limitation)</p>
            </div>

            <DropZone
                onFile={handleFiles}
                accept="image/*"
                multiple={true}
                label="Drag & drop images here"
            />

            {files.length > 0 && (
                <>
                    <div className="bg-surface border border-border rounded p-4 flex flex-wrap gap-6 justify-between items-center">
                        <div className="flex flex-wrap gap-6 items-center flex-1">
                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Output Format</p>
                                <div className="flex bg-bg rounded p-1 border border-border">
                                    {FORMATS.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => setOutputFormat(f)}
                                            disabled={processing}
                                            className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${outputFormat.id === f.id ? 'bg-surface text-accent border border-accent/20' : 'text-subtle hover:text-text hover:bg-surface'
                                                }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(outputFormat.id === 'jpeg' || outputFormat.id === 'webp') && (
                                <div className="flex-1 min-w-[200px] max-w-[300px]">
                                    <div className="flex justify-between text-xs font-mono mb-2">
                                        <span className="text-subtle uppercase">Quality</span>
                                        <span className="text-accent">{quality}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="5"
                                        value={quality}
                                        onChange={(e) => setQuality(Number(e.target.value))}
                                        disabled={processing}
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setFiles([])}
                            className="text-subtle text-sm underline hover:text-text disabled:opacity-50"
                            disabled={processing}
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="flex justify-between items-end mb-2 mt-2">
                        <h3 className="font-sans text-lg">Files ({files.length})</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={handleConvertAll}
                                disabled={processing || files.every(f => f.status === 'done')}
                                className="flex items-center gap-2 bg-[#1a1a1a] text-[#e8e8e8] px-4 py-2 rounded font-medium text-sm hover:bg-[#222] transition-colors disabled:opacity-50"
                            >
                                <Repeat size={16} />
                                Convert All
                            </button>
                            {files.filter(f => f.status === 'done').length > 1 ? (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex gap-3">
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
                                    </div>
                                    <span className="text-xs text-subtle font-mono mt-1">ZIP recommended for 5+ files</span>
                                </div>
                            ) : files.filter(f => f.status === 'done').length === 1 ? (
                                <button
                                    onClick={() => handleDownloadSingle(files.find(f => f.status === 'done'))}
                                    className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded font-bold text-sm hover:brightness-110 transition-all font-sans"
                                >
                                    <Download size={16} />
                                    Download
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="bg-surface border border-border rounded overflow-hidden">
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#161616] sticky top-0 z-10">
                                    <tr>
                                        <th className="font-mono text-xs text-subtle uppercase p-4 font-normal">File</th>
                                        <th className="font-mono text-xs text-subtle uppercase p-4 font-normal">Conversion</th>
                                        <th className="font-mono text-xs text-subtle uppercase p-4 font-normal w-[120px]">Status</th>
                                        <th className="font-mono text-xs text-subtle uppercase p-4 font-normal w-[100px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {files.map((f) => (
                                        <tr key={f.id} className="hover:bg-bg/50 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={f.originalUrl} alt="" className="w-10 h-10 object-cover rounded bg-bg border border-border" />
                                                    <span className="font-mono text-sm block truncate max-w-[200px]" title={f.file.name}>
                                                        {f.file.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-mono text-subtle flex items-center gap-2 h-full">
                                                <span className="uppercase">{f.file.type.split('/')[1] || 'img'}</span>
                                                <ArrowRight size={14} className="text-border" />
                                                <span className="uppercase text-accent">{outputFormat.id}</span>
                                            </td>
                                            <td className="p-4">
                                                {f.status === 'pending' && <span className="text-xs font-mono text-subtle">Ready</span>}
                                                {f.status === 'processing' && <span className="text-xs font-mono text-[#e8e8e8] animate-pulse">Processing...</span>}
                                                {f.status === 'done' && <span className="text-xs font-mono text-accent">Done</span>}
                                                {f.status === 'error' && <span className="text-xs font-mono text-red-400">Error</span>}
                                            </td>
                                            <td className="p-4 flex gap-2">
                                                {f.status === 'done' ? (
                                                    <button
                                                        onClick={() => handleDownloadSingle(f)}
                                                        className="text-[#00ff88] hover:text-[#00ff88]/70 transition-colors p-2"
                                                        title="Download"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => removeFile(f.id)}
                                                        className="text-subtle hover:text-red-400 transition-colors p-2"
                                                        title="Remove"
                                                        disabled={f.status === 'processing'}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
