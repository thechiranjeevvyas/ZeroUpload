import { useState, useEffect, useRef } from 'react';
import { Download, Lock, Unlock } from 'lucide-react';
import { saveAs } from 'file-saver';
import DropZone from '../components/DropZone';
import { notify } from '../components/Toast';

const FORMATS = [
    { id: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
    { id: 'png', label: 'PNG', mime: 'image/png' },
    { id: 'webp', label: 'WebP', mime: 'image/webp' },
];

const RATIOS = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '4:3', value: 4 / 3 },
    { label: '9:16', value: 9 / 16 },
    { label: '3:2', value: 3 / 2 },
];

const TEMPLATES = [
    { label: 'HD', w: 1280, h: 720 },
    { label: 'FHD', w: 1920, h: 1080 },
    { label: '4K', w: 3840, h: 2160 },
    { label: 'IG Post', w: 1080, h: 1080 },
    { label: 'IG Story', w: 1080, h: 1920 },
    { label: 'Twitter Banner', w: 1500, h: 500 },
    { label: 'YT Thumb', w: 1280, h: 720 },
    { label: 'LinkedIn', w: 1128, h: 376 },
];

export default function ResizeImage() {
    const [file, setFile] = useState(null);
    const [imgSrc, setImgSrc] = useState(null);

    const [origW, setOrigW] = useState(0);
    const [origH, setOrigH] = useState(0);

    const [targetW, setTargetW] = useState(0);
    const [targetH, setTargetH] = useState(0);

    const [locked, setLocked] = useState(true);
    const [activeRatio, setActiveRatio] = useState(null);
    const [format, setFormat] = useState(FORMATS[0]);

    const canvasRef = useRef(null);
    const imgRef = useRef(null); // Reference to the loaded HTMLImageElement

    const handleFile = (f) => {
        setFile(f);
        const url = URL.createObjectURL(f);
        setImgSrc(url);

        // Auto-detect format to set default if possible
        const ftype = f.type;
        if (ftype === 'image/png') setFormat(FORMATS[1]);
        else if (ftype === 'image/webp') setFormat(FORMATS[2]);
        else setFormat(FORMATS[0]);
    };

    useEffect(() => {
        if (!imgSrc) return;
        const img = new Image();
        img.onload = () => {
            setOrigW(img.width);
            setOrigH(img.height);
            setTargetW(img.width);
            setTargetH(img.height);
            imgRef.current = img;
            drawPreview();
        };
        img.src = imgSrc;
    }, [imgSrc]);

    useEffect(() => {
        // Redraw preview if target dimensions change
        // Using a simple debounce/raf if needed, but for preview it's fast enough
        if (imgRef.current) {
            drawPreview();
        }
    }, [targetW, targetH]);

    const drawPreview = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imgRef.current) return;
        const ctx = canvas.getContext('2d');

        // We cap preview canvas width to 400px maximum for display purposes
        // But maintain the exact target aspect ratio for preview layout
        const displayW = Math.min(400, targetW);
        const displayH = (targetH / targetW) * displayW;

        canvas.width = displayW;
        canvas.height = displayH;

        // Optional bg for png -> jpg previews
        if (format.id === 'jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw the image scaled to the canvas
        ctx.drawImage(imgRef.current, 0, 0, displayW, displayH);
    };

    const handleWChange = (val) => {
        const w = parseInt(val) || 0;
        setTargetW(w);
        if (locked && origW > 0) {
            // Calculate active ratio or original ratio
            const ratio = activeRatio || (origW / origH);
            setTargetH(Math.round(w / ratio));
        }
    };

    const handleHChange = (val) => {
        const h = parseInt(val) || 0;
        setTargetH(h);
        if (locked && origH > 0) {
            const ratio = activeRatio || (origW / origH);
            setTargetW(Math.round(h * ratio));
        }
    };

    const setRatio = (ratio) => {
        setActiveRatio(ratio);
        if (ratio) {
            setLocked(true);
            setTargetH(Math.round(targetW / ratio));
        }
    };

    const applyTemplate = (tpl) => {
        setTargetW(tpl.w);
        setTargetH(tpl.h);
        if (locked) {
            setLocked(false);
            setActiveRatio(null);
        }
    };

    const handleDownload = async () => {
        if (!imgRef.current) return;
        notify.loading('Resizing image...');

        // Real export processing
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetW;
        exportCanvas.height = targetH;
        const ctx = exportCanvas.getContext('2d');

        if (format.id === 'jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetW, targetH);
        }

        // Basic drawImage scaling
        ctx.drawImage(imgRef.current, 0, 0, targetW, targetH);

        exportCanvas.toBlob((blob) => {
            notify.dismiss();
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const filename = `${baseName}_${targetW}x${targetH}.${format.id}`;
            saveAs(blob, filename);
            notify.success(`Saved ${filename}`);
        }, format.mime, 0.9);
    };

    const clear = () => {
        setFile(null);
        setImgSrc(null);
        setOrigW(0);
        setOrigH(0);
        setTargetW(0);
        setTargetH(0);
        imgRef.current = null;
        setActiveRatio(null);
        setLocked(true);
    };

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
            <div>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-4 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 Input:  JPG · PNG · WebP · GIF · BMP</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Output: JPG · PNG · WebP</span>
                </div>
            </div>

            {!imgSrc && (
                <DropZone
                    onFile={handleFile}
                    accept="image/*"
                    label="Drag & drop an image here to resize"
                />
            )}

            {imgSrc && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Controls Sidebar */}
                    <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
                        <div className="bg-surface border border-border rounded p-5 flex flex-col gap-6">

                            {/* Dimensions Input */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs text-subtle font-mono uppercase">Dimensions (px)</p>
                                    <button
                                        onClick={() => setLocked(!locked)}
                                        className={`p-1 rounded hover:bg-bg transition-colors ${locked ? 'text-accent' : 'text-subtle'}`}
                                        title="Lock Aspect Ratio"
                                    >
                                        {locked ? <Lock size={14} /> : <Unlock size={14} />}
                                    </button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={targetW === 0 ? '' : targetW}
                                            onChange={(e) => handleWChange(e.target.value)}
                                            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono focus:border-accent outline-none text-text transition-colors"
                                            placeholder="W"
                                        />
                                    </div>
                                    <span className="text-subtle text-xs">×</span>
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={targetH === 0 ? '' : targetH}
                                            onChange={(e) => handleHChange(e.target.value)}
                                            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono focus:border-accent outline-none text-text transition-colors"
                                            placeholder="H"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-subtle font-mono mt-2">Original: {origW} × {origH}</p>
                            </div>

                            <div className="h-[1px] bg-border w-full"></div>

                            {/* Aspect Ratios */}
                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Aspect Ratio</p>
                                <div className="flex flex-wrap gap-2">
                                    {RATIOS.map(r => (
                                        <button
                                            key={r.label}
                                            onClick={() => setRatio(r.value)}
                                            className={`px-2 py-1 text-xs rounded border transition-colors ${(r.value === activeRatio) && (locked || r.value === null)
                                                ? 'bg-surface border-accent text-accent focus:outline-none'
                                                : 'bg-bg border-border text-subtle hover:text-text hover:border-[#333]'
                                                }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-[1px] bg-border w-full"></div>

                            {/* Preset Sizes */}
                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Quick Templates</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {TEMPLATES.map(t => (
                                        <button
                                            key={t.label}
                                            onClick={() => applyTemplate(t)}
                                            className="px-2 py-1.5 text-xs rounded bg-bg border border-border text-subtle hover:text-text hover:border-muted text-left flex justify-between items-center transition-colors group"
                                        >
                                            <span className="truncate mr-2">{t.label}</span>
                                            <span className="font-mono opacity-50 text-[10px] group-hover:opacity-100">{t.w}×{t.h}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-[1px] bg-border w-full"></div>

                            {/* Export Panel */}
                            <div>
                                <p className="text-xs text-subtle font-mono mb-2 uppercase">Output Format</p>
                                <div className="flex bg-bg rounded p-1 border border-border mb-4">
                                    {FORMATS.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFormat(f)}
                                            className={`flex-1 py-1 text-sm rounded transition-colors ${format.id === f.id ? 'bg-surface text-accent border border-accent/20 shadow-sm' : 'text-subtle hover:text-text hover:bg-surface'
                                                }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleDownload}
                                    disabled={targetW === 0 || targetH === 0}
                                    className="w-full flex justify-center items-center gap-2 bg-accent text-bg px-4 py-3 rounded font-bold text-sm hover:brightness-110 transition-all font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download size={18} />
                                    Download Image
                                </button>

                                <button
                                    onClick={clear}
                                    className="w-full mt-3 text-subtle text-sm underline hover:text-text"
                                >
                                    Clear Image
                                </button>
                            </div>

                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 bg-surface border border-border rounded overflow-hidden flex flex-col items-center justify-center p-6 relative">
                        <h3 className="absolute top-4 left-4 font-mono text-xs text-subtle uppercase">Canvas Preview</h3>

                        <div className="bg-[#1a1a1a] "
                            style={{
                                width: '100%',
                                maxWidth: '400px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                            }}>
                            {/* Chessboard background for transparency preview */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #1a1a1a 25%, #1a1a1a 75%, #111 75%, #111)',
                                    backgroundPosition: '0 0, 10px 10px',
                                    backgroundSize: '20px 20px',
                                    zIndex: 0
                                }}
                            />
                            <canvas
                                ref={canvasRef}
                                className="shadow-2xl z-10 block"
                                title="Preview"
                            />
                        </div>

                        <div className="absolute bottom-4 left-4 right-4 flex justify-between font-mono text-xs text-subtle">
                            <span>Preview size: ~{Math.min(400, targetW)}px</span>
                            <span>Export size: {targetW} × {targetH}px</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
