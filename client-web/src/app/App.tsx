import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Heart, ShoppingBag, User, Home, MessageCircle,
  ChevronRight, ChevronLeft, Star, MapPin, Package,
  CheckCircle, ArrowRight, X, Plus, Minus,
  Bell, LogOut, Camera, SlidersHorizontal,
  RefreshCw, Leaf, Map as MapIcon, Grid3X3,
  Send, Image as ImageIcon, Zap, RotateCcw, Moon, Sun,
  Shield, HelpCircle, ChevronDown, Upload, Eye, EyeOff,
  AlertCircle, Menu, ExternalLink, TrendingUp, Recycle, MessageSquare, Repeat,
  Trash2, Edit3, Check, Tag, Award, Clock, Sparkles,
  Loader2, Navigation, Compass
} from "lucide-react";
import { 
  fetchProductsFromBackend, loginBackend, registerBackend, createListingBackend, 
  delistProductBackend, updateProductStatusBackend, fetchChatMessagesBackend, 
  sendChatMessageBackend, fetchUserChatThreadsBackend, deleteThreadBackend, 
  clearAllChatMessagesBackend, getCleanUserHandle, buildThreadKey, aiSemanticSearchBackend,
  fetchMarketplaceStatsBackend, fetchUserProfileBackend, updateUserProfileBackend
} from "./api";
import OpenStreetMapContainer, { defaultMapProducts, MapProduct } from "./OpenStreetMapContainer";
import CameraUploadModal from "./CameraUploadModal";

// ─── types ────────────────────────────────────────────────────────────────────

type Page = "home" | "discover" | "map" | "login" | "camera" | "listing_form" | "inbox" | "chat" | "profile" | "designguide";

interface Product {
  id: number; name: string; seller: string; sellerAvatar?: string; price: number;
  condition: "Brand New" | "Gently Used" | "Well Worn";
  type: "Sell" | "Exchange" | "Free/Donate";
  distance: string; image: string; images?: string[]; category: string;
  rating: number; reviews: number; description?: string;
  location?: string; lat?: number; lng?: number;
  sellerEmail?: string;
}

interface ChatThread {
  id: number; name: string; avatar: string;
  productThumb: string; productTitle: string; productPrice: number;
  lastMsg: string; time: string; unread: number;
}

interface Review {
  id: number; reviewer: string; avatar: string; rating: number; date: string; comment: string;
}

// ─── data ─────────────────────────────────────────────────────────────────────

const initialProducts: Product[] = [];

const mockReviews: Record<string, Review[]> = {};

const initialThreads: ChatThread[] = [];

const categories = ["All", "Tops", "Bottoms", "Footwear", "Ethnic", "Accessories", "Kids"];

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n === 0 ? "FREE" : `₹${n.toLocaleString("en-IN")}`;
const condColor: Record<string, string> = {
  "Brand New": "bg-emerald-100 text-emerald-700",
  "Gently Used": "bg-amber-100 text-amber-700",
  "Well Worn": "bg-orange-100 text-orange-700",
};
const typeColor: Record<string, string> = {
  "Sell": "bg-blue-100 text-blue-700",
  "Exchange": "bg-purple-100 text-purple-700",
  "Free/Donate": "bg-green-100 text-green-700",
};

// Helper to filter listings by user's city based on location string or coordinates
export function isProductInCity(p: Product, city?: string): boolean {
  if (!city || city.toLowerCase() === 'all') return true;
  const c = city.trim().toLowerCase();
  const loc = (p.location || '').toLowerCase();

  // 1. Direct text substring matching (bidirectional)
  if (loc.includes(c) || c.includes(loc)) return true;

  // 2. Vikasnagar is within Dehradun district / region
  if ((c === 'vikasnagar' || c === 'dehradun') && (loc.includes('vikasnagar') || loc.includes('dehradun'))) {
    return true;
  }

  // 3. Proximity check based on coordinates if available
  if (p.lat != null && p.lng != null) {
    if (c === 'vikasnagar') {
      const dLat = Math.abs(p.lat - 30.4035);
      const dLng = Math.abs(p.lng - 77.9340);
      return dLat < 0.35 && dLng < 0.35;
    }
    if (c === 'dehradun') {
      const dLat = Math.abs(p.lat - 30.3165);
      const dLng = Math.abs(p.lng - 78.0322);
      return (dLat < 0.6 && dLng < 0.6) || (Math.abs(p.lat - 30.4035) < 0.35 && Math.abs(p.lng - 77.9340) < 0.35);
    }
    if (c === 'mumbai') {
      const dLat = Math.abs(p.lat - 19.0760);
      const dLng = Math.abs(p.lng - 72.8777);
      return dLat < 0.6 && dLng < 0.6;
    }
    if (c === 'delhi') {
      const dLat = Math.abs(p.lat - 28.6139);
      const dLng = Math.abs(p.lng - 77.2090);
      return dLat < 0.6 && dLng < 0.6;
    }
    if (c === 'bangalore' || c === 'bengaluru') {
      const dLat = Math.abs(p.lat - 12.9716);
      const dLng = Math.abs(p.lng - 77.5946);
      return dLat < 0.6 && dLng < 0.6;
    }
  }
  return false;
}

// ─── TOP NAV ─────────────────────────────────────────────────────────────────

