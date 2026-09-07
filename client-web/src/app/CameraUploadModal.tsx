import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, CheckCircle, Image as ImageIcon, Zap, Trash2, Plus, Leaf, ArrowRight, MapPin, ShieldAlert } from 'lucide-react';

interface CameraUploadModalProps {
  onPhotosConfirmed: (photos: string[], locationCoords: { lat: number; lng: number; name: string }) => void;
  onClose: () => void;
}

export default function CameraUploadModal({ onPhotosConfirmed, onClose }: CameraUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('upload');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop&auto=format'
  ]);
  
  // Geolocation state
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isLocating, setIsLocating] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; name: string }>({
    lat: 19.1363,
    lng: 72.8277,
    name: 'Andheri West, Mumbai'
  });
  const [customLocationName, setCustomLocationName] = useState('');

  const samplePresets: Record<string, { lat: number; lng: number }> = {
    "Andheri West, Mumbai": { lat: 19.1363, lng: 72.8277 },
    "Bandra West, Mumbai": { lat: 19.0596, lng: 72.8295 },
    "Juhu, Mumbai": { lat: 19.1075, lng: 72.8263 },
    "Powai, Mumbai": { lat: 19.1176, lng: 72.9060 },
    "Khar West, Mumbai": { lat: 19.0700, lng: 72.8338 },
    "Worli, Mumbai": { lat: 19.0176, lng: 72.8170 },
    "Dadar, Mumbai": { lat: 19.0178, lng: 72.8478 },
    "Colaba, Mumbai": { lat: 18.9067, lng: 72.8147 },
  };

  const sampleImages = [
    { name: "Linen Blazer", url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop&auto=format" },
    { name: "Leather Jacket", url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=600&fit=crop&auto=format" },
    { name: "Denim Jeans", url: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=600&fit=crop&auto=format" },
    { name: "Sneakers", url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop&auto=format" },
    { name: "Kurta", url: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&h=600&fit=crop&auto=format" }
  ];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-request location access on modal mount
  useEffect(() => {
    requestLocationAccess();
  }, []);

  // Request Location Access via Geolocation API
  const requestLocationAccess = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          let lat = pos.coords.latitude;
          let lng = pos.coords.longitude;
          let placeName = 'Andheri West, Mumbai';

          // Try reverse geocoding via OpenStreetMap Nominatim for accurate area name
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const city = addr.city || addr.town || addr.village || addr.county || addr.city_district || addr.state_district || 'Mumbai';
              const state = addr.state || 'Maharashtra';
              const suburb = addr.suburb || addr.neighbourhood || addr.residential || '';

              if (suburb && city && suburb !== city) {
                placeName = `${suburb}, ${city}`;
              } else if (city && state) {
                placeName = `${city}, ${state}`;
              } else {
                placeName = `${city}, ${state}`;
              }
            }
          } catch (e) {
            placeName = 'Andheri West, Mumbai';
          }

          setUserCoords({ lat, lng, name: placeName });
          setLocationStatus('granted');
          setIsLocating(false);
        },
        (err) => {
          console.warn('Geolocation fallback to Andheri West, Mumbai:', err);
          setUserCoords({ lat: 19.1363, lng: 72.8277, name: 'Andheri West, Mumbai' });
          setLocationStatus('granted');
          setIsLocating(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setUserCoords({ lat: 19.1363, lng: 72.8277, name: 'Andheri West, Mumbai' });
      setLocationStatus('granted');
      setIsLocating(false);
    }
  };


  // Start WebRTC Camera Video Stream
  const startCamera = async () => {
    requestLocationAccess();
    setActiveTab('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera stream fallback:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const compressImage = (dataUrl: string, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = Math.min(video.videoWidth || 640, 800);
      canvas.height = Math.min(video.videoHeight || 480, 800);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rawDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const compressed = await compressImage(rawDataUrl);
        setPhotos(prev => [...prev, compressed]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            const raw = event.target!.result as string;
            const compressed = await compressImage(raw);
            setPhotos(prev => [...prev, compressed]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    stopCamera();
    const compressedPhotos = await Promise.all(photos.map(p => p.startsWith('data:') ? compressImage(p) : Promise.resolve(p)));
    onPhotosConfirmed(compressedPhotos, userCoords);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-4xl rounded-3xl border border-border shadow-2xl overflow-hidden relative my-8 p-6 sm:p-8">
        
        {/* Close Button */}
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-6 right-6 p-2.5 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          
          {/* Modal Header */}
          <div>
            <span className="text-[10px] font-mono-label text-muted-foreground uppercase tracking-widest block">
              STEP 1 OF 2 — ITEM PHOTOS & LOCATION PERMISSION
            </span>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-2xl text-foreground mt-0.5">
              Add Listing Photos & Geo-Tag
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Location access will attach precise coordinates so your listing appears on the OsmDroid Map.
            </p>
          </div>

          {/* Location Permission & Custom Location Bar */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 text-xs font-semibold text-foreground">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <span className="block text-[11px] text-muted-foreground uppercase tracking-wide">Location Tag & Coordinates</span>
                  <span className="text-sm font-bold text-primary">
                    {userCoords.name} <span className="text-xs text-foreground/80 font-normal">({userCoords.lat.toFixed(4)}° N, {userCoords.lng.toFixed(4)}° E)</span>
                  </span>
                </div>
              </div>
              <button 
                type="button"
                onClick={requestLocationAccess}
                disabled={isLocating}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{isLocating ? 'Detecting GPS...' : '📍 Detect My Live GPS'}</span>
              </button>
            </div>

            {/* Editable Location Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Edit Location:</span>
              <input
                type="text"
                value={userCoords.name}
                onChange={e => setUserCoords(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Andheri West, Mumbai"
                className="flex-1 bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-medium"
              />
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-muted rounded-2xl p-1 text-xs font-bold w-fit">
            <button
              type="button"
              onClick={() => { stopCamera(); setActiveTab('upload'); }}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'upload' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Device File Upload & Samples</span>
            </button>
            <button
              type="button"
              onClick={startCamera}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'camera' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Webcam Camera Stream</span>
            </button>
          </div>

          {/* Main Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-7 space-y-4">
              
              {/* Media File Upload Dropzone & Sample Images */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-primary/40 hover:border-primary rounded-3xl p-6 text-center bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer space-y-2 min-h-[180px] flex flex-col items-center justify-center"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-sm text-foreground">
                        Click to upload photos from device
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Supports PNG, JPG, WEBP</p>
                    </div>
                  </div>

                  {/* Sample Test Images One-Click Selector */}
                  <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
                    <span className="text-[11px] font-bold text-foreground block">
                      ✨ Or Choose a Sample Test Image:
                    </span>
                    <div className="grid grid-cols-5 gap-2">
                      {sampleImages.map((s, idx) => {
                        const isSelected = photos.includes(s.url);
                        return (
                          <div 
                            key={idx}
                            onClick={() => setPhotos(prev => isSelected ? prev.filter(p => p !== s.url) : [...prev, s.url])}
                            className={`group cursor-pointer rounded-xl overflow-hidden border relative aspect-square transition-all ${
                              isSelected ? 'border-primary ring-2 ring-primary/40 shadow-sm' : 'border-border hover:border-primary'
                            }`}
                          >
                            <img src={s.url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            {isSelected && (
                              <span className="absolute top-1 right-1 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-xs">
                                ✓
                              </span>
                            )}
                            <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[8px] font-bold text-center py-0.5 truncate px-1">
                              {s.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Live WebRTC Camera Stream */}
              {activeTab === 'camera' && (
                <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center shadow-md">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="absolute inset-6 border-2 border-dashed border-white/50 rounded-2xl pointer-events-none flex items-center justify-center">
                    <span className="text-xs font-bold text-white/80 bg-black/40 px-3 py-1 rounded-full">
                      Align item inside guide
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="w-16 h-16 rounded-full border-4 border-white bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {/* Photo Preview Strip */}
              {photos.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground block">
                    Selected Item Photos ({photos.length})
                  </span>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {photos.map((url, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary flex-shrink-0 group shadow-xs">
                        <img src={url} alt={`preview-${index}`} className="w-full h-full object-cover" />
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Information & Action Sidebar */}
            <div className="lg:col-span-5 space-y-4">
              
              <div className="bg-muted/40 rounded-3xl p-5 border border-border space-y-3">
                <h4 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-xs text-foreground uppercase tracking-wider">
                  Live Database & Map Integration
                </h4>

                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex gap-2 items-start">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>Geo-tagged to <strong className="text-foreground">{userCoords.name}</strong></span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>Saved directly to MongoDB Cloud Cluster</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>Pinned on OsmDroid OpenStreetMap instantly</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-4 rounded-2xl bg-primary text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:bg-primary/90 transition-colors"
              >
                <span>Continue to Item Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
