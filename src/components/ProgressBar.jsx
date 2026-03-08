export default function ProgressBar({ value, label }) {
    const percentage = Math.min(100, Math.max(0, value || 0));

    return (
        <div className="w-full flex flex-col gap-2">
            <div className="h-1 w-full bg-[#1a1a1a] rounded overflow-hidden">
                <div
                    className="h-full bg-[#00ff88] rounded transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {label && (
                <div className="flex justify-between items-center text-xs font-mono text-[#666666]">
                    <span>{label}</span>
                    <span>{Math.round(percentage)}%</span>
                </div>
            )}
        </div>
    );
}
