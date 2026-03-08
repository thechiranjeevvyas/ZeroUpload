import { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

export default function DropZone({ onFile, accept, multiple = false, label = "Drag & drop files here" }) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (multiple) {
                onFile(Array.from(e.dataTransfer.files));
            } else {
                onFile(e.dataTransfer.files[0]);
            }
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files.length > 0) {
            if (multiple) {
                onFile(Array.from(e.target.files));
            } else {
                onFile(e.target.files[0]);
            }
        }
    };

    return (
        <div
            className={`relative flex flex-col items-center justify-center w-full min-h-[240px] border-2 border-dashed rounded cursor-pointer transition-colors duration-200
        ${isDragging ? 'border-accent bg-surface/50' : 'border-border bg-surface hover:border-muted'}
      `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                multiple={multiple}
                accept={accept}
                onChange={handleChange}
                className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-4 text-center p-6">
                <UploadCloud size={48} className={isDragging ? 'text-accent' : 'text-subtle'} />
                <div>
                    <p className="font-sans text-lg font-medium text-text mb-1">
                        {label}
                    </p>
                    <p className="font-mono text-sm text-subtle">
                        or click to browse from device
                    </p>
                </div>
            </div>
        </div>
    );
}
