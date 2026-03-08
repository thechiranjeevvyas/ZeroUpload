import { useState, useRef, useEffect } from 'react';
import exifr from 'exifr';
import { Copy, UploadCloud, Download, Image as ImageIcon, EyeOff } from 'lucide-react';
import { saveAs } from 'file-saver';
import DropZone from '../components/DropZone';
import { notify } from '../components/Toast';

export default function Utilities() {
    const [activeTab, setActiveTab] = useState('base64'); // base64, exif, colorpicker

    return (
        <div className="flex flex-col h-full bg-bg text-text">
            <div className="flex border-b border-border bg-surface px-6 pt-4 shrink-0">
                {[
                    { id: 'base64', label: 'Base64 Encoder' },
                    { id: 'exif', label: 'EXIF Reader & Stripper' },
                    { id: 'colorpicker', label: 'Image Color Picker' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 font-sans text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-accent text-accent bg-bg rounded-t'
                            : 'border-transparent text-subtle hover:text-text'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-6">
                {activeTab === 'base64' && <Base64Tool />}
                {activeTab === 'exif' && <ExifTool />}
                {activeTab === 'colorpicker' && <ColorPickerTool />}
            </div>
        </div>
    );
}

function Base64Tool() {
    const [result, setResult] = useState('');
    const [fileDetails, setFileDetails] = useState(null);

    const handleFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setResult(e.target.result);
            setFileDetails({
                name: file.name,
                type: file.type,
                size: file.size
            });
            notify.success('File encoded successfully');
        };
        reader.onerror = () => notify.error('Failed to read file');
        reader.readAsDataURL(file);
    };

    const copyToClipboard = () => {
        if (!result) return;
        navigator.clipboard.writeText(result)
            .then(() => notify.success('Copied to clipboard'))
            .catch(() => notify.error('Failed to copy'));
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-surface border border-border rounded p-6">
                <h2 className="text-lg font-sans font-medium mb-1">Base64 Encoder</h2>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 JPG · PNG · WebP</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Base64 string</span>
                </div>
                <p className="text-sm font-mono text-subtle mb-6">Convert any file to Base64 data URL string.</p>

                <DropZone onFile={handleFile} label="Drag & drop any file here" />
            </div>

            {result && (
                <div className="bg-surface border border-border rounded flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-[#161616]">
                        <div className="flex gap-4">
                            <span className="text-xs font-mono text-text bg-bg px-2 py-1 rounded border border-border">{fileDetails.name}</span>
                            <span className="text-xs font-mono text-subtle bg-bg px-2 py-1 rounded border border-border">{Math.round(fileDetails.size / 1024)} KB</span>
                            <span className="text-xs font-mono text-accent bg-bg/50 px-2 py-1 rounded border border-accent/20">{result.length.toLocaleString()} chars</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setResult(''); setFileDetails(null); }} className="px-3 py-1.5 text-xs text-subtle hover:text-text">
                                Clear
                            </button>
                            <button onClick={copyToClipboard} className="flex items-center gap-1.5 bg-[#00ff88] text-[#0a0a0a] px-3 py-1.5 rounded font-medium text-xs hover:brightness-110 transition-all font-sans">
                                <Copy size={14} /> Copy String
                            </button>
                        </div>
                    </div>
                    <div className="p-4 relative group">
                        <textarea
                            readOnly
                            value={result}
                            className="w-full h-64 bg-bg border border-border rounded p-4 text-xs font-mono text-subtle focus:text-text focus:border-accent outline-none resize-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ExifTool() {
    const [file, setFile] = useState(null);
    const [exif, setExif] = useState(null);
    const [imgUrl, setImgUrl] = useState(null);

    const handleFile = async (f) => {
        setFile(f);
        setImgUrl(URL.createObjectURL(f));

        try {
            const data = await exifr.parse(f);
            setExif(data || { info: "No EXIF data found in this image" });
            if (data) notify.success('EXIF metadata extracted');
            else notify.success('Scanned successfully, but no EXIF found');
        } catch (err) {
            setExif({ error: "Failed to parse EXIF data" });
            notify.error('Could not read EXIF data');
        }
    };

    const stripExif = () => {
        if (!imgUrl) return;
        notify.loading('Stripping EXIF data...');

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                notify.dismiss();
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                saveAs(blob, `${baseName}_stripped.jpg`);
                notify.success('Saved EXIF-free image');
            }, 'image/jpeg', 0.95);
        };
        img.src = imgUrl;
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-surface border border-border rounded p-6">
                <h2 className="text-lg font-sans font-medium mb-1">EXIF Reader & Stripper</h2>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 JPG (with metadata)</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Stripped JPG</span>
                </div>
                <p className="text-sm font-mono text-subtle mb-6">Extract metadata from JPG/TIFF files, and export a clean copy.</p>

                {!file && (
                    <DropZone onFile={handleFile} accept="image/jpeg, image/tiff" label="Drag & drop JPG here" />
                )}

                {file && (
                    <div className="flex items-center justify-between border border-border bg-bg p-4 rounded mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-surface rounded overflow-hidden flex items-center justify-center">
                                <img src={imgUrl} alt="preview" className="max-w-full max-h-full object-cover" />
                            </div>
                            <div>
                                <p className="text-sm font-sans font-medium text-text">{file.name}</p>
                                <p className="text-xs font-mono text-subtle">{Math.round(file.size / 1024)} KB</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => { setFile(null); setExif(null); setImgUrl(null); }} className="text-sm text-subtle hover:text-text underline">
                                Pick Another
                            </button>
                            <button onClick={stripExif} className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded font-bold text-sm hover:brightness-110 transition-all font-sans">
                                <EyeOff size={16} /> Strip EXIF & Download
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {exif && (
                <div className="bg-surface border border-border rounded overflow-hidden">
                    <div className="p-4 border-b border-border bg-[#161616]">
                        <h3 className="font-mono text-sm">Metadata Output</h3>
                    </div>
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs">
                            <tbody className="divide-y divide-border">
                                {Object.entries(exif).map(([key, value]) => {
                                    let displayValue = value;
                                    if (typeof value === 'object') displayValue = JSON.stringify(value);
                                    return (
                                        <tr key={key} className="hover:bg-bg/50">
                                            <td className="p-4 w-1/3 text-subtle">{key}</td>
                                            <td className="p-4 text-text break-all">{displayValue?.toString()}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function ColorPickerTool() {
    const [imgUrl, setImgUrl] = useState(null);
    const canvasRef = useRef(null);
    const [hoverColor, setHoverColor] = useState(null); // { r, g, b, hex, hsl }
    const [history, setHistory] = useState([]); // Array of strings (hex)
    const imgRef = useRef(null);

    const handleFile = (f) => {
        const url = URL.createObjectURL(f);
        setImgUrl(url);
    };

    useEffect(() => {
        if (!imgUrl) return;
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
            }
        };
        img.src = imgUrl;
    }, [imgUrl]);

    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');

    const rgbToHsl = (r, g, b) => {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    const readPixel = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        // Calculate click pos scaled to actual canvas resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Bounds check
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        if (rawX < 0 || rawY < 0 || rawX > rect.width || rawY > rect.height) return;

        const x = Math.round(rawX * scaleX);
        const y = Math.round(rawY * scaleY);

        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;

        if (pixel[3] === 0) return; // transparent
        const r = pixel[0], g = pixel[1], b = pixel[2];
        const hex = rgbToHex(r, g, b);
        const hsl = rgbToHsl(r, g, b);

        return { r, g, b, hex, hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` };
    };

    const handleMouseMove = (e) => {
        const color = readPixel(e);
        if (color) setHoverColor(color);
    };

    const handleMouseLeave = () => {
        setHoverColor(null);
    };

    const handleClick = (e) => {
        const color = readPixel(e);
        if (color) {
            navigator.clipboard.writeText(color.hex).then(() => {
                notify.success(`Copied ${color.hex}`);
                setHistory(prev => {
                    const arr = [color.hex, ...prev.filter(c => c !== color.hex)];
                    return arr.slice(0, 10);
                });
            });
        }
    };

    const copyHistoryColor = (hex) => {
        navigator.clipboard.writeText(hex).then(() => notify.success(`Copied ${hex}`));
    };

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-140px)]">
            <div className="bg-surface border border-border rounded p-6 shrink-0 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-sans font-medium mb-1">Image Color Picker</h2>
                    <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                        <span className="bg-surface border border-border px-2 py-1 rounded">📥 Any image</span>
                        <span className="text-accent">→</span>
                        <span className="bg-surface border border-border px-2 py-1 rounded">📤 HEX · RGB · HSL values</span>
                    </div>
                    <p className="text-sm font-mono text-subtle">Hover to preview, click to copy HEX.</p>
                </div>
                {history.length > 0 && (
                    <div className="flex gap-2">
                        {history.map(hex => (
                            <button
                                key={hex}
                                onClick={() => copyHistoryColor(hex)}
                                className="w-10 h-10 rounded border border-border shadow-sm group relative"
                                style={{ backgroundColor: hex }}
                            >
                                <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-surface text-text font-mono text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border shadow-md whitespace-nowrap">
                                    {hex}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!imgUrl ? (
                <DropZone onFile={handleFile} accept="image/*" label="Drop image to pick colors from" />
            ) : (
                <div className="flex-1 bg-surface border border-border rounded flex items-center justify-center relative overflow-hidden min-h-0 bg-[url('data:image/png;base64,...')] "
                    style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #1a1a1a 25%, #1a1a1a 75%, #111 75%, #111)',
                        backgroundPosition: '0 0, 10px 10px',
                        backgroundSize: '20px 20px',
                    }}
                >
                    <div className="absolute top-4 left-4 z-10 bg-bg/90 backdrop-blur p-4 rounded border border-border flex flex-col gap-2 min-w-[200px]">
                        {hoverColor ? (
                            <>
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 rounded border border-border shadow-inner" style={{ backgroundColor: hoverColor.hex }} />
                                    <div className="flex flex-col gap-1">
                                        <span className="font-mono text-accent text-sm font-bold">{hoverColor.hex}</span>
                                        <span className="font-mono text-xs text-subtle">Click to copy</span>
                                    </div>
                                </div>
                                <div className="h-px bg-border my-1 w-full" />
                                <span className="font-mono text-xs"><span className="text-subtle">RGB:</span> {hoverColor.r}, {hoverColor.g}, {hoverColor.b}</span>
                                <span className="font-mono text-xs"><span className="text-subtle">HSL:</span> {hoverColor.hsl}</span>
                            </>
                        ) : (
                            <span className="font-mono text-xs text-subtle text-center py-4">Hover over image</span>
                        )}
                    </div>

                    <button onClick={() => setImgUrl(null)} className="absolute top-4 right-4 z-10 bg-bg/80 backdrop-blur px-3 py-1.5 rounded border border-border text-xs font-sans hover:text-red-400 transition-colors">
                        Close Image
                    </button>

                    <div className="w-full h-full p-8 flex items-center justify-center cursor-crosshair overflow-auto">
                        <canvas
                            ref={canvasRef}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onClick={handleClick}
                            className="shadow-2xl max-w-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
