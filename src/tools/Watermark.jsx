import { useState, useEffect, useRef } from 'react';
import { Download, Type, Image as ImageIcon, Trash2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import DropZone from '../components/DropZone';
import { notify } from '../components/Toast';

const FORMATS = [
    { id: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
    { id: 'png', label: 'PNG', mime: 'image/png' },
    { id: 'webp', label: 'WebP', mime: 'image/webp' },
];

const POSITIONS = [
    { id: 'tl', label: 'top-left' }, { id: 'tc', label: 'top-center' }, { id: 'tr', label: 'top-right' },
    { id: 'ml', label: 'mid-left' }, { id: 'mc', label: 'mid-center' }, { id: 'mr', label: 'mid-right' },
    { id: 'bl', label: 'bottom-left' }, { id: 'bc', label: 'bottom-center' }, { id: 'br', label: 'bottom-right' },
];

export default function Watermark() {
    const [baseSrc, setBaseSrc] = useState(null);
    const [file, setFile] = useState(null);

    const [mode, setMode] = useState('text'); // text | image

    // Text state
    const [text, setText] = useState('ZeroUpload');
    const [fontSize, setFontSize] = useState(48);
    const [color, setColor] = useState('#ffffff');
    const [textOpacity, setTextOpacity] = useState(50);
    const [textPos, setTextPos] = useState('br');

    // Image state
    const [wmSrc, setWmSrc] = useState(null);
    const [wmSize, setWmSize] = useState(20); // % of base width
    const [wmOpacity, setWmOpacity] = useState(50);
    const [wmPos, setWmPos] = useState('br');

    const [format, setFormat] = useState(FORMATS[0]);

    const canvasRef = useRef(null);
    const baseImgRef = useRef(null);
    const wmImgRef = useRef(null);

    // Load base image
    const handleBaseFile = (f) => {
        setFile(f);
        const url = URL.createObjectURL(f);
        setBaseSrc(url);
        if (f.type === 'image/png') setFormat(FORMATS[1]);
        else if (f.type === 'image/webp') setFormat(FORMATS[2]);
    };

    // Load watermark image
    const handleWmFile = (f) => {
        const url = URL.createObjectURL(f);
        setWmSrc(url);
    };

    useEffect(() => {
        if (!baseSrc) return;
        const img = new Image();
        img.onload = () => {
            baseImgRef.current = img;
            renderCanvas();
        };
        img.src = baseSrc;
    }, [baseSrc]);

    useEffect(() => {
        if (!wmSrc) {
            wmImgRef.current = null;
            renderCanvas();
            return;
        }
        const img = new Image();
        img.onload = () => {
            wmImgRef.current = img;
            renderCanvas();
        };
        img.src = wmSrc;
    }, [wmSrc]);

    useEffect(() => {
        renderCanvas();
    }, [mode, text, fontSize, color, textOpacity, textPos, wmSize, wmOpacity, wmPos]);

    const renderCanvas = () => {
        requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            const baseImg = baseImgRef.current;
            if (!canvas || !baseImg) return;

            const ctx = canvas.getContext('2d');
            canvas.width = baseImg.width;
            canvas.height = baseImg.height;

            // Draw base
            ctx.globalAlpha = 1.0;
            if (format.id === 'jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(baseImg, 0, 0);

            // Draw Watermark
            const padding = Math.max(20, canvas.width * 0.02); // 2% padding

            const getCoords = (posId, itemW, itemH) => {
                let x = padding, y = padding;

                if (posId.includes('c')) x = (canvas.width - itemW) / 2;
                if (posId.includes('r')) x = canvas.width - itemW - padding;

                if (posId.includes('m')) y = (canvas.height - itemH) / 2;
                if (posId.includes('b')) y = canvas.height - itemH - padding;

                return { x, y };
            };

            if (mode === 'text' && text) {
                ctx.globalAlpha = textOpacity / 100;
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = color;
                ctx.textBaseline = 'top';

                const metrics = ctx.measureText(text);
                // Approximation of height since measureText height isn't standard in older browsers, 
                // but we can use font bounding box ascent+descent if needed. Em height is close enough.
                const itemH = fontSize;
                const itemW = metrics.width;

                const { x, y } = getCoords(textPos, itemW, itemH);

                // Outline for visibility
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = fontSize * 0.04; // 4% stroke
                ctx.strokeText(text, x, y);
                ctx.fillText(text, x, y);
            }
            else if (mode === 'image' && wmImgRef.current) {
                ctx.globalAlpha = wmOpacity / 100;
                const wmImg = wmImgRef.current;

                // Calculate size target
                const targetW = canvas.width * (wmSize / 100);
                const ratio = targetW / wmImg.width;
                const targetH = wmImg.height * ratio;

                const { x, y } = getCoords(wmPos, targetW, targetH);

                ctx.drawImage(wmImg, x, y, targetW, targetH);
            }

            ctx.globalAlpha = 1.0;
        });
    };

    const handleDownload = () => {
        if (!canvasRef.current) return;
        notify.loading('Generating watermarked image...');

        canvasRef.current.toBlob((blob) => {
            notify.dismiss();
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const filename = `${baseName}_watermarked.${format.id}`;
            saveAs(blob, filename);
            notify.success(`Saved ${filename}`);
        }, format.mime, 0.95);
    };

    const currentPos = mode === 'text' ? textPos : wmPos;
    const setPosition = mode === 'text' ? setTextPos : setWmPos;

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
            <div>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-4 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 Input: JPG · PNG · WebP</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Output: JPG · PNG · WebP</span>
                </div>
            </div>

            {!baseSrc && (
                <DropZone
                    onFile={handleBaseFile}
                    accept="image/*"
                    label="Upload base image for watermarking"
                />
            )}

            {baseSrc && (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-6">
                        <div className="bg-surface border border-border rounded p-5 flex flex-col gap-6">

                            <div className="flex bg-bg rounded p-1 border border-border">
                                <button
                                    onClick={() => setMode('text')}
                                    className={`flex-1 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 ${mode === 'text' ? 'bg-surface text-accent border border-accent/20 shadow-sm' : 'text-subtle hover:text-text'
                                        }`}
                                >
                                    <Type size={16} /> Text
                                </button>
                                <button
                                    onClick={() => setMode('image')}
                                    className={`flex-1 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 ${mode === 'image' ? 'bg-surface text-accent border border-accent/20 shadow-sm' : 'text-subtle hover:text-text'
                                        }`}
                                >
                                    <ImageIcon size={16} /> Image
                                </button>
                            </div>

                            {mode === 'text' && (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-xs text-subtle font-mono mb-2 uppercase block">Watermark Text</label>
                                        <input
                                            type="text"
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-sans focus:border-accent outline-none text-text transition-colors"
                                            placeholder="Enter watermark text"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center text-xs font-mono mb-2">
                                            <span className="text-subtle uppercase">Font Size</span>
                                            <span className="text-accent">{fontSize}px</span>
                                        </div>
                                        <input type="range" min="10" max="300" step="1" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center text-xs font-mono mb-2">
                                            <span className="text-subtle uppercase">Opacity</span>
                                            <span className="text-accent">{textOpacity}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" step="1" value={textOpacity} onChange={(e) => setTextOpacity(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-subtle font-mono mb-2 uppercase block">Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => setColor(e.target.value)}
                                                className="h-10 w-full rounded cursor-pointer border-0 p-0 bg-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {mode === 'image' && (
                                <div className="flex flex-col gap-4">
                                    {!wmSrc ? (
                                        <div className="border border-dashed border-border p-4 rounded text-center cursor-pointer hover:border-muted transition-colors" onClick={() => document.getElementById('wm-upload').click()}>
                                            <p className="text-sm font-sans text-text mb-1"><ImageIcon className="inline mr-2 text-subtle" size={16} />Upload Logo</p>
                                            <p className="text-xs font-mono text-subtle">PNG with transparency recommended</p>
                                            <input id="wm-upload" type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) handleWmFile(e.target.files[0]) }} className="hidden" />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 bg-bg p-3 rounded border border-border">
                                            <img src={wmSrc} alt="logo" className="h-10 w-10 object-contain bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAACVJREFUKFNjZCASMDKgAhgZGBj8/v//z4xL0P///0m2kmA+OQAA2gMHAeJ/fTMAAAAASUVORK5CYII=')]" />
                                            <div className="flex-1">
                                                <p className="text-xs font-sans text-text">Logo specificed</p>
                                            </div>
                                            <button onClick={() => setWmSrc(null)} className="text-subtle hover:text-red-400 p-1">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex justify-between items-center text-xs font-mono mb-2">
                                            <span className="text-subtle uppercase">Scale (% of width)</span>
                                            <span className="text-accent">{wmSize}%</span>
                                        </div>
                                        <input type="range" min="1" max="100" step="1" value={wmSize} onChange={(e) => setWmSize(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center text-xs font-mono mb-2">
                                            <span className="text-subtle uppercase">Opacity</span>
                                            <span className="text-accent">{wmOpacity}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" step="1" value={wmOpacity} onChange={(e) => setWmOpacity(Number(e.target.value))} />
                                    </div>
                                </div>
                            )}

                            <div className="h-[1px] bg-border w-full"></div>

                            <div>
                                <p className="text-xs text-subtle font-mono mb-3 uppercase">Position</p>
                                <div className="grid grid-cols-3 gap-2 max-w-[150px] mx-auto">
                                    {POSITIONS.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setPosition(p.id)}
                                            className={`h-10 rounded border transition-colors ${currentPos === p.id ? 'bg-surface border-accent' : 'bg-bg border-border hover:bg-surface'
                                                }`}
                                            title={p.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="h-[1px] bg-border w-full mt-auto"></div>

                            {/* Export Panel */}
                            <div>
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
                                    className="w-full flex justify-center items-center gap-2 bg-accent text-bg px-4 py-3 rounded font-bold text-sm hover:brightness-110 transition-all font-sans"
                                >
                                    <Download size={18} />
                                    Download Saved
                                </button>

                                <button
                                    onClick={() => { setBaseSrc(null); setFile(null); setWmSrc(null); }}
                                    className="w-full mt-3 text-subtle text-sm underline hover:text-text"
                                >
                                    Start Over
                                </button>
                            </div>

                        </div>
                    </div>

                    {/* Preview Canvas Area */}
                    <div className="flex-1 bg-surface border border-border rounded overflow-hidden flex flex-col relative min-h-[400px]">
                        <div className="absolute top-4 left-4 z-10 font-mono text-xs text-subtle uppercase bg-bg/80 px-2 py-1 rounded backdrop-blur border border-border">
                            Preview
                        </div>

                        <div className="flex-1 w-full h-full relative"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #1a1a1a 25%, #1a1a1a 75%, #111 75%, #111)',
                                backgroundPosition: '0 0, 10px 10px',
                                backgroundSize: '20px 20px',
                            }}>
                            <div className="absolute inset-0 flex items-center justify-center p-6">
                                <canvas
                                    ref={canvasRef}
                                    className="max-w-full max-h-full object-contain shadow-2xl"
                                    title="Watermark Preview"
                                />
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