function TopNav({ page, onNav, darkMode, onToggleDark, unread, authUser, onLogout }: {
  page: Page; onNav: (p: Page, mode?: string) => void; darkMode: boolean; onToggleDark: () => void; unread: number;
  authUser: { name: string; email: string; avatar?: string | null } | null;
  onLogout: () => void;
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm shadow-xs">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        {/* logo */}
        <button onClick={() => onNav("home")} className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <RefreshCw size={16} className="text-white" />
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: "18px" }} className="text-foreground">ThreadSwap</span>
        </button>

        {/* search bar */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2">
            <Search size={15} className="text-muted-foreground flex-shrink-0" />
            <input placeholder="Search brands, items near you..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" style={{ fontFamily: "'Inter'" }} />
          </div>
        </div>

        {/* nav links */}
        <nav className="hidden md:flex items-center gap-1.5">
          <button onClick={() => onNav("discover", "grid")} className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${page === "discover" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} style={{ fontFamily: "'Inter'" }}>
            Discover
          </button>
          <button onClick={() => onNav("map", "map")} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${page === "map" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted/70 text-foreground hover:bg-muted"}`} style={{ fontFamily: "'Inter'" }}>
            <MapIcon size={15} className={page === "map" ? "text-white" : "text-primary"} />
            <span>OsmDroid Map</span>
          </button>
          <button onClick={() => onNav("inbox")} className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all relative flex items-center gap-1.5 ${page === "inbox" || page === "chat" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} style={{ fontFamily: "'Inter'" }}>
            <span>Messages</span>
            {unread > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded-full leading-none">
                {unread}
              </span>
            )}
          </button>
          <button onClick={() => onNav("camera")} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-all" style={{ fontFamily: "'Inter'" }}>
            List an Item
          </button>
        </nav>

        {/* right controls */}
        <div className="flex items-center gap-2 ml-auto md:ml-0">
          <button onClick={() => onNav("inbox")} className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
            <MessageCircle size={18} className="text-foreground" />
            {unread > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-card animate-pulse" />}
          </button>
          <button onClick={onToggleDark} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
            {darkMode ? <Sun size={18} className="text-foreground" /> : <Moon size={18} className="text-foreground" />}
          </button>

          {authUser ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden border border-primary/30 flex-shrink-0 bg-primary/20 flex items-center justify-center">
                  {authUser.avatar ? (
                    <img src={authUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-primary">
                      {authUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-foreground hidden md:block" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                  {authUser.name.split(' ')[0]}
                </span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-2xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-bold text-foreground">{authUser.name}</p>
                    <p className="text-[10px] text-muted-foreground">{authUser.email}</p>
                  </div>
                  <button onClick={() => { setShowUserMenu(false); onNav("profile"); }} className="w-full px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2">
                    <User size={13} className="text-primary" /> My Profile
                  </button>
                  <button onClick={() => { setShowUserMenu(false); onNav("inbox"); }} className="w-full px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={13} className="text-primary" /> Messages
                    </div>
                    {unread > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-red-500 text-white rounded-full">
                        {unread} NEW
                      </span>
                    )}
                  </button>
                  <div className="border-t border-border" />
                  <button onClick={() => { setShowUserMenu(false); onLogout(); }} className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => onNav("profile")} className="w-9 h-9 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&auto=format" alt="avatar" className="w-full h-full object-cover" />
              </button>
              <button onClick={() => onNav("login")} className="hidden md:flex px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold items-center gap-1.5 shadow-sm" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── SELLER PROFILE MODAL ────────────────────────────────────────────────────

function SellerProfileModal({ sellerName, sellerAvatar, products, onClose, onStartChat, authUser }: {
  sellerName: string; sellerAvatar?: string; products: Product[]; onClose: () => void; onStartChat: (seller: string, prod: Product) => void; authUser?: { name: string; email: string } | null;
}) {
  const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email || '').toLowerCase();
  const targetClean = getCleanUserHandle(sellerName).toLowerCase();
  const isOwnProfile = currentHandle && targetClean && currentHandle === targetClean;

  const sellerProducts = products.filter(p => {
    if (!p.seller) return false;
    const sClean = getCleanUserHandle(p.seller).toLowerCase();
    const sName = p.seller.toLowerCase();
    const sEmail = (p.sellerEmail || '').toLowerCase();
    return sClean === targetClean ||
           sName === targetClean ||
           sName.includes(targetClean) ||
           targetClean.includes(sName) ||
           sEmail === targetClean;
  });

  const reviews = mockReviews[sellerName] || [
    { id: 1, reviewer: "Ananya R.", avatar: "AR", rating: 5, date: "1 week ago", comment: "Item received in perfect condition. Great communication!" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-3xl rounded-3xl border border-border shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-primary text-primary-foreground relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-xl text-white shadow-md">
              {sellerAvatar || sellerName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-white">{sellerName}</h2>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield size={10} /> Verified Seller
                </span>
              </div>
              <p className="text-white/80 text-xs mt-0.5" style={{ fontFamily: "'Inter'" }}>📍 Andheri West, Mumbai · Member since 2025</p>
              <div className="flex items-center gap-1 mt-1 text-amber-300 text-xs font-bold">
                <Star size={13} className="fill-amber-300 text-amber-300" />
                <span>4.8 ({sellerProducts.length * 5 + 12} reviews)</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Seller's Listings */}
          <div>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-base text-foreground mb-3 flex items-center justify-between">
              <span>Listings by {sellerName}</span>
              <span className="text-xs font-normal text-muted-foreground">{sellerProducts.length} items active</span>
            </h3>

            {sellerProducts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-muted/40 border border-border text-center text-muted-foreground space-y-1">
                <Package size={24} className="mx-auto text-muted-foreground/60 mb-1" />
                <p className="text-xs font-bold text-foreground">No Active Listings Currently</p>
                <p className="text-[11px]">This seller has not posted any active listings on the marketplace yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sellerProducts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      if (!isOwnProfile) {
                        onClose();
                        onStartChat(sellerName, p);
                      }
                    }}
                    className={`bg-muted/40 rounded-xl p-2.5 border border-border transition-all group ${isOwnProfile ? "cursor-default" : "cursor-pointer hover:border-primary"}`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-muted">
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate" style={{ fontFamily: "'Plus Jakarta Sans'" }}>{p.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-primary">{fmt(p.price)}</span>
                      {!isOwnProfile ? (
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">CHAT</span>
                      ) : (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">YOUR ITEM</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seller Reviews */}
          <div className="border-t border-border pt-5">
            <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-base text-foreground mb-3">
              Ratings & Reviews ({reviews.length})
            </h3>

            <div className="space-y-3">
              {reviews.map(rev => (
                <div key={rev.id} className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                        {rev.avatar}
                      </div>
                      <span className="text-xs font-bold text-foreground">{rev.reviewer}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{rev.date}</span>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={11} className={i < rev.rating ? "fill-amber-400 text-amber-400" : "text-border"} />
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed pt-1" style={{ fontFamily: "'Inter'" }}>
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-border bg-card flex gap-3">
          <button 
            onClick={() => onStartChat(sellerName, sellerProducts[0] || products[0])}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-colors"
          >
            <MessageSquare size={15} /> Message Seller
          </button>
        </div>

      </motion.div>
    </div>
  );
}

// ─── PRODUCT DETAIL MODAL ────────────────────────────────────────────────────

function ProductDetailModal({ product, onClose, onStartChat, onViewSellerProfile, onDelistProduct, authUser }: {
  product: Product; 
  onClose: () => void; 
  onStartChat: (seller: string, prod: Product) => void; 
  onViewSellerProfile: (seller: string) => void;
  onDelistProduct?: (productId: number | string) => void;
  authUser?: { name: string; email: string } | null;
}) {
  const [delisting, setDelisting] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  const allImages: string[] = (product.images && product.images.length > 0)
    ? product.images
    : [product.image];
  const safeImgIndex = Math.min(Math.max(0, activeImgIndex), allImages.length - 1);
  const currentImg = allImages[safeImgIndex] || product.image;

  const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email || '').toLowerCase();
  const sellerHandle = getCleanUserHandle(product.seller || '').toLowerCase();
  const sellerEmail = (product.sellerEmail || '').toLowerCase();
  const userEmail = (authUser?.email || '').toLowerCase();
  const isOwnItem = (currentHandle && sellerHandle && (currentHandle === sellerHandle || currentHandle.includes(sellerHandle) || sellerHandle.includes(currentHandle))) || 
                    (userEmail && sellerEmail && userEmail === sellerEmail) ||
                    (userEmail && product.seller && userEmail.toLowerCase().startsWith(product.seller.toLowerCase())) ||
                    (sellerEmail && authUser?.name && sellerEmail.toLowerCase().startsWith(authUser.name.toLowerCase()));

  const handleDelist = () => {
    if (window.confirm(`Are you sure you want to delist "${product.name}"? It will be removed from the marketplace and map.`)) {
      setDelisting(true);
      if (onDelistProduct) {
        onDelistProduct(product.id);
      }
      onClose();
    }
  };

  const handlePurchaseAndDelist = () => {
    setPurchased(true);
    setTimeout(() => {
      if (onDelistProduct) {
        onDelistProduct(product.id);
      }
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden relative my-8">
        
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 backdrop-blur-sm text-foreground hover:bg-white transition-colors shadow-sm">
          <X size={18} />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Product Image & Gallery */}
          <div className="flex flex-col bg-muted/30 border-r border-border">
            <div className="aspect-[3/4] bg-muted relative overflow-hidden group">
              <img 
                src={currentImg} 
                alt={`${product.name} - view ${safeImgIndex + 1}`} 
                className="w-full h-full object-cover transition-all duration-300" 
              />
              
              <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${typeColor[product.type]}`}>{product.type.toUpperCase()}</span>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${condColor[product.condition]}`}>{product.condition}</span>
              </div>

              {/* Photo Counter Badge */}
              {allImages.length > 1 && (
                <div className="absolute top-3 right-12 z-10 bg-black/65 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <ImageIcon size={12} />
                  <span>{safeImgIndex + 1} / {allImages.length}</span>
                </div>
              )}

              {/* Prev / Next Arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImgIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 z-10 shadow-md"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImgIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 z-10 shadow-md"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}

              {purchased && (
                <div className="absolute inset-0 bg-emerald-600/90 flex flex-col items-center justify-center text-white p-6 text-center z-20">
                  <CheckCircle size={48} className="animate-bounce mb-2" />
                  <h3 className="text-xl font-bold">Item Purchased!</h3>
                  <p className="text-xs opacity-90 mt-1">Listing has been delisted from the marketplace & map.</p>
                </div>
              )}
            </div>

            {/* Thumbnail Strip for multiple images */}
            {allImages.length > 1 && (
              <div className="p-3 bg-card border-t border-border flex gap-2 overflow-x-auto">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImgIndex(idx)}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                      safeImgIndex === idx 
                        ? 'border-primary ring-2 ring-primary/40 scale-105 shadow-sm' 
                        : 'border-border hover:border-primary/50 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[9px] font-bold text-center py-0.5">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info & Actions */}
          <div className="p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{product.category}</span>
                <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-2xl text-foreground mt-0.5">{product.name}</h2>
                <span className={`text-2xl font-extrabold block mt-1 ${product.price === 0 ? "text-primary" : "text-foreground"}`}>{fmt(product.price)}</span>
              </div>

              {/* Seller Card Banner */}
              <div 
                onClick={() => onViewSellerProfile(product.seller)}
                className="p-3 rounded-2xl bg-muted/50 border border-border flex items-center justify-between cursor-pointer hover:border-primary transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shadow-xs">
                    {product.sellerAvatar || product.seller.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{product.seller} {isOwnItem ? "(You)" : ""}</h4>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Star size={10} className="fill-amber-400 text-amber-400" /> 4.8 ({product.reviews} reviews)
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-primary flex items-center gap-0.5">
                  Profile <ChevronRight size={12} />
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed" style={{ fontFamily: "'Inter'" }}>
                {product.description || "Authentic pre-loved fashion piece in great condition. Available for instant buy or local swap."}
              </p>

              <div className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                <MapPin size={13} className="text-primary" />
                <span>{product.location || "Nearby"} ({product.distance})</span>
              </div>
            </div>

            {/* Direct Action Buttons */}
            {isOwnItem ? (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <p className="text-xs font-bold text-primary">🏷️ Your Listed Item</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">You are the seller of this item. Manage or delist it anytime.</p>
                </div>
                <button 
                  onClick={handleDelist}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} /> Delist / Remove Your Item
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-border">
                <button 
                  onClick={() => onStartChat(product.seller, product)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-colors"
                >
                  <MessageSquare size={16} /> Chat & Buy from Seller
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handlePurchaseAndDelist}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Check size={14} /> Buy & Delist
                  </button>

                  <button 
                    onClick={handleDelist}
                    className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={14} /> Delist Item
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </motion.div>
    </div>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────

function ProductCard({ p, wishlisted, onWishlist, onClickProduct, aiScore }: {
  p: Product; wishlisted: boolean; onWishlist: () => void; onClickProduct: (p: Product) => void; aiScore?: number;
}) {
  return (
    <motion.div 
      whileHover={{ y: -3 }} 
      onClick={() => onClickProduct(p)}
      className="bg-card rounded-2xl overflow-hidden border border-border cursor-pointer group shadow-xs hover:shadow-md transition-all"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 bg-muted" />
        {aiScore !== undefined && aiScore >= 0.25 && (
          <div className="absolute top-3 right-3 z-10 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
            <Sparkles size={10} />
            <span>{Math.round(aiScore * 100)}% Match</span>
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }} className={`absolute ${aiScore ? "top-10" : "top-3"} right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
          <Heart size={14} className={wishlisted ? "fill-red-500 text-red-500" : "text-foreground"} />
        </button>
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${typeColor[p.type]}`} style={{ fontFamily: "'Inter'" }}>{p.type.toUpperCase()}</span>
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${condColor[p.condition]}`} style={{ fontFamily: "'Inter'" }}>{p.condition}</span>
          </div>
          {p.images && p.images.length > 1 && (
            <div className="absolute bottom-2.5 right-2.5 z-10 bg-black/65 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
              <ImageIcon size={10} />
              <span>{p.images.length}</span>
            </div>
          )}
        </div>
      <div className="p-3.5">
        <p className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: "'Plus Jakarta Sans'" }}>{p.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Inter'" }}>{p.seller}</p>
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-base font-bold ${p.price === 0 ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "'Plus Jakarta Sans'" }}>{fmt(p.price)}</span>
          <div className="flex items-center gap-1">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'Inter'" }}>{p.rating} ({p.reviews})</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin size={10} className="text-primary" />
          <span className="text-[10px] text-muted-foreground truncate" style={{ fontFamily: "'Inter'" }}>{p.location || "Nearby"}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────

function HomePage({ 
  productsList, 
  onNav, 
  onClickProduct,
  activeCity = "Mumbai",
  onSelectCity
}: { 
  productsList: Product[]; 
  onNav: (p: Page, mode?: string) => void; 
  onClickProduct: (p: Product) => void;
  activeCity?: string;
  onSelectCity?: (city: string) => void;
}) {
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [liveStats, setLiveStats] = useState({
    itemsSaved: "5",
    activeUsers: "14",
    citiesCovered: "1 City"
  });

  useEffect(() => {
    fetchMarketplaceStatsBackend().then(res => {
      if (res) {
        setLiveStats({
          itemsSaved: String(res.itemsSaved),
          activeUsers: String(res.activeUsers),
          citiesCovered: `${res.citiesCovered} ${res.citiesCovered === 1 ? "City" : "Cities"}`
        });
      }
    });
  }, [productsList.length]);

  const stats = [
    { icon: <Recycle size={22} />, val: liveStats.itemsSaved, label: "Items Saved" },
    { icon: <TrendingUp size={22} />, val: liveStats.activeUsers, label: "Active Users" },
    { icon: <MapPin size={22} />, val: liveStats.citiesCovered, label: "Cities Covered" },
  ];

  // Filter listings based strictly on the user's active city / address
  const featuredProducts = productsList.filter(p => isProductInCity(p, activeCity));

  return (
    <div className="bg-background min-h-screen">
      {/* Hero Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600&h=700&fit=crop&auto=format" alt="hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C201A]/90 via-[#1C201A]/60 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1.5 mb-5">
              <Leaf size={14} className="text-[#E8D8C8]" />
              <span className="text-[#E8D8C8] text-xs font-semibold" style={{ fontFamily: "'Inter'" }}>Sustainable Fashion Marketplace</span>
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, lineHeight: 1.1 }} className="text-5xl text-white mb-5">
              Give Clothes<br />
              <span style={{ color: "#E8D8C8" }}>a Second Life.</span>
            </h1>
            <p className="text-white/80 text-base leading-relaxed mb-8" style={{ fontFamily: "'Inter'" }}>
              Buy, sell, and exchange pre-loved fashion with people near you. Thrift smarter, live greener.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => onNav("discover", "grid")} style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="px-7 py-3.5 bg-primary text-primary-foreground rounded-xl text-sm uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-primary/90 transition-colors">
                Browse Items <ArrowRight size={16} />
              </button>
              <button onClick={() => onNav("map", "map")} style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="px-7 py-3.5 bg-white/15 backdrop-blur-sm border border-white/30 text-white rounded-xl text-sm uppercase tracking-widest hover:bg-white/25 transition-colors flex items-center gap-2">
                <MapIcon size={16} /> Explore OsmDroid Map
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Impact Stats Bar (3 Dynamic Metrics, Carbon Emission Removed) */}
      <section className="bg-primary shadow-inner">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.map(s => (
            <div key={s.label} className="flex items-center justify-center sm:justify-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white flex-shrink-0 shadow-xs">{s.icon}</div>
              <div>
                <p style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-white text-2xl leading-tight">{s.val}</p>
                <p className="text-white/80 text-xs font-medium" style={{ fontFamily: "'Inter'" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Browse All Items Banner */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-4">
        <div className="rounded-3xl bg-gradient-to-r from-card via-muted/30 to-card border border-border p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">
              <ShoppingBag size={13} />
              <span>Full Marketplace Catalog</span>
            </div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-2xl text-foreground tracking-tight">
              Browse All Items
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl" style={{ fontFamily: "'Inter'" }}>
              Explore every pre-loved piece, exchange offer, and donation available across all categories and verified members.
            </p>
          </div>
          <button
            onClick={() => onNav("discover")}
            style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }}
            className="px-6 py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-bold flex items-center gap-2.5 shadow-md hover:bg-primary/90 transition-all hover:gap-3 flex-shrink-0"
          >
            <span>Browse All Items</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Featured Grid (Filtered by Active Address City) */}
      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-xl text-foreground">Featured Near You</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1">
                <MapPin size={11} /> {activeCity}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Inter'" }}>
              Showing listings strictly in your registered location ({featuredProducts.length} items found)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNav("discover")}
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 mr-2 px-3 py-1.5 rounded-xl border border-primary/20 hover:bg-primary/5 transition-all"
            >
              <span>Browse All Items</span>
              <ChevronRight size={13} />
            </button>
            <span className="text-xs font-semibold text-muted-foreground">Marketplace City:</span>
            <select 
              value={activeCity} 
              onChange={e => onSelectCity && onSelectCity(e.target.value)} 
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none cursor-pointer focus:border-primary shadow-xs"
            >
              {Array.from(new Set([
                activeCity,
                ...productsList.map(p => p.location ? p.location.split(',')[0].trim() : '').filter(Boolean),
                'All'
              ])).map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Cities' : (c === activeCity ? `${c} (Selected)` : c)}</option>
              ))}
            </select>
          </div>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="p-10 rounded-3xl bg-muted/40 border border-border text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <MapPin size={24} />
            </div>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-base text-foreground">
              No Listings in {activeCity}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              No active listings currently found in <strong>{activeCity}</strong>. Because listings are tailored to local pick-ups, items from other cities are hidden.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button 
                onClick={() => onSelectCity && onSelectCity("All")} 
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-colors"
              >
                Explore All Cities ({productsList.length} items)
              </button>
              <button 
                onClick={() => onNav("camera")} 
                className="px-4 py-2 bg-card border border-border text-foreground text-xs font-bold rounded-xl hover:bg-muted transition-colors"
              >
                List First Item in {activeCity}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map(p => (
              <ProductCard 
                key={p.id} 
                p={p} 
                wishlisted={wishlist.includes(p.id)} 
                onWishlist={() => setWishlist(w => w.includes(p.id) ? w.filter(i => i !== p.id) : [...w, p.id])} 
                onClickProduct={onClickProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-3xl text-foreground mb-2">How ThreadSwap Works</h2>
            <p className="text-muted-foreground text-sm" style={{ fontFamily: "'Inter'" }}>Three simple steps to a greener wardrobe</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", icon: <Camera size={28} />, title: "Photograph & List", desc: "Snap photos of items you no longer need. Fill in a quick form — condition, price, pickup location — and go live in minutes." },
              { step: "02", icon: <MessageCircle size={28} />, title: "Chat & Negotiate", desc: "Buyers message you directly. Agree on a price, arrange a nearby exchange, or donate freely to your community." },
              { step: "03", icon: <Leaf size={28} />, title: "Exchange & Impact", desc: "Meet up safely for the handoff. Every exchange keeps textiles out of landfill and earns you EcoSaver points." },
            ].map(s => (
              <div key={s.step} className="bg-card rounded-2xl border border-border p-6 relative overflow-hidden">
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: "48px", color: "rgba(196,98,18,0.07)", lineHeight: 1 }} className="absolute top-4 right-5">{s.step}</span>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">{s.icon}</div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-foreground text-lg mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed" style={{ fontFamily: "'Inter'" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center"><RefreshCw size={14} className="text-white" /></div>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-foreground">ThreadSwap</span>
            <span className="text-muted-foreground text-xs" style={{ fontFamily: "'Inter'" }}>· Sustainable fashion marketplace</span>
          </div>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Inter'" }}>© 2026 ThreadSwap. Thrift. Exchange. Sustain.</p>
        </div>
      </footer>
    </div>
  );
}

// ─── DISCOVER PAGE (GRID & OSMODROID OPENSTREETMAP VIEW) ──────────────────────

function DiscoverPage({ 
  productsList, 
  initialView = "grid", 
  onClickProduct,
  activeCity = "Mumbai",
  onSelectCity
}: { 
  productsList: Product[]; 
  initialView?: "grid" | "map"; 
  onClickProduct: (p: Product) => void;
  activeCity?: string;
  onSelectCity?: (city: string) => void;
}) {
  const [view, setView] = useState<"grid" | "map">(initialView);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [conditions, setConditions] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [maxPriceFilter, setMaxPriceFilter] = useState(5000);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [sort, setSort] = useState("Price: Low→High");

  // AI Semantic Search State
  const [aiMode, setAiMode] = useState(false);
  const [aiRagSummary, setAiRagSummary] = useState<string | null>(null);
  const [aiScores, setAiScores] = useState<Record<string | number, { score: number; reason: string }>>({});
  const [isAiSearching, setIsAiSearching] = useState(false);

  const toggleArr = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  // Trigger AI Semantic Search Backend
  useEffect(() => {
    if (!aiMode || !search.trim() || search.trim().length < 2) {
      setAiRagSummary(null);
      setAiScores({});
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsAiSearching(true);
      const res = await aiSemanticSearchBackend(search.trim());
      if (!active) return;
      setIsAiSearching(false);
      if (res && res.results) {
        setAiRagSummary(res.ragSummary || null);
        const scoreMap: Record<string | number, { score: number; reason: string }> = {};
        for (const item of res.results) {
          if (item.product && item.product.id) {
            scoreMap[String(item.product.id)] = { score: item.matchScore, reason: item.matchReason };
            if (item.product.title) {
              scoreMap[item.product.title.toLowerCase().trim()] = { score: item.matchScore, reason: item.matchReason };
            }
          }
        }
        setAiScores(scoreMap);
      }
    }, 400);

    return () => { active = false; clearTimeout(timer); };
  }, [search, aiMode]);

  const matchesDomainFrontend = (p: Product, queryStr: string) => {
    const s = queryStr.toLowerCase().trim();
    if (!s) return false;
    const cat = (p.category || "").toLowerCase();
    const name = p.name.toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const combined = name + " " + cat + " " + desc;

    if (["legs", "leg", "bottom", "bottoms", "pants", "pant", "jeans", "trouser", "trousers", "skirt"].some(w => s.includes(w))) {
      return cat.includes("bottom") || ["jeans", "pant", "trouser", "denim", "skirt", "shorts", "bottom", "slacks"].some(w => combined.includes(w));
    }
    if (["torso", "upper", "chest", "top", "tops", "shirt", "jacket", "coat", "hoodie"].some(w => s.includes(w))) {
      return cat.includes("top") || ["jacket", "shirt", "kurta", "blazer", "top", "hoodie", "sweater", "overcoat"].some(w => combined.includes(w));
    }
    if (["shoe", "shoes", "foot", "feet", "sneaker", "sneakers", "boot", "boots", "footwear"].some(w => s.includes(w))) {
      return cat.includes("foot") || cat.includes("shoe") || ["nike", "shoe", "sneaker", "boot", "sandal", "heel", "kicks"].some(w => combined.includes(w));
    }
    if (["dress", "dresses", "body", "full body", "outfit"].some(w => s.includes(w))) {
      return cat.includes("dress") || cat.includes("ethnic") || ["dress", "saree", "kurta", "gown"].some(w => combined.includes(w));
    }
    return false;
  };

  const filtered = productsList.filter(p => {
    const mcity = isProductInCity(p, activeCity);
    const mc = activeCat === "All" || p.category === activeCat;
    const hasAiScore = aiScores[String(p.id)] || aiScores[p.name.toLowerCase().trim()];
    const isDomainMatch = aiMode && matchesDomainFrontend(p, search);
    const ms = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.seller.toLowerCase().includes(search.toLowerCase()) || (aiMode && hasAiScore && hasAiScore.score >= 0.25) || isDomainMatch;
    const mcond = conditions.length === 0 || conditions.includes(p.condition);
    const mtype = types.length === 0 || types.includes(p.type);
    const mprice = maxPriceFilter >= 5000 || p.price <= maxPriceFilter;
    return mcity && mc && ms && mcond && mtype && mprice;
  }).sort((a, b) => {
    if (sort === "Price: Low→High") {
      return a.price - b.price;
    }
    if (sort === "Price: High→Low") {
      return b.price - a.price;
    }
    if (aiMode) {
      const sa = (aiScores[String(a.id)] || aiScores[a.name.toLowerCase().trim()])?.score || (matchesDomainFrontend(a, search) ? 0.95 : 0);
      const sb = (aiScores[String(b.id)] || aiScores[b.name.toLowerCase().trim()])?.score || (matchesDomainFrontend(b, search) ? 0.95 : 0);
      return sb - sa;
    }
    return 0;
  });

  return (
    <div className="bg-background min-h-screen">
      {/* Top Bar */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64 flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5 relative">
            <Search size={15} className="text-muted-foreground flex-shrink-0" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder={aiMode ? "Ask AI (e.g. warm denim jackets under 1500 for Mumbai evening)..." : "Search products, brands, sellers..."} 
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" 
              style={{ fontFamily: "'Inter'" }} 
            />
            {search && <button onClick={() => setSearch("")}><X size={13} className="text-muted-foreground" /></button>}

            {/* AI Mode Toggle Badge */}
            <button
              onClick={() => setAiMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${aiMode ? "bg-gradient-to-r from-emerald-500 to-primary text-white shadow-emerald-500/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
              style={{ fontFamily: "'Plus Jakarta Sans'" }}
            >
              <Sparkles size={13} className={aiMode ? "animate-pulse" : ""} />
              <span>{aiMode ? "AI Search Active" : "Enable AI RAG Search"}</span>
            </button>
          </div>

          {/* City Filter Selector */}
          <div className="flex items-center gap-1.5 bg-muted rounded-xl px-3 py-2">
            <MapPin size={13} className="text-primary flex-shrink-0" />
            <select
              value={activeCity}
              onChange={e => onSelectCity && onSelectCity(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              {Array.from(new Set([
                activeCity,
                ...productsList.map(p => p.location ? p.location.split(',')[0].trim() : '').filter(Boolean),
                'All'
              ])).map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Cities' : (c === activeCity ? `${c} (Selected)` : c)}</option>
              ))}
            </select>
          </div>

          {/* Grid / Map Toggle Button */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            <button onClick={() => setView("grid")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === "grid" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`} style={{ fontFamily: "'Inter'" }}><Grid3X3 size={13} /> Grid</button>
            <button onClick={() => setView("map")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === "map" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`} style={{ fontFamily: "'Inter'" }}><MapIcon size={13} /> OsmDroid Map</button>
          </div>

          <select value={sort} onChange={e => setSort(e.target.value)} className="bg-muted border-none rounded-xl px-3 py-2 text-sm text-foreground outline-none cursor-pointer font-bold" style={{ fontFamily: "'Inter'" }}>
            {["Price: Low→High","Price: High→Low","Latest","Nearest","Best Rated"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Category Strip */}
        <div className="max-w-7xl mx-auto px-6 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCat(c)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`} style={{ fontFamily: "'Inter'" }}>{c}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar Filters */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <div className="bg-card rounded-2xl border border-border p-5 sticky top-24 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-sm text-foreground">Filters</h3>
              <button onClick={() => { setConditions([]); setTypes([]); setMaxPriceFilter(5000); }} className="text-[11px] text-primary font-semibold flex items-center gap-1" style={{ fontFamily: "'Inter'" }}><RotateCcw size={11} /> Reset</button>
            </div>

            {/* Max Price Filter Slider */}
            <div className="mb-5 pb-5 border-b border-border">
              <div className="flex justify-between mb-2">
                <p className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Inter'" }}>Max Price Filter</p>
                <span className="text-xs font-bold text-primary" style={{ fontFamily: "'Plus Jakarta Sans'" }}>{maxPriceFilter === 0 ? "FREE" : `₹${maxPriceFilter.toLocaleString()}`}</span>
              </div>
              <input type="range" min={0} max={5000} step={100} value={maxPriceFilter} onChange={e => setMaxPriceFilter(Number(e.target.value))} className="w-full accent-primary cursor-pointer" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1" style={{ fontFamily: "'Inter'" }}><span>FREE</span><span>₹5,000+</span></div>
            </div>

            {/* Condition */}
            <div className="mb-5 pb-5 border-b border-border">
              <p className="text-xs font-semibold text-foreground mb-2.5" style={{ fontFamily: "'Inter'" }}>Condition</p>
              <div className="space-y-2">
                {["Brand New","Gently Used","Well Worn"].map(c => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => toggleArr(conditions, setConditions, c)} className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${conditions.includes(c) ? "bg-primary border-primary" : "border-border"}`}>
                      {conditions.includes(c) && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <span className="text-sm text-foreground" style={{ fontFamily: "'Inter'" }}>{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Transaction Type */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-foreground mb-2.5" style={{ fontFamily: "'Inter'" }}>Transaction Type</p>
              <div className="space-y-2">
                {["Sell","Exchange","Free/Donate"].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => toggleArr(types, setTypes, t)} className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${types.includes(t) ? "bg-primary border-primary" : "border-border"}`}>
                      {types.includes(t) && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <span className="text-sm text-foreground" style={{ fontFamily: "'Inter'" }}>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wide shadow-xs" style={{ fontFamily: "'Plus Jakarta Sans'" }}>Apply Filters</button>
          </div>
        </aside>

        {/* Main Content (Grid vs OsmDroid OpenStreetMap Container) */}
        <div className="flex-1 min-w-0">
          
          {/* AI RAG Recommendation Banner */}
          {aiMode && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-primary/10 to-blue-500/15 border border-emerald-500/30 text-foreground flex items-start gap-3.5 shadow-xs">
              <div className="p-2.5 rounded-xl bg-emerald-500 text-white flex-shrink-0 shadow-sm mt-0.5">
                <Sparkles size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                    AI Semantic Search & RAG Recommendation Engine
                  </span>
                  {isAiSearching && (
                    <span className="text-[10px] font-bold text-primary animate-pulse flex items-center gap-1">
                      <RefreshCw size={10} className="animate-spin" /> Analyzing Catalog...
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground leading-relaxed" style={{ fontFamily: "'Inter'" }}>
                  {aiRagSummary || "Type any natural language query above (e.g. 'vintage jacket for college' or 'free dresses near me') to run AI RAG semantic search across ReWear catalog!"}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Inter'" }}><span className="font-semibold text-foreground">{filtered.length}</span> items found near you</p>
          </div>

          <AnimatePresence mode="wait">
            {view === "grid" ? (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map(p => {
                    const aiData = aiScores[String(p.id)] || aiScores[p.name.toLowerCase().trim()];
                    return (
                      <ProductCard 
                        key={p.id} 
                        p={p} 
                        wishlisted={wishlist.includes(p.id)} 
                        onWishlist={() => setWishlist(w => w.includes(p.id) ? w.filter(i => i !== p.id) : [...w, p.id])} 
                        onClickProduct={onClickProduct}
                        aiScore={aiMode ? (aiData ? aiData.score : (matchesDomainFrontend(p, search) ? 0.95 : undefined)) : undefined}
                      />
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Real OsmDroid OpenStreetMap Tile Container */}
                <OpenStreetMapContainer productsList={productsList as MapProduct[]} onSelectProduct={onClickProduct} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

function LoginPage({ onDone, onLogin }: { onDone: () => void; onLogin: (user: { name: string; email: string }) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPw, setShowPw] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const tryLogin = async () => {
    if (!email || !pw) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      if (tab === "register") {
        const parts = (fullName.trim() || "User").split(" ");
        const firstName = parts[0] || "User";
        const lastName = parts.slice(1).join(" ") || "";
        await registerBackend(firstName, lastName, email, pw);
        const displayName = `${firstName} ${lastName}`.trim();
        onLogin({ name: displayName, email });
      } else {
        await loginBackend(email, pw);
        // Read back from localStorage what loginBackend stored
        const stored = localStorage.getItem('authUser');
        const user = stored ? JSON.parse(stored) : { name: email, email };
        onLogin(user);
      }
      onDone();
    } catch (err: any) {
      setErrorMsg(err?.message || (tab === "login" ? "Incorrect email or password. Please try again." : "Registration failed. Please try a different email."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex flex-col w-[480px] flex-shrink-0 bg-primary relative overflow-hidden p-12 text-white">
        <div className="relative flex items-center gap-3 mb-auto">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30"><RefreshCw size={20} className="text-white" /></div>
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: "22px" }}>ReWear</span>
        </div>
        <div className="relative mt-auto space-y-4">
          <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, lineHeight: 1.15 }} className="text-4xl text-white">Thrift.<br />Exchange.<br />Sustain.</h2>
          <p className="text-white/80 text-sm leading-relaxed">Join 94,000+ eco-conscious fashion lovers buying and selling pre-loved items in their neighbourhoods.</p>
          <div className="mt-8 flex gap-6 pt-4 border-t border-white/20">
            {[["2.4L+","Items saved"],["8.1T","CO₂ reduced"],["38","Cities"]].map(([val, lbl]) => (
              <div key={lbl}>
                <p style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-2xl text-white">{val}</p>
                <p className="text-white/70 text-xs">{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-2xl text-foreground">{tab === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{tab === "login" ? "Sign in to your ReWear account" : "Start listing and discovering pre-loved items"}</p>
          </div>

          <div className="flex bg-muted rounded-xl p-1">
            {(["login","register"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 600 }} className={`flex-1 py-2 rounded-lg text-sm capitalize transition-all ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>{t === "login" ? "Sign In" : "Register"}</button>
            ))}
          </div>

          <div className="space-y-4">
            {tab === "register" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Priya Sharma" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Email Address</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="priya@example.com" type="email" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input value={pw} onChange={e => setPw(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className="w-full bg-muted border border-border rounded-xl px-4 py-3 pr-12 text-sm text-foreground outline-none focus:border-primary" />
                <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-semibold">
              <AlertCircle size={14} className="flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          <button
            onClick={tryLogin}
            disabled={loading}
            style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm uppercase tracking-widest shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {tab === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>

          <button onClick={() => onDone()} className="w-full py-3 rounded-xl border border-border flex items-center justify-center gap-2 text-sm font-medium text-foreground bg-card hover:bg-muted">
            Explore Website as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LISTING FORM PAGE ────────────────────────────────────────────────────────

function ListingFormPage({ photos, locationCoords, onPublish, authUser }: {
  photos: string[];
  locationCoords?: { lat: number; lng: number; name: string };
  onPublish: (itemData: any) => void;
  authUser: { name: string; email: string } | null;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(899);
  const [type, setType] = useState<"Sell" | "Exchange" | "Free/Donate">("Sell");
  const [condition, setCondition] = useState<"Brand New" | "Gently Used" | "Well Worn">("Gently Used");
  const [category, setCategory] = useState("Tops");
  const [description, setDescription] = useState("");

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemPhotos = photos && photos.length > 0 
      ? photos 
      : ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop&auto=format"];

    const itemData = {
      id: Date.now(),
      name: title || "Pre-loved Item",
      price: Number(price),
      type,
      condition,
      category,
      description,
      image: itemPhotos[0],
      images: itemPhotos,
      seller: authUser?.name || "Anonymous",
      sellerEmail: authUser?.email || "",
      sellerAvatar: (authUser?.name || "A").slice(0, 2).toUpperCase(),
      rating: 5.0,
      reviews: 1,
      distance: "0.4 km",
      location: locationCoords?.name || "Vikasnagar, Dehradun",
      lat: locationCoords?.lat || 30.4035,
      lng: locationCoords?.lng || 77.9340
    };

    const result = await createListingBackend(itemData);
    onPublish(result);
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Step 2 of 2 — Item Details</p>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-2xl text-foreground">Describe Your Item</h1>
        </div>

        {/* Location Tag Confirmation */}
        <div className="p-3.5 rounded-2xl bg-[#c46212]/10 border border-[#c46212]/20 flex items-center justify-between text-xs font-semibold text-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span>
              Geo-Tag Attached: <strong className="text-primary">{locationCoords?.name || "Vikasnagar, Dehradun"}</strong> ({locationCoords?.lat.toFixed(4) || "30.4035"}° N, {locationCoords?.lng.toFixed(4) || "77.9340"}° E)
            </span>
          </div>
        </div>

        {/* Attached Photos Preview */}
        {photos && photos.length > 0 && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ImageIcon size={14} className="text-primary" />
                Attached Photos ({photos.length})
              </span>
              <span className="text-[11px] text-muted-foreground">All photos are uploaded and accessible</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {photos.map((url, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0 shadow-xs">
                  <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary text-white text-[8px] font-bold text-center py-0.5">
                      Cover
                    </span>
                  )}
                  {idx > 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5">
                      Photo {idx + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Item Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Oversized Linen Blazer" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Transaction Type</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm">
                <option value="Sell">Sell</option>
                <option value="Exchange">Exchange</option>
                <option value="Free/Donate">Free/Donate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Asking Price (₹)</label>
              <input value={price} onChange={e => setPrice(Number(e.target.value))} type="number" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Item Condition</label>
              <select value={condition} onChange={e => setCondition(e.target.value as any)} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-semibold">
                <option value="Brand New">✨ Brand New</option>
                <option value="Gently Used">🌿 Gently Used</option>
                <option value="Well Worn">♻️ Well Worn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm">
                <option value="Tops">Tops</option>
                <option value="Bottoms">Bottoms</option>
                <option value="Outerwear">Outerwear</option>
                <option value="Ethnic">Ethnic</option>
                <option value="Footwear">Footwear</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe condition, fabric, fit..." rows={4} className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm" />
          </div>

          <button type="submit" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="w-full py-4 bg-primary text-primary-foreground rounded-xl text-sm uppercase tracking-widest shadow-md hover:bg-primary/90 transition-colors">
            PUBLISH ITEM & PIN TO MAP NOW
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── INBOX PAGE WITH ISOLATED CHAT MESSAGES PER RECIPIENT ────────────────────

function InboxPage({ activeTargetSeller, activeTargetProduct, onViewSellerProfile, authUser }: {
  activeTargetSeller?: string; activeTargetProduct?: Product; onViewSellerProfile: (seller: string) => void;
  authUser: { name: string; email: string } | null;
}) {
  const computeStableId = (seller?: string | null) => {
    if (!seller) return 5000;
    const clean = getCleanUserHandle(seller).toLowerCase();
    return clean.split('').reduce((a, c) => a + c.charCodeAt(0), 5000);
  };

  const cleanSellerName = activeTargetSeller ? getCleanUserHandle(activeTargetSeller) : undefined;
  const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email).toLowerCase();

  const getDeletedTimestamps = (): Record<string, number> => {
    try {
      localStorage.removeItem(`deletedThreadKeys_${currentHandle}`);
      const stored = localStorage.getItem(`deletedThreadAt_${currentHandle}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  };

  const [threads, setThreads] = useState<ChatThread[]>(() => {
    let base: ChatThread[] = [];
    try {
      const stored = localStorage.getItem(`localUserThreads_${currentHandle}`) || localStorage.getItem('localUserThreads');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const testNames = ['meera k.', 'rohan d.', 'aarti s.', 'priti v.'];
          base = parsed.filter((p: any) => p.name && p.name.toLowerCase() !== currentHandle && !testNames.includes(p.name.toLowerCase()));
        }
      }
    } catch {}

    if (cleanSellerName && cleanSellerName.toLowerCase() !== currentHandle) {
      const existing = base.find(t => t.name.toLowerCase() === cleanSellerName.toLowerCase());
      if (!existing) {
        const newThread: ChatThread = {
          id: computeStableId(cleanSellerName),
          name: cleanSellerName,
          avatar: cleanSellerName.slice(0, 2).toUpperCase(),
          productThumb: activeTargetProduct?.image || 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&h=200&fit=crop&auto=format',
          productTitle: activeTargetProduct?.name || 'ThreadSwap Item',
          productPrice: activeTargetProduct?.price || 1500,
          lastMsg: activeTargetProduct ? `Hi, I'm interested in your ${activeTargetProduct.name}!` : 'Start a conversation...',
          time: 'Just now',
          unread: 0
        };
        const updated = [newThread, ...base];
        try { localStorage.setItem(`localUserThreads_${currentHandle}`, JSON.stringify(updated)); } catch {}
        return updated;
      }
    }
    return base;
  });

  const [activeThread, setActiveThread] = useState<ChatThread>(() => {
    if (cleanSellerName && cleanSellerName.toLowerCase() !== currentHandle) {
      const match = threads.find(t => t.name.toLowerCase() === cleanSellerName.toLowerCase());
      if (match) return match;
      return {
        id: computeStableId(cleanSellerName),
        name: cleanSellerName,
        avatar: cleanSellerName.slice(0, 2).toUpperCase(),
        productThumb: activeTargetProduct?.image || 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&h=200&fit=crop&auto=format',
        productTitle: activeTargetProduct?.name || 'ThreadSwap Item',
        productPrice: activeTargetProduct?.price || 1500,
        lastMsg: activeTargetProduct ? `Hi, I'm interested in your ${activeTargetProduct.name}!` : 'Start a conversation...',
        time: 'Just now',
        unread: 0
      };
    }
    return threads[0] || {
      id: 0,
      name: '',
      avatar: '',
      productThumb: '',
      productTitle: '',
      productPrice: 0,
      lastMsg: '',
      time: '',
      unread: 0
    };
  });

  const newThreadStableId = (cleanSellerName && activeTargetProduct && cleanSellerName.toLowerCase() !== currentHandle && !threads.find(t => t.name.toLowerCase() === cleanSellerName.toLowerCase()))
    ? computeStableId(cleanSellerName)
    : null;

  const resolvedActiveThread = newThreadStableId
    ? { ...activeThread, id: newThreadStableId }
    : activeThread;

  const [messagesByThread, setMessagesByThread] = useState<Record<number, { id: number; me: boolean; senderName?: string; text: string; time: string }[]>>(() => {
    try {
      const cached = localStorage.getItem(`localChatCache_${currentHandle}`) || localStorage.getItem('localChatCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch {}
    return {};
  });
  const [input, setInput] = useState("");

  // Mark active thread as read when selected or open
  useEffect(() => {
    if (!resolvedActiveThread || !resolvedActiveThread.name || resolvedActiveThread.id === 0) return;
    const partnerClean = getCleanUserHandle(resolvedActiveThread.name).toLowerCase();
    if (!partnerClean) return;

    try {
      const storedReadTimestamps = localStorage.getItem(`readLastMsgTimestamp_${currentHandle}`);
      const readTimestamps: Record<string, number> = storedReadTimestamps ? JSON.parse(storedReadTimestamps) : {};
      readTimestamps[partnerClean] = Date.now();
      localStorage.setItem(`readLastMsgTimestamp_${currentHandle}`, JSON.stringify(readTimestamps));
    } catch {}

    setThreads(prev => prev.map(t => 
      (t.id === resolvedActiveThread.id || getCleanUserHandle(t.name).toLowerCase() === partnerClean)
        ? { ...t, unread: 0 }
        : t
    ));
  }, [resolvedActiveThread.name, currentHandle]);

  // Ref to track active thread name without triggering effect re-runs
  const activeThreadNameRef = useRef('');
  activeThreadNameRef.current = resolvedActiveThread.name;

  // Fetch user's persistent chat threads from MongoDB Atlas on load & poll
  useEffect(() => {
    if (!authUser?.name && !authUser?.email) return;
    let active = true;
    async function loadUserThreads() {
      const storedReadTimestamps = localStorage.getItem(`readLastMsgTimestamp_${currentHandle}`);
      const readTimestamps: Record<string, number> = storedReadTimestamps ? JSON.parse(storedReadTimestamps) : {};

      const storedDelTimes = localStorage.getItem(`deletedThreadAt_${currentHandle}`);
      const delTimes: Record<string, number> = storedDelTimes ? JSON.parse(storedDelTimes) : {};

      const msgs = await fetchUserChatThreadsBackend(authUser.name || '', authUser.email || '');
      console.log('[Chat] threads fetch:', msgs?.length, 'msgs for handle:', currentHandle);
      if (!active || !msgs || !Array.isArray(msgs)) return;

      const latestMsgsByPartner = new Map<string, {
        threadId: number;
        partnerHandle: string;
        lastMsgText: string;
        lastMsgTimeStr: string;
        lastMsgSentAt: number;
        lastSenderHandle: string;
        prodTitle: string;
      }>();

      for (const m of msgs) {
        if (!m.threadKey || !m.threadKey.includes('<->')) continue;
        const rawPart = m.threadKey.includes('::') ? m.threadKey.split('::')[0] : m.threadKey;
        const prodTitle = m.threadKey.includes('::') ? m.threadKey.split('::')[1] : 'ThreadSwap Exchange';
        const parts = rawPart.split('<->');
        if (parts.length < 2) continue;

        const p1 = getCleanUserHandle(parts[0]);
        const p2 = getCleanUserHandle(parts[1]);

        const p1Clean = p1.toLowerCase();
        const p2Clean = p2.toLowerCase();

        // Privacy Guard: current user must be one of the thread participants (substring match)
        const isP1Me = p1Clean === currentHandle || p1Clean.includes(currentHandle) || currentHandle.includes(p1Clean);
        const isP2Me = p2Clean === currentHandle || p2Clean.includes(currentHandle) || currentHandle.includes(p2Clean);
        if (!isP1Me && !isP2Me) continue;

        const partnerHandle = !isP1Me ? p1 : p2;
        if (partnerHandle.toLowerCase() === currentHandle) continue;

        const key = partnerHandle.toLowerCase();
        const msgTime = m.sentAt ? new Date(m.sentAt).getTime() : Date.now();
        const delTime = delTimes[key] || 0;
        if (msgTime <= delTime) continue;

        const senderHandle = getCleanUserHandle(m.senderName).toLowerCase();

        const existing = latestMsgsByPartner.get(key);
        if (!existing || msgTime > existing.lastMsgSentAt) {
          latestMsgsByPartner.set(key, {
            threadId: computeStableId(partnerHandle),
            partnerHandle,
            lastMsgText: m.text,
            lastMsgTimeStr: m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
            lastMsgSentAt: msgTime,
            lastSenderHandle: senderHandle,
            prodTitle
          });
        }
      }

      const fetchedThreads: ChatThread[] = [];
      for (const [key, data] of latestMsgsByPartner.entries()) {
        const isFromPartner = data.lastSenderHandle !== currentHandle;
        const lastReadTime = readTimestamps[key] || 0;
        const isActive = activeThreadNameRef.current && getCleanUserHandle(activeThreadNameRef.current).toLowerCase() === key;
        
        const isUnread = !isActive && isFromPartner && (data.lastMsgSentAt > lastReadTime + 1000);

        fetchedThreads.push({
          id: data.threadId,
          name: data.partnerHandle,
          avatar: data.partnerHandle.slice(0, 2).toUpperCase(),
          productThumb: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&h=200&fit=crop&auto=format',
          productTitle: data.prodTitle,
          productPrice: 1500,
          lastMsg: data.lastMsgText,
          time: data.lastMsgTimeStr,
          unread: isUnread ? 1 : 0,
          lastMsgSentAt: data.lastMsgSentAt
        } as any);
      }

      fetchedThreads.sort((a: any, b: any) => {
        if ((b.unread || 0) !== (a.unread || 0)) {
          return (b.unread || 0) - (a.unread || 0);
        }
        return (b.lastMsgSentAt || 0) - (a.lastMsgSentAt || 0);
      });

      console.log('[Chat] built threads:', fetchedThreads.length, fetchedThreads.map((t: any) => t.name));
      try { localStorage.setItem(`localUserThreads_${currentHandle}`, JSON.stringify(fetchedThreads)); } catch {}
      setThreads(fetchedThreads);

      // Auto-select the top thread only if nothing is currently selected
      // Use setTimeout to defer state update so it doesn't cancel this effect run
      if (fetchedThreads.length > 0) {
        const activeNow = activeThreadNameRef.current;
        const hasValidActive = activeNow && fetchedThreads.some(t => t.name.toLowerCase() === activeNow.toLowerCase());
        if (!hasValidActive && !cleanSellerName) {
          setTimeout(() => { if (active) setActiveThread(fetchedThreads[0]); }, 0);
        }
      }
    }

    loadUserThreads();
    const interval = setInterval(loadUserThreads, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [authUser, currentHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteThread = (threadId: number, partnerName: string) => {
    if (!window.confirm(`Delete chat conversation with "${partnerName}"?`)) return;

    const cleanPartner = getCleanUserHandle(partnerName).toLowerCase();

    // Permanently remove from backend database
    deleteThreadBackend(currentHandle, cleanPartner);
    if (authUser?.name) {
      deleteThreadBackend(authUser.name, cleanPartner);
    }
    if (authUser?.email) {
      deleteThreadBackend(authUser.email, cleanPartner);
    }

    try {
      const stored = localStorage.getItem(`deletedThreadAt_${currentHandle}`);
      const map: Record<string, number> = stored ? JSON.parse(stored) : {};
      map[cleanPartner] = Date.now();
      localStorage.setItem(`deletedThreadAt_${currentHandle}`, JSON.stringify(map));
    } catch {}

    const updatedThreads = threads.filter(t => t.id !== threadId && getCleanUserHandle(t.name).toLowerCase() !== cleanPartner);
    setThreads(updatedThreads);

    setMessagesByThread(prev => {
      const next = { ...prev };
      delete next[threadId];
      delete next[computeStableId(cleanPartner)];
      try { localStorage.setItem(`localChatCache_${currentHandle}`, JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      localStorage.setItem(`localUserThreads_${currentHandle}`, JSON.stringify(updatedThreads));
    } catch {}

    if (activeThread.id === threadId || getCleanUserHandle(activeThread.name).toLowerCase() === cleanPartner) {
      if (updatedThreads.length > 0) {
        setActiveThread(updatedThreads[0]);
      } else {
        setActiveThread({
          id: 0,
          name: '',
          avatar: '',
          productThumb: '',
          productTitle: '',
          productPrice: 0,
          lastMsg: '',
          time: '',
          unread: 0
        });
      }
    }
  };

  const handleClearAllTestChats = async () => {
    if (!window.confirm("Are you sure you want to delete all chat messages from the database and local storage?")) return;
    await clearAllChatMessagesBackend();
    try {
      const keysToClear = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('localUserThreads_') || k.startsWith('localChatCache_') || k.startsWith('deletedThreadAt_') || k.startsWith('deletedThreadKeys_') || k.startsWith('readLastMsgTimestamp_'))) {
          keysToClear.push(k);
        }
      }
      keysToClear.forEach(k => localStorage.removeItem(k));
    } catch {}
    setThreads([]);
    setMessagesByThread({});
    setActiveThread({
      id: 0,
      name: '',
      avatar: '',
      productThumb: '',
      productTitle: '',
      productPrice: 0,
      lastMsg: '',
      time: '',
      unread: 0
    });
    alert("All test chat messages cleared successfully!");
  };

  // Poll backend for isolated multi-user chat messages every 3s
  useEffect(() => {
    let active = true;
    if (!resolvedActiveThread || !resolvedActiveThread.name || resolvedActiveThread.id === 0) return;

    const partnerClean = getCleanUserHandle(resolvedActiveThread.name).toLowerCase();
    const deletedTimestamps = getDeletedTimestamps();
    const delTime = deletedTimestamps[partnerClean] || 0;

    const userA = authUser?.name || authUser?.email || 'Guest';
    const userB = resolvedActiveThread.name || 'Seller';
    const threadKey = buildThreadKey(userA, userB);
    const targetId = computeStableId(resolvedActiveThread.name);

    async function syncBackendMessages() {
      const msgs = await fetchChatMessagesBackend(threadKey, getCleanUserHandle(userA), getCleanUserHandle(userB));
      if (!active) return;
      if (msgs && Array.isArray(msgs)) {
        const validMsgs = msgs.filter((m: any) => {
          const msgTime = m.sentAt ? new Date(m.sentAt).getTime() : Date.now();
          return msgTime > delTime;
        });

        const myHandle = getCleanUserHandle(authUser?.name || authUser?.email).toLowerCase();
        const formatted = validMsgs.map((m: any, idx: number) => {
          const senderHandle = getCleanUserHandle(m.senderName).toLowerCase();
          const isMe = senderHandle === myHandle;
          return {
            id: m.id || idx,
            me: isMe,
            senderName: getCleanUserHandle(m.senderName),
            text: m.text,
            time: m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
          };
        });

        setMessagesByThread(prev => {
          const next = {
            ...prev,
            [targetId]: formatted,
            [partnerClean]: formatted,
            [resolvedActiveThread.id]: formatted
          };
          try { localStorage.setItem(`localChatCache_${currentHandle}`, JSON.stringify(next)); } catch {}
          return next;
        });
      }
    }
    syncBackendMessages();
    const interval = setInterval(syncBackendMessages, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [resolvedActiveThread.name, resolvedActiveThread.id, authUser, currentHandle]);

  const currentTargetId = computeStableId(resolvedActiveThread.name);
  const currentHandleKey = getCleanUserHandle(resolvedActiveThread.name).toLowerCase();
  const activeMessages = messagesByThread[currentTargetId] || messagesByThread[currentHandleKey] || messagesByThread[resolvedActiveThread.id] || [];

  const send = async () => {
    if (!input.trim()) return;
    const rawTargetName = resolvedActiveThread.name || cleanSellerName;
    const userB = getCleanUserHandle(rawTargetName);
    if (!userB || userB === 'Guest' || userB === 'Seller' || userB.toLowerCase() === currentHandle) {
      alert("Please select a valid user to send a message.");
      return;
    }

    const msgText = input.trim();
    setInput("");
    const currentUserName = authUser?.name || authUser?.email || 'User';
    const threadKey = buildThreadKey(currentUserName, userB);
    const senderDisplayName = getCleanUserHandle(currentUserName);

    const newMsg = {
      id: Date.now(),
      me: true,
      senderName: senderDisplayName,
      text: msgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const targetClean = getCleanUserHandle(userB).toLowerCase();
    const targetId = computeStableId(userB);

    // Un-delete partner if previously hidden
    try {
      const stored = localStorage.getItem(`deletedThreadAt_${currentHandle}`);
      if (stored) {
        const map: Record<string, number> = JSON.parse(stored);
        delete map[targetClean];
        localStorage.setItem(`deletedThreadAt_${currentHandle}`, JSON.stringify(map));
      }
    } catch {}

    setMessagesByThread(prev => {
      const existing = prev[targetId] || prev[targetClean] || prev[resolvedActiveThread.id] || [];
      const updatedMsgs = [...existing, newMsg];
      const next = {
        ...prev,
        [targetId]: updatedMsgs,
        [targetClean]: updatedMsgs,
        [resolvedActiveThread.id]: updatedMsgs
      };
      try { localStorage.setItem(`localChatCache_${currentHandle}`, JSON.stringify(next)); } catch {}
      return next;
    });

    setThreads(prev => {
      const idx = prev.findIndex(t => t.id === activeThread.id || t.id === targetId || getCleanUserHandle(t.name).toLowerCase() === targetClean);
      let updated: ChatThread[];
      if (idx !== -1) {
        updated = prev.map((t, i) => i === idx ? { ...t, lastMsg: msgText, time: 'Just now', unread: 0 } : t);
      } else {
        const newThread: ChatThread = {
          id: targetId,
          name: getCleanUserHandle(userB),
          avatar: getCleanUserHandle(userB).slice(0, 2).toUpperCase(),
          productThumb: resolvedActiveThread.productThumb || 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&h=200&fit=crop&auto=format',
          productTitle: resolvedActiveThread.productTitle || 'ThreadSwap Exchange',
          productPrice: resolvedActiveThread.productPrice || 1500,
          lastMsg: msgText,
          time: 'Just now',
          unread: 0
        };
        updated = [newThread, ...prev];
      }
      try { localStorage.setItem(`localUserThreads_${currentHandle}`, JSON.stringify(updated)); } catch {}
      return updated;
    });

    await sendChatMessageBackend(threadKey, senderDisplayName, msgText);
  };

  return (
    <div className="bg-background" style={{ height: "calc(100vh - 64px)" }}>
      <div className="max-w-7xl mx-auto px-6 py-6 h-full">
        <div className="flex gap-5 h-full">
          
          {/* Thread List */}
          <div className="w-80 flex-shrink-0 bg-card rounded-2xl border border-border overflow-hidden flex flex-col shadow-xs">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-base text-foreground">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {threads.map(t => {
                const isSelected = activeThread.id === t.id || (activeThread.name && t.name && getCleanUserHandle(activeThread.name).toLowerCase() === getCleanUserHandle(t.name).toLowerCase());
                return (
                  <div key={t.id} className="relative group">
                    <button 
                      onClick={() => {
                        setActiveThread(t);
                        setThreads(prev => prev.map(item => (item.id === t.id || getCleanUserHandle(item.name).toLowerCase() === getCleanUserHandle(t.name).toLowerCase()) ? { ...item, unread: 0 } : item));
                      }} 
                      className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border text-left transition-colors ${isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted"}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary font-bold flex items-center justify-center flex-shrink-0 relative">
                        {t.avatar}
                        {t.unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full ring-2 ring-card animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm block truncate ${t.unread > 0 ? "font-extrabold text-foreground" : "font-bold text-foreground"}`}>{t.name}</span>
                          {t.unread > 0 && (
                            <span className="text-[9px] font-extrabold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">New</span>
                          )}
                        </div>
                        <span className={`text-[10px] truncate block ${t.unread > 0 ? "font-bold text-primary" : "text-muted-foreground"}`}>{t.lastMsg || t.productTitle}</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(t.id, t.name);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 dark:border-red-900/40 transition-all"
                      title="Delete Chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Chat Panel */}
          <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden flex flex-col min-w-0 shadow-xs">
            
            {(!resolvedActiveThread.name || threads.length === 0 || resolvedActiveThread.id === 0) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <MessageSquare size={48} className="text-primary/40 mb-3" />
                <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-lg text-foreground mb-1">No Active Conversations</h3>
                <p className="text-xs max-w-sm">Select an item on the marketplace and click "Chat & Buy from Seller" to start messaging buyers or sellers!</p>
              </div>
            ) : (
              <>
                {/* Active Seller Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center shadow-xs">
                      {resolvedActiveThread.avatar}
                    </div>
                    <div>
                      <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-sm text-foreground">{resolvedActiveThread.name}</h3>
                      <span className="text-[11px] text-emerald-600 font-semibold block">Online · Replies in minutes</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onViewSellerProfile(resolvedActiveThread.name)}
                      className="px-3.5 py-1.5 rounded-xl bg-muted border border-border text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                    >
                      <User size={13} /> View Seller Profile
                    </button>
                    <button 
                      onClick={() => handleDeleteThread(resolvedActiveThread.id, resolvedActiveThread.name)}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-200 dark:border-red-900/40 text-xs font-bold text-red-600 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                      title="Delete Chat Conversation"
                    >
                      <Trash2 size={13} /> Delete Chat
                    </button>
                  </div>
                </div>

                {/* Product Banner Context */}
                <div className="flex items-center gap-3 px-5 py-3 bg-muted/40 border-b border-border flex-shrink-0">
                  <img src={resolvedActiveThread.productThumb} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Plus Jakarta Sans'" }}>{resolvedActiveThread.productTitle}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin size={11} className="text-primary" /> {activeTargetProduct?.location || "Nearby"}
                    </p>
                    <p className="text-sm font-extrabold text-primary">{fmt(resolvedActiveThread.productPrice)}</p>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {activeMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
                      <MessageCircle size={32} className="text-primary/40 mb-2" />
                      <p className="text-xs font-bold text-foreground">Start a conversation</p>
                      <p className="text-[11px]">Send a message to discuss pickup, price, or exchange!</p>
                    </div>
                  ) : (
                    activeMessages.map(m => (
                      <div key={m.id} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-xs font-medium ${m.me ? "bg-primary text-primary-foreground rounded-br-none shadow-xs" : "bg-muted text-foreground rounded-bl-none border border-border"}`}>
                          {!m.me && m.senderName && (
                            <span className="block text-[10px] font-extrabold text-primary mb-0.5">{m.senderName}</span>
                          )}
                          <p>{m.text}</p>
                          <span className={`block text-[9px] mt-1 ${m.me ? "text-white/80 text-right" : "text-muted-foreground"}`}>{m.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input Bar */}
                <div className="p-4 border-t border-border bg-card flex-shrink-0">
                  <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={input} 
                      onChange={e => setInput(e.target.value)}
                      placeholder="Type a message or offer..." 
                      className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    <button type="submit" className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-xs">
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────

function ProfilePage({ 
  darkMode, 
  onToggleDark, 
  onNav,
  productsList,
  onDelistProduct,
  onMarkSold,
  onSelectProduct,
  authUser,
  onUpdateAuthUser,
  activeCity = "Mumbai",
  onSelectCity
}: { 
  darkMode: boolean; 
  onToggleDark: () => void; 
  onNav: (p: Page, mode?: string) => void;
  productsList: Product[];
  onDelistProduct: (id: number | string) => void;
  onMarkSold: (id: number | string) => void;
  onSelectProduct: (p: Product) => void;
  authUser: { name: string; email: string; avatar?: string | null } | null;
  onUpdateAuthUser?: (user: any) => void;
  activeCity?: string;
  onSelectCity?: (city: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"listings" | "address" | "history" | "settings">("listings");
  const [historyFilter, setHistoryFilter] = useState<"all" | "purchases" | "swaps">("all");
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  
  // Profile user state — initialized from stored profile or logged-in user
  const displayName = authUser?.name || "Guest User";
  const displayEmail = authUser?.email || "guest@rewear.in";
  const [userProfile, setUserProfile] = useState(() => {
    const currentHandle = authUser ? getCleanUserHandle(authUser.name || authUser.email).toLowerCase() : 'guest';
    const stored = localStorage.getItem(`userProfile_${currentHandle}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          name: parsed.name || displayName,
          email: parsed.email || displayEmail,
          phone: parsed.phone || "+91 98201 45892",
          location: parsed.location || "Mumbai, India",
          bio: parsed.bio || "Passionate about circular fashion & zero textile waste. Buying and selling pre-loved pieces.",
          avatar: parsed.avatar || authUser?.avatar || null
        };
      } catch {}
    }
    return {
      name: displayName,
      email: displayEmail,
      phone: "+91 98201 45892",
      location: "Mumbai, India",
      bio: "Passionate about circular fashion & zero textile waste. Buying and selling pre-loved pieces.",
      avatar: (authUser?.avatar || null) as string | null
    };
  });

  // Load saved profile data from localStorage & backend on mount
  useEffect(() => {
    if (!authUser?.email) return;
    const currentHandle = getCleanUserHandle(authUser.name || authUser.email).toLowerCase();
    const stored = localStorage.getItem(`userProfile_${currentHandle}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserProfile(prev => ({
          ...prev,
          ...parsed,
          avatar: parsed.avatar || authUser.avatar || prev.avatar
        }));
      } catch {}
    } else if (authUser.avatar) {
      setUserProfile(prev => ({ ...prev, avatar: authUser.avatar || null }));
    }

    // Also fetch backend profile if available
    fetchUserProfileBackend(authUser.email).then(data => {
      if (data) {
        setUserProfile(prev => ({
          ...prev,
          name: data.name || prev.name,
          phone: (data.phone !== undefined && data.phone !== null && data.phone !== "") ? data.phone : prev.phone,
          location: (data.location !== undefined && data.location !== null && data.location !== "") ? data.location : prev.location,
          bio: data.bio || prev.bio,
          avatar: data.avatar || prev.avatar
        }));
        if (data.avatar && onUpdateAuthUser && data.avatar !== authUser.avatar) {
          onUpdateAuthUser({ ...authUser, avatar: data.avatar });
        }
      }
    });
  }, [authUser?.email]);

  // Saved addresses state with persistent storage
  const [addresses, setAddresses] = useState(() => {
    const currentHandle = authUser ? getCleanUserHandle(authUser.name || authUser.email).toLowerCase() : 'guest';
    const stored = localStorage.getItem(`userAddresses_${currentHandle}`);
    if (stored) {
      try { return JSON.parse(stored); } catch {}
    }
    return [
      { id: 1, type: "Home / Primary", name: displayName, addressLine: "Flat 402, Palm Grove Heights, Lokhandwala Complex", area: "Andheri West", city: "Mumbai", state: "Maharashtra", pincode: "400058", phone: "+91 98201 45892", isDefault: true },
      { id: 2, type: "Pickup Studio", name: `${displayName.split(' ')[0]} Fashion Studio`, addressLine: "Shop 12, Ground Floor, Hill Road", area: "Bandra West", city: "Mumbai", state: "Maharashtra", pincode: "400050", phone: "+91 98201 45892", isDefault: false },
    ];
  });
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ type: "Home / Primary", name: displayName, addressLine: "", area: "", city: "Mumbai", state: "Maharashtra", pincode: "", phone: "+91 98201 45892" });

  // Delivery Address form state for Settings & Profile
  const [addrForm, setAddrForm] = useState(() => {
    const currentHandle = authUser ? getCleanUserHandle(authUser.name || authUser.email).toLowerCase() : 'guest';
    const stored = localStorage.getItem(`userAddresses_${currentHandle}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const def = parsed.find((a: any) => a.isDefault) || parsed[0];
        if (def) return {
          addressLine: def.addressLine || "",
          area: def.area || "",
          city: def.city || "Mumbai",
          state: def.state || "Maharashtra",
          pincode: def.pincode || "",
          phone: def.phone || "+91 98201 45892"
        };
      } catch {}
    }
    return {
      addressLine: "Flat 402, Palm Grove Heights, Lokhandwala Complex",
      area: "Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400058",
      phone: "+91 98201 45892"
    };
  });

  // Sync addrForm whenever addresses change
  useEffect(() => {
    const currentPrimary = addresses.find(a => a.isDefault) || addresses[0];
    if (currentPrimary) {
      setAddrForm({
        addressLine: currentPrimary.addressLine || "",
        area: currentPrimary.area || "",
        city: currentPrimary.city || "Mumbai",
        state: currentPrimary.state || "Maharashtra",
        pincode: currentPrimary.pincode || "",
        phone: currentPrimary.phone || userProfile.phone
      });
    }
  }, [addresses]);

  const [isLocating, setIsLocating] = useState(false);
  const [locationDetectMsg, setLocationDetectMsg] = useState<string | null>(null);

  // Auto-detect exact location using device GPS + OpenStreetMap Nominatim reverse geocode
  const autoDetectAddressLocation = (target: "settings" | "newAddress" = "settings") => {
    setIsLocating(true);
    setLocationDetectMsg("Detecting GPS coordinates...");

    if (!navigator.geolocation) {
      setLocationDetectMsg("Geolocation not supported by this browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationDetectMsg("Acquiring address from coordinates...");

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};

            // Optional street and house number (leave empty if not detected)
            const road = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || addr.highway || '';
            const houseNumber = addr.house_number || '';
            const streetLine = [houseNumber, road].filter(Boolean).join(' ');

            // Optional locality / neighbourhood (leave empty if not detected)
            const area = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict || addr.quarter || addr.city_district || addr.village_district || '';

            // City / Town (handles all international and Indian administrative naming conventions)
            const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.subdistrict || addr.city_district || addr.state_district || '';

            // State & pincode
            const state = addr.state || addr.province || addr.region || '';
            const pincode = addr.postcode || '';

            // Format location string for display
            const detectedHeaderLocation = [area, city, state].filter(Boolean).join(', ');

            if (target === "settings") {
              setAddrForm(prev => ({
                ...prev,
                addressLine: streetLine,
                area: area,
                city: city || prev.city,
                state: state || prev.state,
                pincode: pincode
              }));
              if (detectedHeaderLocation) {
                setUserProfile(prev => ({
                  ...prev,
                  location: detectedHeaderLocation
                }));
              }
            } else {
              setNewAddr(prev => ({
                ...prev,
                addressLine: streetLine,
                area: area,
                city: city || prev.city,
                state: state || prev.state,
                pincode: pincode
              }));
            }

            setLocationDetectMsg(`✓ Location detected: ${city || 'Location resolved'}${state ? ', ' + state : ''}`);
            setTimeout(() => setLocationDetectMsg(null), 5000);
          } else {
            throw new Error('Nominatim non-200');
          }
        } catch (e) {
          console.warn("Reverse geocode failed:", e);
          setLocationDetectMsg("Could not auto-detect address. Please enter your City and State manually.");
          setTimeout(() => setLocationDetectMsg(null), 5000);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.warn("GPS error:", err);
        setLocationDetectMsg("Could not access GPS. Please enter address manually.");
        setIsLocating(false);
        setTimeout(() => setLocationDetectMsg(null), 5000);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Purchases list
  const [purchases, setPurchases] = useState<any[]>([
    {
      id: "ord-101",
      item: "Vintage Denim Jacket",
      seller: "Ambrish",
      date: "Aug 28, 2026",
      price: 1299,
      status: "Delivered",
      thumb: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=150"
    }
  ]);

  // Swap history list
  const [swaps, setSwaps] = useState<any[]>([
    {
      id: "swp-201",
      offeredItem: "Black Linen Shirt",
      receivedItem: "Decathlon Side Bag",
      partner: "Ambrish",
      date: "Sep 02, 2026",
      status: "Completed"
    }
  ]);

  // Sold status tracking for user items
  const [soldItemIds, setSoldItemIds] = useState<number[]>([]);

  // Strictly filter listings where seller matches the logged-in user
  const myListings = productsList.filter(p => {
    if (!authUser) return false;
    const userEmail = (authUser.email || '').toLowerCase().trim();
    const userName = (authUser.name || '').toLowerCase().trim();
    const itemEmail = (p.sellerEmail || '').toLowerCase().trim();
    const itemSeller = (p.seller || '').toLowerCase().trim();

    if (itemEmail && userEmail && itemEmail === userEmail) return true;
    if (itemSeller && userName && (itemSeller === userName || itemSeller === 'you')) return true;
    if (userName && itemSeller && (userName.includes(itemSeller) || itemSeller.includes(userName))) return true;
    return false;
  });
  const displayListings = myListings;

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 320x320 using canvas for fast performance and instant persistence
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setUserProfile(prev => ({ ...prev, avatar: dataUrl }));

          const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email).toLowerCase();
          try {
            const stored = localStorage.getItem(`userProfile_${currentHandle}`);
            const cur = stored ? JSON.parse(stored) : {};
            localStorage.setItem(`userProfile_${currentHandle}`, JSON.stringify({ ...cur, avatar: dataUrl }));
          } catch {}

          if (onUpdateAuthUser && authUser) {
            onUpdateAuthUser({ ...authUser, avatar: dataUrl });
          }

          // Sync avatar to backend
          updateUserProfileBackend({ email: authUser?.email, avatar: dataUrl });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setUserProfile(prev => ({ ...prev, avatar: null }));
    const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email).toLowerCase();
    try {
      const stored = localStorage.getItem(`userProfile_${currentHandle}`);
      const cur = stored ? JSON.parse(stored) : {};
      localStorage.setItem(`userProfile_${currentHandle}`, JSON.stringify({ ...cur, avatar: null }));
    } catch {}
    if (onUpdateAuthUser && authUser) {
      onUpdateAuthUser({ ...authUser, avatar: null });
    }
    updateUserProfileBackend({ email: authUser?.email, avatar: null });
  };

  const handleSaveProfileChanges = async () => {
    const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email).toLowerCase();

    // 1. Mandatory City and State validation (strictly compulsory everywhere)
    const finalCity = (addrForm.city || "").trim();
    const finalState = (addrForm.state || "").trim();

    if (!finalCity || !finalState) {
      alert("City and State are compulsory fields. Please fill in both your City and State before saving.");
      return;
    }

    const finalPhone = (userProfile.phone !== undefined && userProfile.phone !== null) ? userProfile.phone.trim() : "";
    const finalLocation = (userProfile.location !== undefined && userProfile.location !== null && userProfile.location.trim()) 
      ? userProfile.location.trim() 
      : `${addrForm.area && addrForm.area.trim() ? addrForm.area.trim() + ', ' : ''}${finalCity}, ${finalState}`;

    // Street address and locality are optional. If blank, use area or city
    const deliveryAddressLine = addrForm.addressLine && addrForm.addressLine.trim() 
      ? addrForm.addressLine.trim() 
      : (addrForm.area && addrForm.area.trim() ? addrForm.area.trim() : finalCity);

    // 2. Update or create the default delivery address
    let updatedAddresses = [...addresses];
    const defaultIdx = updatedAddresses.findIndex(a => a.isDefault);
    const updatedDeliveryAddr = {
      id: defaultIdx >= 0 ? updatedAddresses[defaultIdx].id : Date.now(),
      type: "Home / Primary",
      name: userProfile.name,
      addressLine: deliveryAddressLine,
      area: addrForm.area ? addrForm.area.trim() : "",
      city: finalCity,
      state: finalState,
      pincode: addrForm.pincode ? addrForm.pincode.trim() : "",
      phone: finalPhone || addrForm.phone || "",
      isDefault: true
    };

    if (defaultIdx >= 0) {
      updatedAddresses[defaultIdx] = updatedDeliveryAddr;
    } else if (updatedAddresses.length > 0) {
      updatedAddresses = updatedAddresses.map(a => ({ ...a, isDefault: false }));
      updatedAddresses.unshift(updatedDeliveryAddr);
    } else {
      updatedAddresses = [updatedDeliveryAddr];
    }

    setAddresses(updatedAddresses);
    localStorage.setItem(`userAddresses_${currentHandle}`, JSON.stringify(updatedAddresses));

    // 3. Save profile preserving user's typed phone and location
    const updatedProfile = {
      ...userProfile,
      phone: finalPhone,
      location: finalLocation
    };
    setUserProfile(updatedProfile);
    localStorage.setItem(`userProfile_${currentHandle}`, JSON.stringify(updatedProfile));

    // 4. Update active city across the entire application so marketplace matches exact city
    if (finalCity && onSelectCity) {
      onSelectCity(finalCity);
    }

    // 5. Update authUser state
    if (onUpdateAuthUser && authUser) {
      onUpdateAuthUser({
        ...authUser,
        name: userProfile.name,
        avatar: userProfile.avatar
      });
    }

    // 6. Sync to backend API
    await updateUserProfileBackend({
      email: authUser?.email,
      name: userProfile.name,
      phone: finalPhone,
      location: finalLocation,
      city: finalCity,
      bio: userProfile.bio,
      avatar: userProfile.avatar
    });

    alert(`Profile, phone number, and delivery address saved successfully!\nHeader location: ${finalLocation}\nMarketplace filtered to: ${finalCity}`);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddr.city || !newAddr.city.trim() || !newAddr.state || !newAddr.state.trim()) {
      alert("City and State are compulsory. Please fill in both fields.");
      return;
    }
    const isFirst = addresses.length === 0;
    const finalAddressLine = newAddr.addressLine && newAddr.addressLine.trim() 
      ? newAddr.addressLine.trim() 
      : (newAddr.area && newAddr.area.trim() ? newAddr.area.trim() : newAddr.city);

    const updated = [
      ...addresses,
      {
        id: Date.now(),
        ...newAddr,
        city: newAddr.city.trim(),
        state: newAddr.state.trim(),
        addressLine: finalAddressLine,
        isDefault: isFirst
      }
    ];
    setAddresses(updated);
    const currentHandle = authUser ? getCleanUserHandle(authUser.name || authUser.email).toLowerCase() : 'guest';
    localStorage.setItem(`userAddresses_${currentHandle}`, JSON.stringify(updated));
    setShowAddAddress(false);
    setNewAddr({ type: "Home / Primary", name: displayName, addressLine: "", area: "", city: "Mumbai", state: "Maharashtra", pincode: "", phone: userProfile.phone || "+91 98201 45892" });
  };

  const handleDeleteAddress = (id: number) => {
    const updated = addresses.filter(a => a.id !== id);
    setAddresses(updated);
    const currentHandle = authUser ? getCleanUserHandle(authUser.name || authUser.email).toLowerCase() : 'guest';
    localStorage.setItem(`userAddresses_${currentHandle}`, JSON.stringify(updated));
  };

  const handleSetDefaultAddress = (id: number) => {
    const target = addresses.find(a => a.id === id);
    const updated = addresses.map(a => ({ ...a, isDefault: a.id === id }));
    setAddresses(updated);
    const currentHandle = authUser ? getCleanUserHandle(authUser.name || authUser.email).toLowerCase() : 'guest';
    localStorage.setItem(`userAddresses_${currentHandle}`, JSON.stringify(updated));

    if (target) {
      setAddrForm({
        addressLine: target.addressLine,
        area: target.area,
        city: target.city,
        state: target.state,
        pincode: target.pincode,
        phone: target.phone || userProfile.phone
      });
      const exactLocation = `${target.area ? target.area + ', ' : ''}${target.city}, ${target.state}`;
      setUserProfile(prev => ({ ...prev, location: exactLocation }));
      const curProfile = localStorage.getItem(`userProfile_${currentHandle}`);
      if (curProfile) {
        try {
          const parsed = JSON.parse(curProfile);
          localStorage.setItem(`userProfile_${currentHandle}`, JSON.stringify({ ...parsed, location: exactLocation }));
        } catch {}
      }
    }

    if (target?.city && onSelectCity) {
      onSelectCity(target.city);
    }
    alert(`Primary address updated to ${target?.city || 'new location'}! Marketplace listings now filtered to ${target?.city || 'this area'}.`);
  };

  const handleToggleSold = (id: any) => {
    setSoldItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    onMarkSold(id);
  };

  return (
    <div className="bg-background min-h-screen pb-16">
      {/* Hidden file input for avatar uploads */}
      <input 
        ref={avatarFileInputRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleAvatarFileSelect} 
      />

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        
        {/* Profile Header Hero */}
        <div className="bg-gradient-to-r from-[#c46212] to-[#e07b22] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
            
            {/* Interactive Avatar with Upload Trigger */}
            <div 
              className="relative group cursor-pointer" 
              onClick={() => avatarFileInputRef.current?.click()}
              title="Click to change profile picture"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/40 shadow-md flex items-center justify-center bg-white/20 relative">
                {userProfile.avatar ? (
                  <img src={userProfile.avatar} alt={userProfile.name} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: "32px" }} className="text-white">
                    {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
                {/* Hover overlay with camera icon */}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold">
                  <Camera size={18} className="mb-0.5" />
                  <span>Update</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); avatarFileInputRef.current?.click(); }} 
                className="absolute bottom-0 right-0 p-1.5 bg-card text-foreground rounded-full shadow-sm hover:scale-110 transition-transform"
                title="Upload Photo"
              >
                <Camera size={13} className="text-primary" />
              </button>
            </div>

            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-2xl sm:text-3xl text-white">
                  {userProfile.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">
                  <Leaf size={12} /> EcoSaver Verified
                </span>
              </div>
              <p className="text-white/80 text-xs flex items-center justify-center md:justify-start gap-1">
                <MapPin size={13} /> {userProfile.location} · {userProfile.email}
              </p>
              <p className="text-white/90 text-xs max-w-xl leading-relaxed">
                {userProfile.bio}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex gap-4 bg-black/15 backdrop-blur-sm rounded-2xl p-4 border border-white/10 text-center">
              <div>
                <p style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-white">{displayListings.length}</p>
                <p className="text-[10px] text-white/70 font-semibold">Listings</p>
              </div>
              <div className="w-px bg-white/20 my-1" />
              <div>
                <p style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-white">11</p>
                <p className="text-[10px] text-white/70 font-semibold">Sold/Swapped</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Side Navigation */}
          <aside className="space-y-1">
            {[
              { id: "listings", label: `My Listings (${displayListings.length})`, icon: <Package size={16} /> },
              { id: "address", label: "Delivery Addresses", icon: <MapPin size={16} /> },
              { id: "history", label: `History (${purchases.length + swaps.length})`, icon: <Clock size={16} /> },
              { id: "settings", label: "Settings & Profile", icon: <Edit3 size={16} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </aside>

          {/* Main Tab Content */}
          <main className="lg:col-span-3 space-y-6">
            
            {/* 1. MY LISTINGS TAB */}
            {activeTab === "listings" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-foreground">
                      Your Active Items ({displayListings.length})
                    </h2>
                    <p className="text-xs text-muted-foreground">Manage your clothes listed on the ThreadSwap marketplace.</p>
                  </div>
                  <button onClick={() => onNav("camera")} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-primary/90">
                    <Plus size={14} /> List Another Item
                  </button>
                </div>

                <div className="space-y-3">
                  {displayListings.length === 0 ? (
                    <div className="p-12 rounded-3xl bg-card border border-border text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <Package size={24} />
                      </div>
                      <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-base text-foreground">
                        No Active Listings
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        Declutter your closet and list clothes for sale, exchange, or donation in your neighborhood!
                      </p>
                      <button onClick={() => onNav("camera")} className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90">
                        List an Item Now
                      </button>
                    </div>
                  ) : displayListings.map(p => {
                    const isSold = soldItemIds.includes(p.id as any);
                    return (
                      <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex flex-col sm:flex-row items-center gap-4 shadow-xs hover:border-primary/50 transition-all">
                        <img src={p.image} alt={p.name} className="w-20 h-20 rounded-xl object-cover bg-muted flex-shrink-0" />
                        
                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-base text-foreground truncate">
                              {p.name}
                            </h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSold ? "bg-muted text-muted-foreground" : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                            }`}>
                              {isSold ? "SOLD" : "ACTIVE"}
                            </span>
                          </div>

                          <p className="text-sm font-extrabold text-primary">{fmt(p.price)} · <span className="text-xs font-medium text-muted-foreground">{p.condition} · {p.category}</span></p>
                          <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                            <MapPin size={12} className="text-primary" /> {p.location || "Nearby"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button 
                            onClick={() => onSelectProduct(p)}
                            className="p-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold"
                            title="View Detail"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            onClick={() => handleToggleSold(p.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                              isSold ? "bg-muted text-muted-foreground" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            {isSold ? "Mark Available" : "Mark Sold"}
                          </button>
                          <button 
                            onClick={() => onDelistProduct(p.id)}
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl text-xs font-semibold"
                            title="Delist Item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. ADDRESSES TAB */}
            {activeTab === "address" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-foreground">
                      Delivery & Pickup Addresses
                    </h2>
                    <p className="text-xs text-muted-foreground">Manage your primary address. Marketplace listings are filtered to match your primary city.</p>
                  </div>
                  <button 
                    onClick={() => setShowAddAddress(v => !v)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-primary/90"
                  >
                    <Plus size={14} /> {showAddAddress ? "Cancel" : "Add New"}
                  </button>
                </div>

                {/* Add Address Form Accordion */}
                {showAddAddress && (
                  <form onSubmit={handleSaveAddress} className="bg-card rounded-2xl border border-primary/40 p-6 space-y-4 shadow-sm animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h3 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-sm text-foreground">
                        Add New Location / Address
                      </h3>
                      <button
                        type="button"
                        onClick={() => autoDetectAddressLocation("newAddress")}
                        disabled={isLocating}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60"
                      >
                        {isLocating ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                        <span>Auto-Detect GPS</span>
                      </button>
                    </div>

                    {locationDetectMsg && (
                      <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-primary flex items-center gap-2">
                        <Compass size={13} />
                        <span>{locationDetectMsg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Address Label</label>
                        <select value={newAddr.type} onChange={e => setNewAddr(prev => ({ ...prev, type: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold outline-none">
                          <option>Home / Primary</option>
                          <option>Pickup Studio</option>
                          <option>Office</option>
                          <option>Meetup Hub</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Contact Name</label>
                        <input value={newAddr.name} onChange={e => setNewAddr(prev => ({ ...prev, name: e.target.value }))} placeholder="Full Name" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Street Address / Building <span className="text-muted-foreground font-normal">(Optional)</span></label>
                        <input value={newAddr.addressLine} onChange={e => setNewAddr(prev => ({ ...prev, addressLine: e.target.value }))} placeholder="e.g. Flat 402, Palm Heights (Optional)" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Neighborhood / Area <span className="text-muted-foreground font-normal">(Optional)</span></label>
                        <input value={newAddr.area} onChange={e => setNewAddr(prev => ({ ...prev, area: e.target.value }))} placeholder="e.g. Andheri West (Optional)" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">City / Town <span className="text-primary font-bold">*</span></label>
                        <input value={newAddr.city} onChange={e => setNewAddr(prev => ({ ...prev, city: e.target.value }))} placeholder="e.g. Mumbai, Delhi, Bengaluru" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none font-bold" required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">State <span className="text-primary font-bold">*</span></label>
                        <input value={newAddr.state} onChange={e => setNewAddr(prev => ({ ...prev, state: e.target.value }))} placeholder="e.g. Maharashtra, Karnataka" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none font-bold" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Postal / Pincode <span className="text-muted-foreground font-normal">(Optional)</span></label>
                        <input value={newAddr.pincode} onChange={e => setNewAddr(prev => ({ ...prev, pincode: e.target.value }))} placeholder="e.g. 400058" className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none" />
                      </div>
                    </div>
                    <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-primary/90">
                      Save Address
                    </button>
                  </form>
                )}

                {/* Saved Addresses Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map(a => (
                    <div key={a.id} className={`bg-card rounded-2xl border p-5 space-y-3 relative shadow-xs transition-all ${a.isDefault ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-primary/50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                          <MapPin size={13} /> {a.type}
                        </span>
                        {a.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            PRIMARY LOCATION
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700 }} className="text-sm text-foreground">
                          {a.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {a.addressLine}, {a.area}, <strong>{a.city}</strong> - {a.pincode}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">📞 {a.phone}</p>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-between">
                        {!a.isDefault ? (
                          <button onClick={() => handleSetDefaultAddress(a.id)} className="text-xs font-bold text-primary hover:underline">
                            Set as Primary
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                              <Check size={12} /> Active for Marketplace
                            </span>
                            <button
                              type="button"
                              onClick={() => autoDetectAddressLocation("settings")}
                              disabled={isLocating}
                              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                              title="Update with live GPS"
                            >
                              <Navigation size={11} /> Auto-Detect
                            </button>
                          </div>
                        )}
                        <button onClick={() => handleDeleteAddress(a.id)} className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. HISTORY TAB (COMBINED PURCHASES & SWAP HISTORY) */}
            {activeTab === "history" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-foreground">
                      Order & Swap History
                    </h2>
                    <p className="text-xs text-muted-foreground">All your pre-loved purchases and wardrobe trades in one place.</p>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl">
                    {(["all", "purchases", "swaps"] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setHistoryFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                          historyFilter === tab ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab === "all" ? `All (${purchases.length + swaps.length})` : tab === "purchases" ? `Purchases (${purchases.length})` : `Swaps (${swaps.length})`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Purchases */}
                  {(historyFilter === "all" || historyFilter === "purchases") && purchases.map((pur: any) => (
                    <div key={pur.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-4 shadow-xs hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-3">
                        <img src={pur.thumb} alt={pur.item} className="w-14 h-14 rounded-xl object-cover bg-muted" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">{pur.item}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-full">PURCHASE</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Bought from {pur.seller} · {pur.date}</p>
                          <span className="text-[10px] font-bold text-emerald-600">{pur.status}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">{fmt(pur.price)}</span>
                    </div>
                  ))}

                  {/* Swaps */}
                  {(historyFilter === "all" || historyFilter === "swaps") && swaps.map((swp: any) => (
                    <div key={swp.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-4 shadow-xs hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <Repeat size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">{swp.offeredItem} ⇄ {swp.receivedItem}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-full">SWAP</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Traded with {swp.partner} on {swp.date}</p>
                          <span className="text-[10px] font-bold text-emerald-600">{swp.status}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">Trade Free</span>
                    </div>
                  ))}

                  {((historyFilter === "purchases" && purchases.length === 0) ||
                    (historyFilter === "swaps" && swaps.length === 0) ||
                    (purchases.length === 0 && swaps.length === 0)) && (
                    <div className="p-8 bg-card rounded-2xl border border-border text-center text-xs text-muted-foreground">
                      No entries found in history.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. SETTINGS & EDIT PROFILE TAB */}
            {activeTab === "settings" && (
              <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
                <div>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-foreground">
                    Edit Profile & Delivery Address
                  </h2>
                  <p className="text-xs text-muted-foreground">Update your public profile, photo, live location-based delivery address, and preferences.</p>
                </div>

                {/* Profile Photo Management */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl bg-muted/40 border border-border">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/40 flex-shrink-0 bg-primary/20 flex items-center justify-center shadow-xs">
                      {userProfile.avatar ? (
                        <img src={userProfile.avatar} alt="avatar preview" className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800 }} className="text-xl text-primary">
                          {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <h4 className="text-sm font-bold text-foreground">Profile Picture</h4>
                    <p className="text-xs text-muted-foreground">Upload a JPG, PNG, or WebP photo. Click below to select a file from your computer.</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <button 
                        type="button" 
                        onClick={() => avatarFileInputRef.current?.click()} 
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
                      >
                        <Upload size={13} /> Upload New Photo
                      </button>
                      {userProfile.avatar && (
                        <button 
                          type="button" 
                          onClick={handleRemoveAvatar} 
                          className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-semibold rounded-xl transition-colors"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Address & GPS Location Detection Section */}
                <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <MapPin size={16} className="text-primary" /> Delivery Address & Location Selection
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Your delivery address is automatically detected from your location so marketplace listings match your exact city.
                      </p>
                    </div>
                    
                    {/* Auto-Detect Location Button */}
                    <button
                      type="button"
                      onClick={() => autoDetectAddressLocation("settings")}
                      disabled={isLocating}
                      className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 flex items-center justify-center gap-2 transition-all flex-shrink-0 disabled:opacity-60"
                      title="Detect your live location using device GPS"
                    >
                      {isLocating ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Detecting GPS...</span>
                        </>
                      ) : (
                        <>
                          <Navigation size={14} className="text-white" />
                          <span>Auto-Detect Live Location</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status feedback message */}
                  {locationDetectMsg && (
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold text-primary flex items-center gap-2">
                      <Compass size={14} />
                      <span>{locationDetectMsg}</span>
                    </div>
                  )}

                  {/* Address Inputs (Street & Locality are optional) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Street Address / House / Building <span className="text-muted-foreground font-normal">(Optional)</span></label>
                      <input
                        value={addrForm.addressLine}
                        onChange={e => setAddrForm(prev => ({ ...prev, addressLine: e.target.value }))}
                        placeholder="e.g. Flat 402, Palm Heights (Optional)"
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Neighborhood / Locality <span className="text-muted-foreground font-normal">(Optional)</span></label>
                      <input
                        value={addrForm.area}
                        onChange={e => setAddrForm(prev => ({ ...prev, area: e.target.value }))}
                        placeholder="e.g. Andheri West (Optional)"
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">City / Town <span className="text-primary font-bold">*</span></label>
                      <input
                        value={addrForm.city}
                        onChange={e => {
                          const val = e.target.value;
                          setAddrForm(prev => ({ ...prev, city: val }));
                        }}
                        placeholder="e.g. Mumbai, Delhi, Bengaluru"
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">State <span className="text-primary font-bold">*</span></label>
                      <input
                        value={addrForm.state}
                        onChange={e => {
                          const val = e.target.value;
                          setAddrForm(prev => ({ ...prev, state: val }));
                        }}
                        placeholder="e.g. Maharashtra, Karnataka, Uttarakhand"
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Postal / Pincode <span className="text-muted-foreground font-normal">(Optional)</span></label>
                      <input
                        value={addrForm.pincode}
                        onChange={e => setAddrForm(prev => ({ ...prev, pincode: e.target.value }))}
                        placeholder="e.g. 400058"
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Name</label>
                    <input 
                      value={userProfile.name} 
                      onChange={e => setUserProfile(prev => ({ ...prev, name: e.target.value }))} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Email Address</label>
                    <input 
                      value={userProfile.email} 
                      onChange={e => setUserProfile(prev => ({ ...prev, email: e.target.value }))} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Phone Number</label>
                    <input 
                      value={userProfile.phone || ""} 
                      onChange={e => {
                        const val = e.target.value;
                        setUserProfile(prev => ({ ...prev, phone: val }));
                      }} 
                      placeholder="+91 98201 45892" 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">City / Neighborhood (Header Display)</label>
                    <input 
                      value={userProfile.location || ""} 
                      onChange={e => {
                        const val = e.target.value;
                        setUserProfile(prev => ({ ...prev, location: val }));
                      }} 
                      placeholder="e.g. Bandra West, Mumbai" 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary" 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Bio</label>
                    <textarea 
                      rows={3} 
                      value={userProfile.bio || ""} 
                      onChange={e => setUserProfile(prev => ({ ...prev, bio: e.target.value }))} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary" 
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button onClick={handleSaveProfileChanges} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-primary/90">
                    Save Changes
                  </button>
                  <button onClick={onToggleDark} className="px-4 py-3 bg-muted rounded-xl text-xs font-bold text-foreground flex items-center gap-2">
                    {darkMode ? <Sun size={14} /> : <Moon size={14} />} {darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  </button>
                </div>
              </div>
            )}

          </main>

        </div>

      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [discoverInitialView, setDiscoverInitialView] = useState<"grid" | "map">("grid");
  
  // Auth state — persisted in localStorage with avatar support
  const [authUser, setAuthUser] = useState<{ name: string; email: string; avatar?: string | null } | null>(() => {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  });

  const handleUpdateAuthUser = (updated: { name: string; email: string; avatar?: string | null }) => {
    setAuthUser(updated);
    localStorage.setItem('authUser', JSON.stringify(updated));
  };

  // Active marketplace city — defaults to Mumbai (matches user's registered address)
  const [activeCity, setActiveCity] = useState<string>(() => {
    return localStorage.getItem('userActiveCity') || 'Mumbai';
  });

  const handleSelectCity = (city: string) => {
    setActiveCity(city);
    localStorage.setItem('userActiveCity', city);
  };

  // Sync activeCity with user's saved default address whenever logged in
  useEffect(() => {
    if (!authUser?.email) return;
    const currentHandle = getCleanUserHandle(authUser.name || authUser.email).toLowerCase();
    const stored = localStorage.getItem(`userAddresses_${currentHandle}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const def = parsed.find((a: any) => a.isDefault) || parsed[0];
        if (def && def.city && def.city.trim()) {
          setActiveCity(def.city.trim());
          localStorage.setItem('userActiveCity', def.city.trim());
        }
      } catch {}
    }
  }, [authUser?.email]);

  // Products State
  const [productsList, setProductsList] = useState<Product[]>(initialProducts);
  const [createdPhotos, setCreatedPhotos] = useState<string[]>([]);
  const [itemLocationCoords, setItemLocationCoords] = useState<{ lat: number; lng: number; name: string }>({
    lat: 19.1363,
    lng: 72.8277,
    name: 'Andheri West, Mumbai'
  });

  // Global Unread State & Global Chat Threads Polling
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!authUser?.name && !authUser?.email) {
      setTotalUnreadCount(0);
      return;
    }

    const currentHandle = getCleanUserHandle(authUser.name || authUser.email).toLowerCase();
    let active = true;

    async function pollGlobalUnread() {
      const msgs = await fetchUserChatThreadsBackend(authUser.name || '', authUser.email || '');
      if (!active || !msgs || !Array.isArray(msgs)) return;

      const storedDelTimes = localStorage.getItem(`deletedThreadAt_${currentHandle}`);
      const delTimes: Record<string, number> = storedDelTimes ? JSON.parse(storedDelTimes) : {};

      const storedReadTimestamps = localStorage.getItem(`readLastMsgTimestamp_${currentHandle}`);
      const readTimestamps: Record<string, number> = storedReadTimestamps ? JSON.parse(storedReadTimestamps) : {};

      const latestMsgsByPartner = new Map<string, { lastMsgSentAt: number; senderHandle: string; threadKey: string }>();

      for (const m of msgs) {
        if (!m.threadKey || !m.threadKey.includes('<->')) continue;
        const rawPart = m.threadKey.includes('::') ? m.threadKey.split('::')[0] : m.threadKey;
        const parts = rawPart.split('<->');
        if (parts.length < 2) continue;

        const p1 = getCleanUserHandle(parts[0]);
        const p2 = getCleanUserHandle(parts[1]);

        const p1Clean = p1.toLowerCase();
        const p2Clean = p2.toLowerCase();

        // Privacy Guard: current user must be one of the thread participants (substring match)
        const isP1Me = p1Clean === currentHandle || p1Clean.includes(currentHandle) || currentHandle.includes(p1Clean);
        const isP2Me = p2Clean === currentHandle || p2Clean.includes(currentHandle) || currentHandle.includes(p2Clean);
        if (!isP1Me && !isP2Me) continue;

        const partnerHandle = !isP1Me ? p1 : p2;
        if (partnerHandle.toLowerCase() === currentHandle) continue;

        const key = partnerHandle.toLowerCase();
        const msgTime = m.sentAt ? new Date(m.sentAt).getTime() : Date.now();
        const delTime = delTimes[key] || 0;
        if (msgTime <= delTime) continue;

        const senderHandle = getCleanUserHandle(m.senderName).toLowerCase();

        const existing = latestMsgsByPartner.get(key);
        if (!existing || msgTime > existing.lastMsgSentAt) {
          latestMsgsByPartner.set(key, {
            lastMsgSentAt: msgTime,
            senderHandle,
            threadKey: m.threadKey
          });
        }
      }

      let count = 0;
      for (const [key, data] of latestMsgsByPartner.entries()) {
        const isFromPartner = data.senderHandle !== currentHandle;
        const lastReadTime = readTimestamps[key] || 0;
        if (isFromPartner && data.lastMsgSentAt > lastReadTime + 1000) {
          count += 1;
        }
      }

      if (active) setTotalUnreadCount(count);
    }

    pollGlobalUnread();
    const interval = setInterval(pollGlobalUnread, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [authUser]);

  // Selected overlays state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSellerName, setSelectedSellerName] = useState<string | null>(null);
  const [chatTargetSeller, setChatTargetSeller] = useState<string | null>(null);
  const [chatTargetProduct, setChatTargetProduct] = useState<Product | null>(null);

  // Fetch backend database items on startup and merge local persistent listings
  useEffect(() => {
    async function loadBackendData() {
      const storedDelisted = localStorage.getItem('delistedProductIds');
      const delistedKeys: Set<string> = new Set(storedDelisted ? JSON.parse(storedDelisted) : []);

      const storedLocalListings = localStorage.getItem('localUserListings');
      const localListings: Product[] = storedLocalListings ? JSON.parse(storedLocalListings) : [];

      const backendProducts = await fetchProductsFromBackend();
      const dbItems = (backendProducts && Array.isArray(backendProducts)) ? backendProducts : [];

      const existingIds = new Set(dbItems.map((b: any) => String(b.id)));
      const existingNames = new Set(dbItems.map((b: any) => String(b.name).toLowerCase().trim()));

      // Known template item titles that must never appear in the marketplace
      const templateTitles = new Set([
        "levi's 501 jeans",
        "vintage floral kurta",
        "nike air max 90",
        "handwoven tote bag",
        "oversized linen blazer",
        "wool blend overcoat"
      ]);

      // Filter out templates and already-synced items from local listings
      const uniqueLocal = localListings.filter(l => 
        !templateTitles.has(String(l.name).toLowerCase().trim()) &&
        !existingIds.has(String(l.id)) && 
        !existingNames.has(String(l.name).toLowerCase().trim())
      );

      // Clean local storage so user browser cache never reloads template items
      try {
        const cleanedLocal = localListings.filter(l => !templateTitles.has(String(l.name).toLowerCase().trim()));
        localStorage.setItem('localUserListings', JSON.stringify(cleanedLocal));
      } catch (e) {}

      // Combined marketplace list strictly includes real user listings and database products (no templates)
      const combined = [...uniqueLocal, ...dbItems].filter(item => 
        !templateTitles.has(String(item.name).toLowerCase().trim()) &&
        !delistedKeys.has(String(item.id)) && 
        !delistedKeys.has(String(item.name).toLowerCase().trim())
      );
      setProductsList(combined);
    }
    loadBackendData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const goNav = (p: Page, mode?: string) => {
    if (p === "camera" || p === "listing_form" || p === "inbox" || p === "chat") {
      if (!authUser) {
        alert("Please sign in to view messages or list an item on ThreadSwap!");
        setPage("login");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (p === "inbox" || p === "discover" || p === "home" || p === "profile" || p === "map") {
      setChatTargetSeller(null);
      setChatTargetProduct(null);
    }
    if (mode === "map") {
      setDiscoverInitialView("map");
      setPage("discover");
    } else if (p === "map") {
      setDiscoverInitialView("map");
      setPage("discover");
    } else {
      if (p === "discover") setDiscoverInitialView("grid");
      setPage(p);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogin = (user: { name: string; email: string }) => {
    const handle = getCleanUserHandle(user.name || user.email).toLowerCase();
    setChatTargetSeller(null);
    setChatTargetProduct(null);
    try {
      localStorage.removeItem(`deletedThreadAt_${handle}`);
      localStorage.removeItem(`deletedThreadKeys_${handle}`);
    } catch {}
    setAuthUser(user);
    localStorage.setItem('authUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuthUser(null);
    setChatTargetSeller(null);
    setChatTargetProduct(null);
    localStorage.removeItem('authUser');
    localStorage.removeItem('token');
    goNav("home");
  };

  const handleStartChat = (seller: string, prod: Product) => {
    if (!authUser) {
      alert("Please sign in to message sellers on ThreadSwap!");
      setPage("login");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSelectedProduct(null);
    setSelectedSellerName(null);
    setChatTargetSeller(seller);
    setChatTargetProduct(prod);
    setPage("inbox");
  };

  const handleViewSellerProfile = (seller: string) => {
    setSelectedProduct(null);
    setSelectedSellerName(seller);
  };

  const handleListingPublished = async (newItem: any) => {
    setProductsList(prev => [newItem, ...prev]);
    defaultMapProducts.unshift(newItem);

    try {
      const storedLocalListings = localStorage.getItem('localUserListings');
      const currentLocal: Product[] = storedLocalListings ? JSON.parse(storedLocalListings) : [];
      const updatedLocal = [newItem, ...currentLocal.filter(x => String(x.id) !== String(newItem.id))];
      localStorage.setItem('localUserListings', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn("Could not save to localUserListings", e);
    }

    goNav("map", "map");
  };

  const handleDelistProduct = async (id: number | string) => {
    const targetItem = productsList.find(p => p.id === id || String(p.id) === String(id));
    const targetName = targetItem?.name ? String(targetItem.name).toLowerCase().trim() : '';

    const currentHandle = getCleanUserHandle(authUser?.name || authUser?.email || '').toLowerCase();
    const sellerHandle = getCleanUserHandle(targetItem?.seller || '').toLowerCase();
    const sellerEmail = (targetItem?.sellerEmail || '').toLowerCase();
    const userEmail = (authUser?.email || '').toLowerCase();

    const isSeller = targetItem ? (
      (!currentHandle && !userEmail) ? false :
      (currentHandle && sellerHandle && currentHandle === sellerHandle) ||
      (userEmail && sellerEmail && userEmail === sellerEmail)
    ) : true;

    if (!isSeller) {
      alert(`Permission Denied: Only ${targetItem?.seller || 'the seller who published this item'} can delist it.`);
      return;
    }

    const success = await delistProductBackend(id, currentHandle || userEmail);
    if (!success) {
      alert("Permission Denied: Only the seller who published this item can delist it.");
      return;
    }

    setProductsList(prev => prev.filter(p => p.id !== id && String(p.id) !== String(id) && (targetName ? String(p.name).toLowerCase().trim() !== targetName : true)));

    const idx = defaultMapProducts.findIndex(p => p.id === id || String(p.id) === String(id) || (targetName && String(p.name).toLowerCase().trim() === targetName));
    if (idx !== -1) {
      defaultMapProducts.splice(idx, 1);
    }

    try {
      const storedLocalListings = localStorage.getItem('localUserListings');
      if (storedLocalListings) {
        const localListings: Product[] = JSON.parse(storedLocalListings);
        const updatedLocal = localListings.filter(l => l.id !== id && String(l.id) !== String(id) && (targetName ? String(l.name).toLowerCase().trim() !== targetName : true));
        localStorage.setItem('localUserListings', JSON.stringify(updatedLocal));
      }
    } catch (e) {
      console.warn("Could not save to localUserListings on delist", e);
    }

    try {
      const storedDelisted = localStorage.getItem('delistedProductIds');
      const delistedKeys: string[] = storedDelisted ? JSON.parse(storedDelisted) : [];
      if (!delistedKeys.includes(String(id))) delistedKeys.push(String(id));
      if (targetName && !delistedKeys.includes(targetName)) delistedKeys.push(targetName);
      localStorage.setItem('delistedProductIds', JSON.stringify(delistedKeys));
    } catch (e) {
      console.warn("Could not save delisted keys", e);
    }

    setSelectedProduct(null);
  };

  const handleMarkSold = async (id: number | string) => {
    await updateProductStatusBackend(id, 'SOLD');
  };

  const renderPage = () => {
    switch (page) {
      case "home": return <HomePage productsList={productsList} onNav={goNav} onClickProduct={(p) => setSelectedProduct(p)} activeCity={activeCity} onSelectCity={handleSelectCity} />;
      case "discover": return <DiscoverPage productsList={productsList} initialView={discoverInitialView} onClickProduct={(p) => setSelectedProduct(p)} activeCity={activeCity} onSelectCity={handleSelectCity} />;
      case "map": return <DiscoverPage productsList={productsList} initialView="map" onClickProduct={(p) => setSelectedProduct(p)} activeCity={activeCity} onSelectCity={handleSelectCity} />;
      case "login": return <LoginPage onDone={() => goNav("home")} onLogin={handleLogin} />;
      case "camera": return (
        <CameraUploadModal
          onPhotosConfirmed={(photos, coords) => {
            setCreatedPhotos(photos);
            setItemLocationCoords(coords);
            setPage("listing_form");
          }}
          onClose={() => goNav("discover")}
        />
      );
      case "listing_form": return (
        <ListingFormPage
          photos={createdPhotos}
          locationCoords={itemLocationCoords}
          onPublish={handleListingPublished}
          authUser={authUser}
        />
      );
      case "inbox":
      case "chat":
        if (!authUser) return <LoginPage onDone={() => goNav("home")} onLogin={handleLogin} />;
        return (
          <InboxPage
            key={authUser?.email || authUser?.name || 'inbox'}
            activeTargetSeller={chatTargetSeller || undefined}
            activeTargetProduct={chatTargetProduct || undefined}
            onViewSellerProfile={handleViewSellerProfile}
            authUser={authUser}
          />
        );

      case "profile": return (
        <ProfilePage 
          darkMode={darkMode} 
          onToggleDark={() => setDarkMode(d => !d)} 
          onNav={goNav}
          productsList={productsList}
          onDelistProduct={handleDelistProduct}
          onMarkSold={handleMarkSold}
          onSelectProduct={(p) => setSelectedProduct(p)}
          authUser={authUser}
          onUpdateAuthUser={handleUpdateAuthUser}
          activeCity={activeCity}
          onSelectCity={handleSelectCity}
        />
      );
      default: return <HomePage productsList={productsList} onNav={goNav} onClickProduct={(p) => setSelectedProduct(p)} activeCity={activeCity} onSelectCity={handleSelectCity} />;
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background`} style={{ fontFamily: "'Inter', sans-serif" }}>
      <TopNav 
        page={page} 
        onNav={goNav} 
        darkMode={darkMode} 
        onToggleDark={() => setDarkMode(d => !d)} 
        unread={totalUnreadCount}
        authUser={authUser}
        onLogout={handleLogout}
      />
      
      <AnimatePresence mode="wait">
        <motion.div key={page} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {renderPage()}
        </motion.div>
      </AnimatePresence>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onStartChat={handleStartChat}
          onViewSellerProfile={handleViewSellerProfile}
          onDelistProduct={handleDelistProduct}
        />
      )}

      {/* Seller Profile Modal */}
      {selectedSellerName && (
        <SellerProfileModal
          sellerName={selectedSellerName}
          products={productsList}
          onClose={() => setSelectedSellerName(null)}
          onStartChat={handleStartChat}
        />
      )}
    </div>
  );
}
