import { useState } from 'react';
import {
    FileText, Repeat, Maximize,
    Minimize, Image as ImageIcon, Droplet, Wrench, FileEdit, Link, ChevronDown, ChevronRight
} from 'lucide-react';

const PDF_TOOLS = [
    { id: 'pdfword', label: 'PDF & Word', icon: FileEdit },
    { id: 'mergepdf', label: 'Merge PDFs', icon: Link },
    { id: 'pdf', label: 'PDF to Image', icon: FileText },
];

const OTHER_TOOLS = [
    { id: 'convert', label: 'Convert Format', icon: Repeat },
    { id: 'resize', label: 'Resize Image', icon: Maximize },
    { id: 'compress', label: 'Compress Image', icon: Minimize },
    { id: 'img2pdf', label: 'Image to PDF', icon: ImageIcon },
    { id: 'watermark', label: 'Watermark', icon: Droplet },
    { id: 'utilities', label: 'Utilities', icon: Wrench },
];

export default function Sidebar({ activeTool, onToolSelect }) {
    const [isPdfOpen, setIsPdfOpen] = useState(true);

    const renderTool = (tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        return (
            <button
                key={tool.id}
                onClick={() => onToolSelect(tool.id)}
                className={`
                    snap-start flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded md:rounded-r-sm md:rounded-l-sm transition-colors whitespace-nowrap md:whitespace-normal w-full
                    ${isActive
                                        ? 'md:border-l-2 md:border-[#00ff88] text-[#00ff88] bg-[#161616] md:bg-opacity-100'
                                        : 'text-[#e8e8e8] md:border-l-2 md:border-transparent hover:bg-[#111111]'
                                    }
                `}
                title={tool.label}
            >
                <Icon size={20} className={isActive ? "text-[#00ff88]" : "text-[#666666]"} />
                <span className="font-sans font-medium text-sm hidden md:block text-left">{tool.label}</span>
            </button>
        );
    };

    return (
        <aside className="fixed bottom-0 left-0 w-full md:relative md:w-[250px] md:h-screen bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-[#1a1a1a] flex flex-row md:flex-col z-50">
            <div className="hidden md:flex items-center p-6 border-b border-[#1a1a1a]">
                <span className="font-mono font-bold text-xl text-[#e8e8e8]">
                    <span className="text-[#00ff88]">🔒</span> ZeroUpload
                </span>
            </div>

            <nav className="flex-1 overflow-x-auto md:overflow-y-auto w-full md:w-auto p-2 md:p-4 flex flex-row md:flex-col gap-1 md:gap-2 snap-x scrollbar-hide">
                
                {/* Desktop Dropdown for PDF Tools */}
                <div className="hidden md:flex flex-col gap-1 mb-2">
                    <button 
                        onClick={() => setIsPdfOpen(!isPdfOpen)}
                        className="flex items-center justify-between text-[#e8e8e8] font-medium text-xs tracking-wider uppercase px-4 py-2 hover:text-[#00ff88] bg-[#111111]/50 rounded transition-colors w-full text-left"
                    >
                        <span>PDF Tools</span>
                        {isPdfOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {isPdfOpen && (
                        <div className="flex flex-col gap-1 border-l border-[#1a1a1a] ml-4 mt-2 pl-2">
                            {PDF_TOOLS.map(renderTool)}
                        </div>
                    )}
                </div>

                {/* Mobile version - flat list for PDF tools so it scrolls horizontally well */}
                <div className="flex md:hidden gap-1 snap-x">
                   {PDF_TOOLS.map(renderTool)}
                </div>

                <div className="hidden md:block w-full h-px bg-[#1a1a1a] my-2"></div>

                {/* Other tools */}
                {OTHER_TOOLS.map(renderTool)}
            </nav>

            <div className="hidden md:block p-6 mt-auto border-t border-[#1a1a1a]">
                <p className="text-[#666666] text-xs font-mono select-none">
                    ⚡ Zero Upload.<br />Zero Server.<br />Zero Risk.
                </p>
            </div>
        </aside>
    );
}
