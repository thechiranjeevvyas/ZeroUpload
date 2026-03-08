import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, X } from 'lucide-react';
import DropZone from '../components/DropZone';
import ProgressBar from '../components/ProgressBar';
import { notify } from '../components/Toast';

export default function ImageToPdf() {
    const [images, setImages] = useState([]);
    const [pageSize, setPageSize] = useState('fit');
    const [orientation, setOrientation] = useState('portrait');
    const [margin, setMargin] = useState(10);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [draggedIdx, setDraggedIdx] = useState(null);

    const handleFiles = (newFiles) => {
        const validFiles = newFiles.filter(f => f.type.startsWith('image/'));
        if (validFiles.length < newFiles.length) {
            notify.error(`${newFiles.length - validFiles.length} files ignored (not images)`);
        }

        if (validFiles.length > 0) {
            const promises = validFiles.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const dataURL = e.target.result;
                        const img = new Image();
                        img.onload = () => {
                            resolve({
                                id: crypto.randomUUID(),
                                file,
                                dataURL,
                                name: file.name,
                                width: img.width,
                                height: img.height,
                                size: file.size
                            });
                        };
                        img.src = dataURL;
                    };
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(promises).then(results => {
                setImages(prev => [...prev, ...results]);
            });
        }
    };

    const removeImage = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const handleDragStart = (e, idx) => {
        setDraggedIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
        /* Using setTimeout to hide the element while dragging visually */
    };

    const handleDragOver = (e, idx) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === idx) return;

        // Very simple reordering on hover over
        const newItems = [...images];
        const item = newItems.splice(draggedIdx, 1)[0];
        newItems.splice(idx, 0, item);

        setDraggedIdx(idx);
        setImages(newItems);
    };

    const handleDragEnd = () => {
        setDraggedIdx(null);
    };

    const generatePDF = async () => {
        if (images.length === 0) return;
        setLoading(true);

        try {
            // Small timeout to allow React to render loading state
            await new Promise(r => setTimeout(r, 50));

            const doc = new jsPDF({ orientation, unit: 'px', compress: true });

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (i > 0) doc.addPage();

                let pageW, pageH;
                if (pageSize === 'fit') {
                    pageW = img.width + margin * 2;
                    pageH = img.height + margin * 2;
                    // Dynamically setting page size isn't officially supported safely in all pdfjs,
                    // but calling setPage using format arrays works, or manually via internal:
                    doc.setPage(i + 1);
                    // A little workaround for dynamic sizing per page
                    // Usually people do: new jsPDF({ format: [pageW, pageH] }) but for multi-page it's trickier
                    doc.internal.pageSize.width = pageW;
                    doc.internal.pageSize.height = pageH;
                } else {
                    // use jsPDF standard page sizes
                    // We need to ensure correct orientation or format if we wanted to change it mid-way,
                    // but we just stick to whatever internal size is currently set for the standard page
                    pageW = doc.internal.pageSize.getWidth();
                    pageH = doc.internal.pageSize.getHeight();
                }

                // scale image to fit within page minus margins
                const maxW = pageW - margin * 2;
                const maxH = pageH - margin * 2;
                const ratio = Math.min(maxW / img.width, maxH / img.height);
                const drawW = img.width * ratio;
                const drawH = img.height * ratio;
                const x = margin + (maxW - drawW) / 2;
                const y = margin + (maxH - drawH) / 2;

                // Auto-detect format from mime if possible, though 'JPEG' works for most canvas outputs
                // 'JPEG', 'PNG', 'WEBP'
                let imgFormat = 'JPEG';
                if (img.file.type === 'image/png') imgFormat = 'PNG';
                else if (img.file.type === 'image/webp') imgFormat = 'WEBP';

                doc.addImage(img.dataURL, imgFormat, x, y, drawW, drawH);

                setProgress(Math.round(((i + 1) / images.length) * 100));

                // Yield to event loop to update progress bar visually
                await new Promise(r => setTimeout(r, 0));
            }

            doc.save('zeroupload-merged.pdf');
            notify.success('✓ PDF saved successfully');
        } catch (error) {
            console.error(error);
            notify.error('Failed to generate PDF');
        } finally {
            setLoading(false);
            setProgress(0);
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
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 Input: JPG · PNG · WebP · BMP (multiple images)</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Output: PDF (single merged file)</span>
                </div>
            </div>

            <DropZone
                onFile={handleFiles}
                accept="image/*"
                multiple={true}
                label="Drag & drop images here"
            />

            {images.length > 0 && (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
                        <div className="bg-surface border border-border rounded p-5 flex flex-col gap-6">

                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Page Size</p>
                                <div className="flex flex-col gap-2">
                                    <div className="flex bg-bg rounded p-1 border border-border flex-wrap">
                                        {['fit', 'a4', 'letter', 'a3'].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setPageSize(s)}
                                                disabled={loading}
                                                className={`flex-1 px-2 py-1 text-sm rounded transition-colors disabled:opacity-50 min-w-16 ${pageSize === s ? 'bg-surface text-accent border border-accent/20' : 'text-subtle hover:text-text hover:bg-surface'
                                                    }`}
                                            >
                                                {s === 'fit' ? 'Fit to Image' : s.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Orientation</p>
                                <div className="flex bg-bg rounded p-1 border border-border">
                                    {['portrait', 'landscape'].map((o) => (
                                        <button
                                            key={o}
                                            onClick={() => setOrientation(o)}
                                            disabled={loading || pageSize === 'fit'}
                                            className={`flex-1 px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${orientation === o ? 'bg-surface text-accent border border-accent/20' : 'text-subtle hover:text-text hover:bg-surface'
                                                }`}
                                        >
                                            {o.charAt(0).toUpperCase() + o.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center text-xs font-mono mb-2">
                                    <span className="text-subtle uppercase">Margin</span>
                                    <span className="text-accent">{margin}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="40"
                                    step="1"
                                    value={margin}
                                    onChange={(e) => setMargin(Number(e.target.value))}
                                    disabled={loading}
                                    className="w-full"
                                />
                            </div>

                            <div className="h-[1px] bg-border w-full mt-auto"></div>

                            <div>
                                <div className="text-center font-mono text-xs text-subtle mb-3">
                                    {images.length} image(s) → 1 PDF
                                </div>

                                {loading ? (
                                    <div className="w-full">
                                        <ProgressBar value={progress} label="Generating..." />
                                    </div>
                                ) : (
                                    <button
                                        onClick={generatePDF}
                                        disabled={loading || images.length === 0}
                                        className="w-full flex justify-center items-center gap-2 bg-[#00ff88] text-[#0a0a0a] px-4 py-3 rounded font-medium text-sm hover:brightness-110 transition-all font-sans disabled:opacity-50"
                                    >
                                        <Download size={18} />
                                        Generate & Download PDF
                                    </button>
                                )}

                                <button
                                    onClick={() => setImages([])}
                                    disabled={loading}
                                    className="w-full mt-3 text-subtle text-sm underline hover:text-text disabled:opacity-50"
                                >
                                    Clear All Images
                                </button>
                            </div>

                        </div>
                    </div>

                    <div className="flex-1 bg-surface border border-border rounded overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-sans text-sm font-medium">Reorder Pages (Drag & Drop)</h3>
                        </div>
                        <div className="p-4 flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                            {images.map((img, idx) => (
                                <div
                                    key={img.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className={`flex items-center gap-4 bg-bg border rounded p-2 transition-colors cursor-move relative bg-bg hover:border-muted ${draggedIdx === idx ? 'opacity-50 border-accent' : 'border-border'}`}
                                >
                                    <div className="w-6 text-center font-mono text-xs text-subtle flex-shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div className="w-[60px] h-[60px] border border-border rounded overflow-hidden flex-shrink-0 bg-[#111]">
                                        <img
                                            src={img.dataURL}
                                            alt={img.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-mono text-sm truncate text-text" title={img.name}>{img.name}</p>
                                        <p className="font-mono text-xs text-subtle mt-1">{formatFileSize(img.size)} • {img.width}x{img.height}</p>
                                    </div>
                                    <button
                                        onClick={() => removeImage(img.id)}
                                        className="p-2 text-subtle hover:text-red-400"
                                        title="Remove"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
