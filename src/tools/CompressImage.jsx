import { useState, useEffect, useRef } from 'react';
import { Download, Minus } from 'lucide-react';
import { saveAs } from 'file-saver';
import DropZone from '../components/DropZone';
import { notify } from '../components/Toast';

// Custom useDebounce hook as requested
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function CompressImage() {
    const [original, setOriginal] = useState(null); // { file, dataURL, size }
    const [compressed, setCompressed] = useState(null); // { blob, dataURL, size }
    const [quality, setQuality] = useState(75);
    const debouncedQuality = useDebounce(quality, 150);

    const imgRef = useRef(null);

    const handleFile = (f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setOriginal({
                file: f,
                dataURL: e.target.result,
                size: f.size
            });

            const img = new Image();
            img.onload = () => {
                imgRef.current = img;
                compressImage(img, 75); // initial compress
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(f);
    };

    useEffect(() => {
        if (imgRef.current && original) {
            compressImage(imgRef.current, debouncedQuality);
        }
    }, [debouncedQuality]);

    const compressImage = (imgElement, q) => {
        // Wrap heavy canvas op in requestAnimationFrame
        requestAnimationFrame(() => {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.width;
            canvas.height = imgElement.height;
            const ctx = canvas.getContext('2d');

            // Fill with white for JPEG compression of transparent images
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imgElement, 0, 0);

            const mimeType = 'image/jpeg'; // Compress to JPEG for lossy control
            const qualityRatio = q / 100;

            canvas.toBlob((blob) => {
                const previewUrl = URL.createObjectURL(blob);
                // Clean up old object url
                if (compressed && compressed.dataURL) {
                    URL.revokeObjectURL(compressed.dataURL);
                }
                setCompressed({
                    blob,
                    dataURL: previewUrl,
                    size: blob.size
                });
            }, mimeType, qualityRatio);
        });
    };

    const handleDownload = () => {
        if (!compressed || !compressed.blob) return;
        const baseName = original.file.name.substring(0, original.file.name.lastIndexOf('.')) || original.file.name;
        const filename = `${baseName}_compressed.jpg`;
        saveAs(compressed.blob, filename);
        notify.success(`Saved ${filename}`);
    };

    const clear = () => {
        setOriginal(null);
        if (compressed && compressed.dataURL) URL.revokeObjectURL(compressed.dataURL);
        setCompressed(null);
        setQuality(75);
        imgRef.current = null;
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getSavings = () => {
        if (!original || !compressed) return 0;
        const saving = ((original.size - compressed.size) / original.size) * 100;
        return Math.round(saving);
    };

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full">
            <div>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 Input:  JPG · PNG · WebP</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Output: JPG · PNG · WebP</span>
                </div>
                <p className="text-xs font-mono text-subtle mb-4">💡 Best compression achieved with JPG or WebP output</p>
            </div>

            {!original && (
                <DropZone
                    onFile={handleFile}
                    accept="image/jpeg, image/png, image/webp"
                    label="Drag & drop JPG, PNG, WebP here"
                />
            )}

            {original && compressed && (
                <div className="flex flex-col h-full gap-6">

                    {/* Controls Bar */}
                    <div className="bg-surface border border-border rounded p-4 flex flex-wrap gap-6 justify-between items-center shrink-0">
                        <div className="flex-1 max-w-[400px]">
                            <div className="flex justify-between items-center text-xs font-mono mb-2">
                                <span className="uppercase text-subtle">Compression Quality</span>
                                <span className="text-accent">{quality}%</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                step="5"
                                value={quality}
                                onChange={(e) => setQuality(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={clear}
                                className="text-subtle text-sm underline hover:text-text px-2 py-2"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 bg-accent text-bg px-5 py-2 rounded font-bold text-sm hover:brightness-110 transition-all font-sans"
                            >
                                <Download size={16} />
                                Download
                            </button>
                        </div>
                    </div>

                    {/* Side-by-Side Preview */}
                    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

                        {/* Original Card */}
                        <div className="flex-1 bg-surface border border-border rounded flex flex-col overflow-hidden relative">
                            <div className="p-3 border-b border-border flex justify-between items-center shrink-0">
                                <span className="font-sans text-sm font-medium">Original File</span>
                                <span className="font-mono text-xs text-subtle bg-bg px-2 py-1 rounded">{formatSize(original.size)}</span>
                            </div>
                            <div className="flex-1 relative bg-bg flex items-center justify-center p-4 overflow-hidden"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #1a1a1a 25%, #1a1a1a 75%, #111 75%, #111)',
                                    backgroundPosition: '0 0, 10px 10px',
                                    backgroundSize: '20px 20px',
                                }}
                            >
                                <img
                                    src={original.dataURL}
                                    alt="Original"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </div>

                        {/* Compressed Card */}
                        <div className="flex-1 bg-surface border-border border rounded flex flex-col overflow-hidden relative">
                            <div className="p-3 border-b border-border flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="font-sans text-sm font-medium">Compressed</span>
                                    {getSavings() > 0 && (
                                        <span className="flex items-center gap-0.5 text-[#00ff88] text-xs font-mono font-bold">
                                            <Minus size={12} strokeWidth={3} />
                                            {getSavings()}%
                                        </span>
                                    )}
                                    {getSavings() <= 0 && (
                                        <span className="text-red-400 text-xs font-mono font-bold">
                                            +{Math.abs(getSavings())}% larger!
                                        </span>
                                    )}
                                </div>
                                <span className={`font-mono text-xs px-2 py-1 rounded bg-bg ${getSavings() > 0 ? 'text-[#00ff88]' : 'text-subtle'}`}>
                                    {formatSize(compressed.size)}
                                </span>
                            </div>
                            <div className="flex-1 relative bg-bg flex items-center justify-center p-4 overflow-hidden"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #1a1a1a 25%, #1a1a1a 75%, #111 75%, #111)',
                                    backgroundPosition: '0 0, 10px 10px',
                                    backgroundSize: '20px 20px',
                                }}
                            >
                                <img
                                    src={compressed.dataURL}
                                    alt="Compressed"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
