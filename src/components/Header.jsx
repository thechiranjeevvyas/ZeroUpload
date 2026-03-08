import { Github } from 'lucide-react';

const TOOL_NAMES = {
    pdf: 'PDF to Image Converter',
    convert: 'Universal Format Converter',
    resize: 'Smart Image Resizer',
    compress: 'Lossless & Lossy Compression',
    img2pdf: 'Image to PDF Converter',
    watermark: 'Add Watermark',
    utilities: 'Developer Mini Tools',
};

export default function Header({ activeTool }) {
    const toolName = TOOL_NAMES[activeTool] || 'ZeroUpload Tool';

    return (
        <header className="h-[72px] border-b border-border bg-bg flex items-center justify-between px-6 shrink-0">
            <h1 className="font-sans text-xl font-semibold tracking-wide text-text">
                {toolName}
            </h1>
            <a
                href="https://github.com/gamin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-subtle hover:text-text transition-colors"
                title="View Code on GitHub"
            >
                <Github size={20} />
            </a>
        </header>
    );
}
