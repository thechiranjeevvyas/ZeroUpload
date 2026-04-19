import { useState, useRef, useEffect } from 'react';
import exifr from 'exifr';
import { Copy, UploadCloud, Download, Image as ImageIcon, EyeOff, CheckCircle, AlertCircle, RefreshCw, Info, Check, X, ShieldAlert, Shield, ShieldCheck } from 'lucide-react';
import { saveAs } from 'file-saver';
import DropZone from '../components/DropZone';
import { notify } from '../components/Toast';

export default function Utilities() {
    const [activeTab, setActiveTab] = useState('base64'); // base64, metadata, colorpicker

    return (
        <div className="flex flex-col h-full bg-bg text-text">
            <div className="flex border-b border-border bg-surface px-6 pt-4 shrink-0 overflow-x-auto scrollbar-hide">
                {[
                    { id: 'base64', label: '🔤 Base64' },
                    { id: 'metadata', label: '🧹 Metadata' },
                    { id: 'colorpicker', label: '🎨 Color Picker' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 font-sans text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'border-accent text-accent bg-bg rounded-t'
                            : 'border-transparent text-subtle hover:text-text'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-6 custom-scrollbar">
                {activeTab === 'base64' && <Base64Tool />}
                {activeTab === 'metadata' && <MetadataTool />}
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
                <h2 className="text-lg font-sans font-bold mb-1 text-[#e8e8e8]">Base64 Encoder</h2>
                <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                    <span className="bg-surface border border-border px-2 py-1 rounded">📥 JPG · PNG · WebP</span>
                    <span className="text-accent">→</span>
                    <span className="bg-surface border border-border px-2 py-1 rounded">📤 Base64 string</span>
                </div>
                <p className="text-sm font-sans text-subtle mb-6">Convert any file to Base64 data URL string.</p>

                <DropZone onFile={handleFile} label="Drag & drop any file here" />
            </div>

            {result && (
                <div className="bg-surface border border-border rounded flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-[#161616]">
                        <div className="flex gap-4">
                            <span className="text-xs font-mono text-text bg-bg px-2 py-1 rounded border border-border truncate max-w-[150px]">{fileDetails.name}</span>
                            <span className="text-xs font-mono text-subtle bg-bg px-2 py-1 rounded border border-border">{Math.round(fileDetails.size / 1024)} KB</span>
                            <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-1 rounded border border-accent/20">{result.length.toLocaleString()} chars</span>
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
                            className="w-full h-64 bg-bg border border-border rounded p-4 text-xs font-mono text-subtle focus:text-text focus:border-accent outline-none resize-none custom-scrollbar"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function MetadataTool() {
    const [file, setFile] = useState(null);
    const [imgUrl, setImgUrl] = useState(null);
    
    const [parsedData, setParsedData] = useState(null);
    const [totalFields, setTotalFields] = useState(0);
    const [riskLevel, setRiskLevel] = useState(null); // { level, msg, icon, color, border }
    const [scanned, setScanned] = useState(false);
    
    const [selections, setSelections] = useState({
        location: true, camera: true, date: true, author: true, technical: true
    });
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [stripResult, setStripResult] = useState(null); // { originalSize, finalSize, fieldsRemoved }
    const [showPrivacyFooter, setShowPrivacyFooter] = useState(false);
    
    // Accordion state
    const [expanded, setExpanded] = useState({
        location: true, camera: true, date: true, properties: true, author: true, technical: true
    });

    const handleFile = async (f) => {
        setFile(f);
        setImgUrl(URL.createObjectURL(f));
        setScanned(false);
        setStripResult(null);
        setParsedData(null);
        setTotalFields(0);

        try {
            const data = await exifr.parse(f, { tiff: true, xmp: true, iptc: true, exif: true, gps: true });
            
            if (!data) {
                setScanned(true);
                return;
            }

            const categorized = {
                location: {
                    Latitude: data.latitude || data.GPSLatitude,
                    Longitude: data.longitude || data.GPSLongitude,
                    Altitude: data.GPSAltitude,
                    'Lat Ref': data.GPSLatitudeRef,
                    'Long Ref': data.GPSLongitudeRef
                },
                camera: {
                    Make: data.Make,
                    Model: data.Model,
                    'Lens Model': data.LensModel,
                    Software: data.Software,
                    'Firmware Version': data.Firmware
                },
                date: {
                    'Date Taken': data.DateTimeOriginal ? new Date(data.DateTimeOriginal).toLocaleString() : null,
                    'Date Modified': data.ModifyDate ? new Date(data.ModifyDate).toLocaleString() : null,
                    'Date Digitized': data.CreateDate ? new Date(data.CreateDate).toLocaleString() : null
                },
                properties: {
                    'Resolution X': data.XResolution,
                    'Resolution Y': data.YResolution,
                    'Resolution Unit': data.ResolutionUnit,
                    'Color Space': data.ColorSpace,
                    'Dimensions': data.ExifImageWidth && data.ExifImageHeight ? `${data.ExifImageWidth}x${data.ExifImageHeight}` : null,
                    'Orientation': data.Orientation
                },
                author: {
                    'Artist': data.Artist,
                    'Copyright': data.Copyright,
                    'Description': data.ImageDescription,
                    'User Comment': data.UserComment
                },
                technical: {
                    'ISO': data.ISO,
                    'Shutter Speed': data.ExposureTime,
                    'Aperture': data.FNumber,
                    'Exposure Mode': data.ExposureProgram,
                    'White Balance': data.WhiteBalance,
                    'Flash': data.Flash,
                    'Focal Length': data.FocalLength
                }
            };

            let foundFields = 0;
            const activeCats = {};
            
            Object.keys(categorized).forEach(catName => {
                const cat = categorized[catName];
                const keys = Object.keys(cat);
                keys.forEach(k => {
                    if (cat[k] === null || cat[k] === undefined || cat[k] === '') {
                        delete cat[k];
                    } else {
                        foundFields++;
                    }
                });
                
                const hasContents = Object.keys(cat).length > 0;
                activeCats[catName] = hasContents;
            });
            
            setExpanded(activeCats); // Expand if contains data, else collapse
            setScanned(true);

            if (foundFields === 0) {
                setParsedData(null);
                setRiskLevel(null);
                return;
            }

            setParsedData(categorized);
            setTotalFields(foundFields);

            if (activeCats.location) {
                setRiskLevel({ 
                    level: 'High Risk', 
                    color: 'text-red-500', 
                    bg: 'bg-red-500/10',
                    border: 'border-l-4 border-l-red-500', 
                    borderFull: 'border-red-500',
                    icon: <ShieldAlert className="text-red-500" />,
                    msg: 'This image contains your exact GPS coordinates. Anyone receiving this file can see where it was taken.' 
                });
            } else if (activeCats.camera || activeCats.author) {
                setRiskLevel({ 
                    level: 'Medium Risk', 
                    color: 'text-yellow-500', 
                    bg: 'bg-yellow-500/10',
                    border: 'border-l-4 border-l-yellow-500', 
                    borderFull: 'border-yellow-500',
                    icon: <Shield className="text-yellow-500" />,
                    msg: 'Device info or author details found. This can identify you or your equipment.' 
                });
            } else {
                setRiskLevel({ 
                    level: 'Low Risk', 
                    color: 'text-green-500',
                    bg: 'bg-green-500/10', 
                    border: 'border-l-4 border-l-green-500', 
                    borderFull: 'border-green-500',
                    icon: <ShieldCheck className="text-green-500" />,
                    msg: 'Only technical image properties found. Low privacy risk.' 
                });
            }

            setSelections({
                location: activeCats.location, 
                camera: activeCats.camera, 
                date: activeCats.date, 
                author: activeCats.author, 
                technical: activeCats.technical
            });

        } catch (err) {
            setScanned(true);
            setParsedData(null);
            console.error(err);
        }
    };

    const toggleAllSelections = (val) => {
        setSelections({ location: val, camera: val, date: val, author: val, technical: val });
    };
    
    const handleCheck = (key) => setSelections(prev => ({ ...prev, [key]: !prev[key] }));

    const anyUnchecked = Object.values(selections).some(v => v === false);

    const stripMetadata = () => {
        if (!imgUrl) return;
        setIsProcessing(true);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const outName = `${baseName}-clean.jpg`;
                saveAs(blob, outName);
                
                notify.success('✓ Clean image saved — 0 metadata fields');
                
                setStripResult({
                    originalSize: (file.size / 1024 / 1024).toFixed(2),
                    finalSize: (blob.size / 1024 / 1024).toFixed(2),
                    fieldsRemoved: totalFields
                });
                
                setIsProcessing(false);
            }, 'image/jpeg', 0.95);
        };
        img.src = imgUrl;
    };

    const toggleSection = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const SectionHeader = ({ title, objKey, alert }) => (
        <button 
            onClick={() => toggleSection(objKey)}
            className="w-full flex items-center justify-between p-3 bg-[#161616] border border-border hover:bg-[#1a1a1a] transition-colors rounded-t font-sans font-medium text-sm"
        >
            <div className="flex items-center gap-2">
                <span>{title}</span>
                {alert && <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10} /> Contains exact location</span>}
            </div>
            {expanded[objKey] ? <ChevronDown size={16} className="text-subtle" /> : <ChevronRight size={16} className="text-subtle" />}
        </button>
    );

    const SectionBody = ({ obj, objKey }) => {
        if (!expanded[objKey]) return null;
        if (!obj || Object.keys(obj).length === 0) {
            return (
                <div className="p-4 bg-bg border-x border-b border-border rounded-b text-xs font-mono text-subtle text-center italic">
                    Empty
                </div>
            )
        }
        return (
            <div className="bg-bg border-x border-b border-border rounded-b overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                    <tbody className="divide-y divide-[#1a1a1a]">
                        {Object.entries(obj).map(([k, v]) => (
                            <tr key={k} className="hover:bg-[#111]">
                                <td className="py-2 px-4 w-1/3 text-subtle font-medium border-r border-[#1a1a1a]">{k}</td>
                                <td className="py-2 px-4 text-text break-all">{v?.toString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    };

    return (
        <div className="flex flex-col gap-6 pb-12">
            <div className="bg-surface border border-border rounded-lg p-6 px-4 md:px-8">
                <div className="mb-6">
                    <h2 className="text-xl font-sans font-bold mb-2 flex items-center gap-2 text-[#e8e8e8]">
                        Image Metadata Cleaner
                    </h2>
                    <div className="flex items-center gap-2 text-xs font-mono text-subtle mb-3 flex-wrap">
                        <span className="bg-bg border border-[#2a2a2a] px-2 py-1 rounded text-[#00ff88]">📥 Input: JPG · PNG · WebP · TIFF · HEIC</span>
                        <span className="text-subtle">→</span>
                        <span className="bg-bg border border-[#2a2a2a] px-2 py-1 rounded text-[#00ff88]">📤 Output: Cleaned image with all metadata stripped</span>
                    </div>
                    <p className="text-sm font-sans text-subtle">
                        View embedded private metadata and strip it safely in seconds.
                    </p>
                </div>

                {!file ? (
                    <DropZone onFile={handleFile} accept="image/*" label="Drop an image here to scan for metadata" />
                ) : (
                    <div className="space-y-6">
                        {/* File Pills */}
                        <div className="flex items-center justify-between border border-border bg-bg p-4 rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-surface rounded overflow-hidden flex items-center justify-center border border-[#2a2a2a]">
                                    <img src={imgUrl} alt="preview" className="max-w-full max-h-full object-cover" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-mono text-text truncate max-w-[200px]">{file.name}</span>
                                    <span className="text-xs font-mono text-subtle bg-surface w-max px-1.5 py-0.5 rounded border border-[#1a1a1a]">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => { setFile(null); setParsedData(null); setStripResult(null); }} className="text-xs text-subtle hover:text-white px-3 py-1.5 border border-[#2a2a2a] rounded bg-surface hover:bg-[#222] transition-colors">
                                Pick Another
                            </button>
                        </div>

                        {scanned && !parsedData && (
                            <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 p-6 rounded-lg text-center flex flex-col items-center gap-2">
                                <CheckCircle size={32} className="text-[#00ff88]" />
                                <p className="text-[#00ff88] font-medium text-sm">No metadata found in this image. It is already clean.</p>
                            </div>
                        )}

                        {scanned && parsedData && !stripResult && (
                            <>
                                {/* Privacy Risk Score */}
                                <div className={`p-5 rounded-lg border bg-[#0a0a0a] ${riskLevel.border}`}>
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1">{riskLevel.icon}</div>
                                        <div className="flex flex-col gap-1">
                                            <span className={`font-sans font-bold uppercase tracking-wider text-sm ${riskLevel.color}`}>{riskLevel.level}</span>
                                            <span className="text-xs text-subtle leading-relaxed">{riskLevel.msg}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Metadata Sections */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex justify-between items-end mb-2">
                                        <h3 className="text-sm font-bold text-text uppercase tracking-wider">Found Metadata ({totalFields} fields)</h3>
                                    </div>
                                    
                                    <div className="space-y-0.5 shadow-sm">
                                        <SectionHeader title="📍 Location Data" objKey="location" alert={Object.keys(parsedData.location).length > 0} />
                                        <SectionBody obj={parsedData.location} objKey="location" />
                                    </div>
                                    
                                    <div className="space-y-0.5 shadow-sm">
                                        <SectionHeader title="📷 Camera & Device Info" objKey="camera" />
                                        <SectionBody obj={parsedData.camera} objKey="camera" />
                                    </div>
                                    
                                    <div className="space-y-0.5 shadow-sm">
                                        <SectionHeader title="📅 Date & Time" objKey="date" />
                                        <SectionBody obj={parsedData.date} objKey="date" />
                                    </div>
                                    
                                    <div className="space-y-0.5 shadow-sm">
                                        <SectionHeader title="🖼 Image Properties" objKey="properties" />
                                        <SectionBody obj={parsedData.properties} objKey="properties" />
                                    </div>
                                    
                                    <div className="space-y-0.5 shadow-sm">
                                        <SectionHeader title="👤 Author & Copyright" objKey="author" />
                                        <SectionBody obj={parsedData.author} objKey="author" />
                                    </div>
                                    
                                    <div className="space-y-0.5 shadow-sm">
                                        <SectionHeader title="⚙ Technical Settings" objKey="technical" />
                                        <SectionBody obj={parsedData.technical} objKey="technical" />
                                    </div>
                                </div>

                                {/* Removal Panel */}
                                <div className="bg-[#111] border border-border rounded-lg p-5 mt-8">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold">Metadata Removal Panel</h4>
                                        <button 
                                            onClick={() => toggleAllSelections(anyUnchecked)}
                                            className="text-xs text-[#00ff88] hover:underline"
                                        >
                                            {anyUnchecked ? 'Select All' : 'Deselect All'}
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                        {Object.keys(selections).map(key => (
                                            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-subtle hover:text-text transition-colors p-2 bg-[#1a1a1a] rounded border border-[#222] hover:border-[#333]">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selections[key]} 
                                                    onChange={() => handleCheck(key)}
                                                    className="w-4 h-4 accent-[#00ff88] bg-[#0a0a0a] border-[#333]"
                                                />
                                                <span className="capitalize">{key === 'technical' ? 'Technical Settings' : key + ' Data'}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {anyUnchecked && (
                                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded mb-4 flex items-start gap-2">
                                            <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-blue-200/70 leading-relaxed">
                                                <strong className="text-blue-300">Note:</strong> Selective metadata retention is not supported in browser-based processing. All metadata except selected categories will be removed. For selective retention, all metadata is fully stripped for privacy safety.
                                            </p>
                                        </div>
                                    )}

                                    <button 
                                        onClick={stripMetadata}
                                        disabled={isProcessing}
                                        className="w-full flex items-center justify-center gap-2 bg-[#00ff88] text-black px-4 py-3.5 rounded font-bold text-sm tracking-wider uppercase hover:bg-[#00e67a] transition-all font-sans disabled:opacity-50"
                                    >
                                        {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                                        Download Clean Image
                                    </button>
                                </div>
                            </>
                        )}
                        
                        {/* Comparison Card (After processing) */}
                        {stripResult && (
                            <div className="mt-6 bg-[#0a0a0a] border border-[#00ff88]/30 rounded-lg p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88] opacity-[0.03] blur-3xl rounded-full"></div>
                                <h3 className="text-[#00ff88] font-bold text-lg mb-6 flex items-center gap-2 relative z-10"><CheckCircle size={20} /> Success! Image is clean.</h3>
                                
                                <div className="grid grid-cols-2 gap-8 font-mono text-xs relative z-10">
                                    <div className="space-y-3 p-4 bg-[#111] rounded border border-[#1a1a1a]">
                                        <h4 className="text-subtle font-sans font-bold uppercase tracking-wider mb-2 pb-2 border-b border-[#222]">Before</h4>
                                        <div className="flex justify-between"><span className="text-[#666]">File size:</span> <span>{stripResult.originalSize} MB</span></div>
                                        <div className="flex justify-between"><span className="text-[#666]">Metadata:</span> <span>{stripResult.fieldsRemoved} fields</span></div>
                                        <div className="flex justify-between"><span className="text-[#666]">Location:</span> {parsedData && Object.keys(parsedData.location).length > 0 ? <span className="text-red-400">✓ Present</span> : <span className="text-[#444]">- None</span>}</div>
                                        <div className="flex justify-between"><span className="text-[#666]">Device:</span> {parsedData && Object.keys(parsedData.camera).length > 0 ? <span className="text-yellow-400">✓ Present</span> : <span className="text-[#444]">- None</span>}</div>
                                        <div className="flex justify-between"><span className="text-[#666]">Dates:</span> {parsedData && Object.keys(parsedData.date).length > 0 ? <span className="text-yellow-400">✓ Present</span> : <span className="text-[#444]">- None</span>}</div>
                                    </div>
                                    <div className="space-y-3 p-4 bg-[#111] rounded border border-[#1a1a1a]">
                                        <h4 className="text-[#00ff88] font-sans font-bold uppercase tracking-wider mb-2 pb-2 border-b border-[#222]">After</h4>
                                        <div className="flex justify-between"><span className="text-[#666]">File size:</span> <span className="text-[#e8e8e8]">{stripResult.finalSize} MB</span></div>
                                        <div className="flex justify-between"><span className="text-[#666]">Metadata:</span> <span className="text-[#00ff88]">0 fields</span></div>
                                        <div className="flex justify-between"><span className="text-[#666]">Location:</span> <span className="text-[#00ff88]">✗ Removed</span></div>
                                        <div className="flex justify-between"><span className="text-[#666]">Device:</span> <span className="text-[#00ff88]">✗ Removed</span></div>
                                        <div className="flex justify-between"><span className="text-[#666]">Dates:</span> <span className="text-[#00ff88]">✗ Removed</span></div>
                                    </div>
                                </div>
                                <div className="mt-6 text-center">
                                    <span className="bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 px-3 py-1.5 rounded-full text-xs font-mono">
                                        {stripResult.fieldsRemoved} metadata fields removed
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Privacy Footer */}
            <div className="max-w-5xl mx-auto w-full px-6 flex-shrink-0 mt-4">
                <div className="border border-[#1a1a1a] bg-[#0a0a0a] rounded-lg">
                    <button 
                        onClick={() => setShowPrivacyFooter(!showPrivacyFooter)}
                        className="w-full flex items-center justify-between p-4 text-xs font-medium text-subtle hover:text-[#e8e8e8] transition-colors"
                    >
                        <span className="flex items-center gap-2"><Info size={14} className="text-[#00ff88]" /> Why does metadata privacy matter?</span>
                        {showPrivacyFooter ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {showPrivacyFooter && (
                        <div className="p-4 pt-0 text-xs text-subtle space-y-3 border-t border-[#1a1a1a] mt-2 pt-4 bg-[#111] rounded-b-lg">
                            <div className="flex items-start gap-3">
                                <span className="text-xl">📍</span>
                                <p className="mt-0.5"><strong className="text-[#e8e8e8]">Location data</strong> in photos can reveal your home, workplace, or daily routine to anyone you send the image to.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xl">📷</span>
                                <p className="mt-0.5"><strong className="text-[#e8e8e8]">Device info</strong> can identify the exact phone or camera model you own.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xl">👤</span>
                                <p className="mt-0.5"><strong className="text-[#e8e8e8]">Author fields</strong> can contain your real name even if you post anonymously.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xl">📅</span>
                                <p className="mt-0.5"><strong className="text-[#e8e8e8]">Timestamps</strong> reveal when and how often you take photos.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
                    <h2 className="text-lg font-sans font-bold mb-1 text-[#e8e8e8]">Image Color Picker</h2>
                    <div className="flex items-center gap-2 text-xs font-mono text-subtle mt-1 mb-2 flex-wrap">
                        <span className="bg-surface border border-border px-2 py-1 rounded">📥 Any image</span>
                        <span className="text-accent">→</span>
                        <span className="bg-surface border border-border px-2 py-1 rounded">📤 HEX · RGB · HSL values</span>
                    </div>
                    <p className="text-sm font-sans text-subtle">Hover to preview, click to copy HEX.</p>
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
                                    <div className="w-12 h-12 rounded border border-border shadow-inner flex-shrink-0" style={{ backgroundColor: hoverColor.hex }} />
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

function ChevronDown({ size, className }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
}

function ChevronRight({ size, className }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
}
