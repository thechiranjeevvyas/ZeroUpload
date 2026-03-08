import {
    FileText, Repeat, Maximize,
    Minimize, Image as ImageIcon, Droplet, Wrench
} from 'lucide-react';

const TOOLS = [
    { id: 'pdf', label: 'PDF to Image', icon: FileText },
    { id: 'convert', label: 'Convert Format', icon: Repeat },
    { id: 'resize', label: 'Resize Image', icon: Maximize },
    { id: 'compress', label: 'Compress Image', icon: Minimize },
    { id: 'img2pdf', label: 'Image to PDF', icon: ImageIcon },
    { id: 'watermark', label: 'Watermark', icon: Droplet },
    { id: 'utilities', label: 'Utilities', icon: Wrench },
];

export default function Sidebar({ activeTool, onToolSelect }) {
    return (
        <aside className="fixed bottom-0 left-0 w-full md:relative md:w-[250px] md:h-screen bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-[#1a1a1a] flex flex-row md:flex-col z-50">
            <div className="hidden md:flex items-center p-6 border-b border-[#1a1a1a]">
                <span className="font-mono font-bold text-xl text-[#e8e8e8]">
                    <span className="text-[#00ff88]">🔒</span> ZeroUpload
                </span>
            </div>

            <nav className="flex-1 overflow-x-auto md:overflow-y-auto w-full md:w-auto p-2 md:p-4 flex flex-row md:flex-col gap-1 md:gap-2 snap-x scrollbar-hide">
                {TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = activeTool === tool.id;

                    return (
                        <button
                            key={tool.id}
                            onClick={() => onToolSelect(tool.id)}
                            className={`
                snap-start flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded md:rounded-r-sm md:rounded-l-sm transition-colors whitespace-nowrap md:whitespace-normal
                ${isActive
                                    ? 'md:border-l-2 md:border-[#00ff88] text-[#00ff88] bg-[#161616] md:bg-opacity-100'
                                    : 'text-[#e8e8e8] md:border-l-2 md:border-transparent hover:bg-[#111111]'
                                }
              `}
                            title={tool.label}
                        >
                            <Icon size={20} className={isActive ? "text-[#00ff88]" : "text-[#666666]"} />
                            <span className="font-sans font-medium text-sm hidden md:block">{tool.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="hidden md:block p-6 mt-auto border-t border-[#1a1a1a]">
                <p className="text-[#666666] text-xs font-mono select-none">
                    ⚡ Zero Upload.<br />Zero Server.<br />Zero Risk.
                </p>
            </div>
        </aside>
    );
}
