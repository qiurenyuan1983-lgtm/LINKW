import React, { useState, useEffect, useRef } from 'react';
import { X, CameraOff, Loader2 } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const BarcodeScanner: React.FC<Props> = ({ isOpen, onClose, onScan, addNotification }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        if (isScanningRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                isScanningRef.current = false;
            }).catch(console.error);
        } else {
            scannerRef.current.clear();
        }
      }
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const startScanner = async () => {
      // Wait for DOM element to be ready
      await new Promise(r => setTimeout(r, 100));
      if (!mounted) return;

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;

          // Prefer back camera
          const cameraId = devices[0].id; 
          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [ 
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.UPC_A
            ]
          };

          await scanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              if (mounted) {
                  onScan(decodedText);
                  // Optional: Close on successful scan?
                  // Currently we let the parent decide, but user experience suggests closing or beep.
              }
            },
            (errorMessage) => {
              // Ignore parse errors
            }
          );
          isScanningRef.current = true;
          if (mounted) setLoading(false);
        } else {
          if (mounted) {
              setError("No cameras found.");
              setLoading(false);
          }
        }
      } catch (err: any) {
        console.error(err);
        if (mounted) {
            setError("Camera error: " + (err.message || err));
            setLoading(false);
        }
      }
    };

    startScanner();

    return () => {
        mounted = false;
        if (scannerRef.current && isScanningRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
            }).catch(err => console.error("Failed to stop scanner", err));
            isScanningRef.current = false;
        }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-4 p-4 flex flex-col items-center gap-4 relative animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-2 p-2 text-slate-500 hover:text-slate-800 z-10 bg-white/50 rounded-full"><X size={20} /></button>
        <h3 className="text-lg font-bold text-slate-800">Scan Code</h3>
        
        <div className="w-full aspect-square bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
            {loading && !error && (
                <div className="absolute z-20 text-white flex flex-col items-center gap-2">
                    <Loader2 size={32} className="animate-spin" />
                    <span className="text-xs">Starting Camera...</span>
                </div>
            )}
            <div id="reader" className="w-full h-full"></div>
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center z-20 bg-black/80">
                    <CameraOff size={40} className="mb-2 text-red-400" />
                    <p className="text-sm text-red-200">{error}</p>
                </div>
            )}
        </div>
        <p className="text-sm text-slate-500 text-center">Point at a Location Label, Barcode or QR Code to search.</p>
      </div>
    </div>
  );
};

export default BarcodeScanner;