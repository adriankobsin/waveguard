import { useState, useRef } from "react";
import { Map, FileText, Image } from "lucide-react";
import { motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";

// Point pdfjs to its worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function renderPdfFirstPage(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({
        url: URL.createObjectURL(blob),
        name: file.name,
        width: viewport.width,
        height: viewport.height,
      });
    }, "image/png");
  });
}

export default function DeckMapUploader({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const processFile = async (file) => {
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const result = await renderPdfFirstPage(file);
        onUpload(result);
      } else if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
          onUpload({ url, name: file.name, width: img.naturalWidth, height: img.naturalHeight });
          setProcessing(false);
        };
        img.src = url;
        return;
      } else {
        setError("Unsupported file type. Please upload a PDF or image.");
      }
    } catch (err) {
      setError("Failed to process file: " + err.message);
    }
    setProcessing(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const loadDemo = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500">
      <rect width="1200" height="500" fill="#0a0f1c"/>
      <path d="M80,250 Q100,120 200,100 L950,100 Q1080,100 1140,200 Q1160,240 1140,280 Q1080,380 950,400 L200,400 Q100,380 80,250 Z" 
            fill="none" stroke="#1e3a5f" stroke-width="3"/>
      <line x1="200" y1="180" x2="980" y2="180" stroke="#1e3a5f" stroke-width="1.5" stroke-dasharray="8,4"/>
      <line x1="200" y1="320" x2="980" y2="320" stroke="#1e3a5f" stroke-width="1.5" stroke-dasharray="8,4"/>
      <rect x="200" y="105" width="160" height="70" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="280" y="145" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Bridge</text>
      <rect x="380" y="105" width="200" height="70" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="480" y="145" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Owners Deck</text>
      <rect x="600" y="105" width="180" height="70" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="690" y="145" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Sky Lounge</text>
      <rect x="800" y="105" width="150" height="70" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="875" y="145" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Sun Deck</text>
      <rect x="200" y="190" width="180" height="125" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="290" y="258" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Main Saloon</text>
      <rect x="400" y="190" width="140" height="125" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="470" y="258" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Dining</text>
      <rect x="560" y="190" width="140" height="125" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="630" y="258" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Cockpit</text>
      <rect x="720" y="190" width="120" height="125" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="780" y="258" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Aft Deck</text>
      <rect x="860" y="190" width="110" height="125" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="915" y="258" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Tender</text>
      <rect x="200" y="330" width="130" height="65" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="265" y="368" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Crew</text>
      <rect x="350" y="330" width="140" height="65" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="420" y="368" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Guest Cabins</text>
      <rect x="510" y="330" width="140" height="65" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="580" y="368" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Owner Cabin</text>
      <rect x="670" y="330" width="130" height="65" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="735" y="368" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Engine Room</text>
      <rect x="820" y="330" width="130" height="65" rx="4" fill="#0d1829" stroke="#1e4a7a" stroke-width="1.5"/>
      <text x="885" y="368" text-anchor="middle" fill="#4a7ab5" font-size="11" font-family="Inter,sans-serif">Tech Room</text>
      <circle cx="1120" cy="60" r="24" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>
      <text x="1120" y="45" text-anchor="middle" fill="#4a7ab5" font-size="10" font-family="Inter,sans-serif">N</text>
      <text x="1120" y="80" text-anchor="middle" fill="#4a7ab5" font-size="10" font-family="Inter,sans-serif">S</text>
      <text x="1095" y="65" text-anchor="middle" fill="#4a7ab5" font-size="10" font-family="Inter,sans-serif">W</text>
      <text x="1145" y="65" text-anchor="middle" fill="#4a7ab5" font-size="10" font-family="Inter,sans-serif">E</text>
      <text x="640" y="475" text-anchor="middle" fill="#2a4a7a" font-size="12" font-family="Inter,sans-serif" letter-spacing="4">M/Y HORIZON · DECK PLAN</text>
    </svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    onUpload({ url, name: "M/Y Horizon — Demo Deck Plan", width: 1200, height: 500 });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg text-center"
      >
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !processing && inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all ${
            dragging ? "border-cyan-500/60 bg-cyan-500/8" : "border-white/12 hover:border-cyan-500/30 hover:bg-white/2"
          } ${processing ? "cursor-wait opacity-70" : ""}`}
        >
          <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => processFile(e.target.files[0])} />
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
            {processing ? (
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Map size={28} className="text-cyan-400" />
            )}
          </div>
          <p className="text-base font-semibold text-white mb-1">
            {processing ? "Processing…" : "Upload Floor Plan"}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            Drop a PDF, PNG, JPG, or SVG of your vessel or property floor plan
          </p>
          <div className="flex items-center gap-3 justify-center text-xs text-slate-600">
            <span className="flex items-center gap-1"><FileText size={11} /> PDF</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Image size={11} /> PNG · JPG · SVG</span>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-slate-600">or</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>
        <button
          onClick={loadDemo}
          className="mt-4 w-full py-3 rounded-xl border border-cyan-500/25 bg-cyan-500/8 text-sm font-medium text-cyan-400 hover:bg-cyan-500/15 transition-colors"
        >
          Load M/Y Horizon Demo Plan
        </button>
      </motion.div>
    </div>
  );
}