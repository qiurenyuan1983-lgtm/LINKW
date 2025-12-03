import React, { useState, useEffect, useRef } from 'react';
import { X, CameraOff } from 'lucide-react';

// This is a browser feature and might not be available on all browsers.
// We'll declare the type to satisfy TypeScript.
declare let BarcodeDetector: any;
interface BarcodeDetector {
  new(options?: { formats: string[] }): BarcodeDetector;
  detect(image: ImageBitmapSource): Promise<any[]>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const BarcodeScanner: React.FC<Props> = ({ isOpen, onClose, onScan, addNotification }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApiSupported, setIsApiSupported] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if ('BarcodeDetector' in window) {
      setIsApiSupported(true);
    } else {
      setError('Barcode Detector API is not supported in this browser.');
    }

    let animationFrameId: number;

    const startScan = async () => {
      if (!isApiSupported) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          const barcodeDetector = new BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13', 'upc_a'],
          });

          const detect = async () => {
            if (videoRef.current && videoRef.current.readyState === 4) { // HAVE_ENOUGH_DATA
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  onScan(barcodes[0].rawValue);
                  stopScan();
                } else {
                  animationFrameId = requestAnimationFrame(detect);
                }
              } catch (e) {
                 console.error("Barcode detection failed:", e);
                 animationFrameId = requestAnimationFrame(detect);
              }
            } else {
               animationFrameId = requestAnimationFrame(detect);
            }
          };
          detect();
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied. Please enable it in your browser settings.');
        } else {
          setError('Could not access camera. Is it being used by another app?');
        }
      }
    };

    const stopScan = () => {
      cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
    
    if (isOpen) {
      startScan();
    } else {
      stopScan();
    }

    return () => {
      stopScan();
    };
  }, [isOpen, isApiSupported, onScan, addNotification]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md m-4 p-4 flex flex-col items-center gap-4 relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-2 p-2 text-slate-500 hover:text-slate-800"><X size={20} /></button>
        <h3 className="text-lg font-bold text-slate-800">Scan Code</h3>
        <div className="w-full aspect-square bg-slate-200 rounded-lg overflow-hidden relative">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center">
                <CameraOff size={40} className="mb-2" />
                <p className="font-semibold">Scan Error</p>
                <p className="text-xs mt-1">{error}</p>
            </div>
          )}
          {/* Scanner overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2/3 h-2/3 border-4 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
          </div>
        </div>
        <p className="text-sm text-slate-500">Point your camera at a barcode or QR code.</p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
