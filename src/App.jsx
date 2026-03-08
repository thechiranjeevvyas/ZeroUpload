import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PdfToImage from './tools/PdfToImage';
import ConvertFormat from './tools/ConvertFormat';
import ResizeImage from './tools/ResizeImage';
import CompressImage from './tools/CompressImage';
import ImageToPdf from './tools/ImageToPdf';
import Watermark from './tools/Watermark';
import Utilities from './tools/Utilities';

const TOOL_COMPONENTS = {
    pdf: PdfToImage,
    convert: ConvertFormat,
    resize: ResizeImage,
    compress: CompressImage,
    img2pdf: ImageToPdf,
    watermark: Watermark,
    utilities: Utilities,
};

function App() {
    const [activeTool, setActiveTool] = useState('pdf');

    const ActiveComponent = TOOL_COMPONENTS[activeTool] || PdfToImage;

    return (
        <div className="flex h-screen overflow-hidden bg-bg text-text">
            <Sidebar activeTool={activeTool} onToolSelect={setActiveTool} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header activeTool={activeTool} />

                <main className="flex-1 overflow-hidden relative">
                    <ActiveComponent />
                </main>
            </div>

            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        borderRadius: '4px',
                        background: '#111111',
                        color: '#e8e8e8',
                        border: '1px solid #1a1a1a',
                        fontFamily: '"Space Mono", monospace',
                        fontSize: '14px',
                    },
                    success: {
                        iconTheme: {
                            primary: '#00ff88',
                            secondary: '#111111',
                        },
                    },
                }}
            />
        </div>
    );
}

export default App;
