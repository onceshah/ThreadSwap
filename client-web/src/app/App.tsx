import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValueEvent } from "motion/react";
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
  Loader2, Navigation, Compass, Truck, ArrowUpRight, ShieldCheck
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
  "Brand New": "bg-[#879A77] text-white",
  "Gently Used": "bg-[#C9AD93]/40 text-[#554940]",
  "Well Worn": "bg-[#73787C]/20 text-[#554940]",
};
const typeColor: Record<string, string> = {
  "Sell": "bg-[#D7E5F0] text-[#554940] border border-[#C5C6C7]/60",
  "Exchange": "bg-[#879A77]/20 text-[#554940] border border-[#879A77]/40",
  "Free/Donate": "bg-[#C9AD93]/30 text-[#554940] border border-[#C9AD93]/50",
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

// ─── INTRO SPLASH ANIMATION ──────────────────────────────────────────────────

// ─── INTRO SPLASH ANIMATION (LOGO -> FULL-SCREEN THREADSWAP -> DOCK TO HEADER) ──

function IntroSplash({ onFinish }: { onFinish: () => void }) {
  const [stage, setStage] = useState<"logo" | "text" | "docking">("logo");
  const [targetOffset, setTargetOffset] = useState({ y: -300, x: 0 });
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const heroScale = isMobile ? 1.65 : 2.25;

  useEffect(() => {
    // 1. Logo stage -> Text stage at 1200ms
    const t1 = setTimeout(() => {
      setStage("text");
    }, 1200);

    // 2. Text stage -> Docking stage at 2500ms
    const t2 = setTimeout(() => {
      const headerEl = document.getElementById("header-threadswap-title");
      if (headerEl) {
        const rect = headerEl.getBoundingClientRect();
        const deltaY = (rect.top + rect.height / 2) - (window.innerHeight / 2);
        const deltaX = (rect.left + rect.width / 2) - (window.innerWidth / 2);
        setTargetOffset({ y: deltaY, x: deltaX });
      } else {
        setTargetOffset({ y: -(window.innerHeight / 2 - 44), x: 0 });
      }
      setStage("docking");
    }, 2500);

    // 3. Docking completes at 3350ms -> site is live
    const t3 = setTimeout(() => {
      onFinish();
    }, 3350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <div
      onClick={onFinish}
      className="fixed inset-0 z-[99999] select-none cursor-pointer overflow-hidden pointer-events-auto"
    >
      {/* Background layer - smoothly fades out during docking to reveal the site beneath */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: stage === "docking" ? 0 : 1 }}
        transition={{ duration: 0.75, ease: "easeInOut" }}
        className="absolute inset-0 bg-[#FAF8F5] dark:bg-[#111213]"
      >
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full bg-gradient-to-tr from-[#879A77]/25 via-[#C9AD93]/20 to-transparent blur-3xl pointer-events-none animate-pulse" />
      </motion.div>

      {/* Stage 1: Logo (borderless) */}
      <AnimatePresence>
        {stage === "logo" && (
          <motion.div
            key="intro-logo"
            initial={{ opacity: 0, scale: 0.6, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ 
              opacity: 0, 
              scale: 0.85, 
              filter: "blur(4px)",
              transition: { duration: 0.45, ease: [0.32, 0, 0.67, 0] } 
            }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-36 h-36 md:w-44 md:h-44 p-6 rounded-3xl bg-card/85 dark:bg-card/35 backdrop-blur-md shadow-2xl flex items-center justify-center overflow-visible">
                <img 
                  src="/logo.png" 
                  alt="ThreadSwap Logo" 
                  className="w-full h-full object-contain dark:invert filter drop-shadow-md" 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 2 & 3: Full-screen ThreadSwap -> Glides to Header Center */}
      {(stage === "text" || stage === "docking") && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
          <motion.div
            initial={{ opacity: 0, scale: 1.2, filter: "blur(8px)" }}
            animate={
              stage === "text"
                ? { opacity: 1, scale: heroScale, x: 0, y: 0, filter: "blur(0px)" }
                : { opacity: 1, scale: 1, x: targetOffset.x, y: targetOffset.y, filter: "blur(0px)" }
            }
            transition={
              stage === "text"
                ? { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0.82, ease: [0.16, 1, 0.3, 1] }
            }
            style={{ transformOrigin: "center center" }}
            className="overflow-visible"
          >
            <span 
              style={{ 
                fontFamily: "'Amsterdam One', 'Amsterdam', cursive", 
                fontWeight: 400, 
                fontSize: "35px", 
                lineHeight: 1.6,
                letterSpacing: "0.01em",
                display: "inline-block",
                paddingTop: "16px",
                paddingBottom: "4px",
                paddingLeft: "6px",
                paddingRight: "14px",
                overflow: "visible"
              }} 
              className="text-foreground select-none inline-block whitespace-nowrap drop-shadow-sm"
            >
              ThreadSwap
            </span>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── TOP NAV (DYNAMIC ON SCROLL: CENTER -> FULLY TO SIDE & SCALES DOWN) ──────

function TopNav({ page, onNav, isSplashActive }: {
  page: Page; onNav: (p: Page, mode?: string) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
  isSplashActive?: boolean;
}) {
  const { scrollY } = useScroll();

  const targetLeftPx = 24;

  // Fluid physics spring: extended range (0 - 240px) + tuned spring for butter-smooth transition
  const rawProgress = useTransform(scrollY, [0, 240], [0, 1]);
  const smoothP = useSpring(rawProgress, {
    stiffness: 140,
    damping: 22,
    mass: 0.2,
    restDelta: 0.0005
  });

  // Pure GPU translateX:
  // At p=0: -50% (dead center)
  // At p=1: -50vw + targetLeftPx (fully on the left)
  const x = useTransform(
    smoothP,
    p => {
      const clampedP = Math.min(Math.max(p, 0), 1);
      return `calc(-50% * ${(1 - clampedP).toFixed(4)} - 50vw * ${clampedP.toFixed(4)} + ${(targetLeftPx * clampedP).toFixed(2)}px)`;
    }
  );
  const scale = useTransform(smoothP, [0, 1], [1, 0.72]);
  const y = useTransform(smoothP, [0, 1], [0, -4]);
  const bgOpacity = useTransform(smoothP, [0, 0.15], [0, 0.92]);

  return (
    <header className="sticky top-0 z-40 w-full overflow-visible">
      {/* Background layer animated via GPU opacity (no React re-renders) */}
      <motion.div 
        className="absolute inset-0 bg-background/90 backdrop-blur-md pointer-events-none"
        style={{ opacity: bgOpacity }}
      />

      <div 
        className="w-full px-4 sm:px-6 md:px-8 relative overflow-visible flex items-center h-[78px]"
      >

        {/* Dynamic ThreadSwap: Center -> FULLY TO SIDE with GPU transform & spring smoothness */}
        <motion.div
          id="header-threadswap-title"
          className="absolute left-1/2 z-10 flex items-center pointer-events-auto overflow-visible"
          style={{
            x,
            y,
            top: "16px",
            scale,
            transformOrigin: "left center",
            opacity: isSplashActive ? 0 : 1
          }}
        >
          <button onClick={() => onNav("home")} className="group px-2 py-0.5 overflow-visible focus:outline-none">
            <span 
              style={{ 
                fontFamily: "'Amsterdam One', 'Amsterdam', cursive", 
                fontWeight: 400, 
                fontSize: "35px", 
                lineHeight: 1.6,
                letterSpacing: "0.01em",
                display: "inline-block",
                paddingTop: "16px",
                paddingBottom: "4px",
                paddingLeft: "6px",
                paddingRight: "14px",
                overflow: "visible"
              }} 
              className="text-foreground select-none inline-block whitespace-nowrap group-hover:opacity-80 transition-opacity"
            >
              ThreadSwap
            </span>
          </button>
        </motion.div>
      </div>
    </header>
  );
}

// ─── BOTTOM CONTROLS BAR (TRANSLUCENT ACCENT BLUE #D7E5F0) ────────────────────

function BottomControlsBar({ page, onNav, darkMode, onToggleDark, unread, authUser, onLogout, canGoBack, onGoBack }: {
  page: Page; onNav: (p: Page, mode?: string) => void; darkMode: boolean; onToggleDark: () => void; unread: number;
  authUser: { name: string; email: string; avatar?: string | null } | null;
  onLogout: () => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div className="fixed bottom-3 md:bottom-5 left-0 right-0 z-50 pointer-events-none flex justify-center px-3">
      <div className="pointer-events-auto bg-[#D7E5F0]/50 dark:bg-[#132232]/50 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/65 dark:border-white/15 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.75),0_12px_40px_rgba(150,185,220,0.35)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),0_16px_45px_rgba(0,0,0,0.65)] rounded-2xl md:rounded-full px-3 md:px-5 py-2 flex items-center gap-2 md:gap-3 max-w-4xl w-full justify-between transition-all">
        {/* Left Section: Back Button (if applicable) & Navigation Links */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {canGoBack && onGoBack && (
            <button
              onClick={onGoBack}
              aria-label="Go Back"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#1f3042] dark:text-[#E2EEF8] bg-white/55 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 border border-white/70 dark:border-white/15 transition-all shadow-xs group"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              title="Go Back"
            >
              <ChevronLeft size={16} className="text-primary transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <button
            onClick={() => onNav("home")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${page === "home" ? "bg-primary text-primary-foreground shadow-xs" : "text-[#35495c] dark:text-[#BDD1E5] hover:text-[#111e2b] dark:hover:text-white hover:bg-white/45 dark:hover:bg-white/10"}`}
            style={{ fontFamily: "'Inter'" }}
          >
            <Home size={15} />
            <span className="hidden md:inline">Home</span>
          </button>

          <button
            onClick={() => onNav("discover", "grid")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${page === "discover" ? "bg-primary text-primary-foreground shadow-xs" : "text-[#35495c] dark:text-[#BDD1E5] hover:text-[#111e2b] dark:hover:text-white hover:bg-white/45 dark:hover:bg-white/10"}`}
            style={{ fontFamily: "'Inter'" }}
          >
            <Grid3X3 size={15} />
            <span className="hidden md:inline">Discover</span>
          </button>

          <button
            onClick={() => onNav("map", "map")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${page === "map" ? "bg-primary text-primary-foreground shadow-xs" : "text-[#35495c] dark:text-[#BDD1E5] hover:text-[#111e2b] dark:hover:text-white hover:bg-white/45 dark:hover:bg-white/10"}`}
            style={{ fontFamily: "'Inter'" }}
          >
            <MapIcon size={15} />
            <span className="hidden md:inline">Map</span>
          </button>
        </div>

        {/* Center: List an Item CTA */}
        <div className="flex items-center">
          <button
            onClick={() => onNav("camera")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
            style={{ fontFamily: "'Plus Jakarta Sans'" }}
          >
            <Camera size={15} />
            <span className="whitespace-nowrap">List Item</span>
          </button>
        </div>

        {/* Right Section: Messages, Search, Theme & Profile */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Glassy Search bar */}
          <div className="hidden lg:flex items-center gap-1.5 bg-white/45 dark:bg-white/5 rounded-xl px-2.5 py-1.5 w-28 focus-within:w-40 border border-white/55 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-md transition-all">
            <Search size={13} className="text-[#485f76] dark:text-[#9bb1c7] flex-shrink-0" />
            <input placeholder="Search..." className="w-full bg-transparent text-xs text-[#111e2b] dark:text-[#F2F2F2] placeholder:text-[#5f7992] dark:placeholder:text-[#8ba2b8] outline-none" style={{ fontFamily: "'Inter'" }} />
          </div>

          {/* Messages */}
          <button
            onClick={() => onNav("inbox")}
            className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${page === "inbox" || page === "chat" ? "bg-primary text-primary-foreground shadow-xs" : "text-[#2b3e51] dark:text-[#BDD1E5] hover:bg-white/45 dark:hover:bg-white/10"}`}
            title="Messages"
          >
            <MessageCircle size={16} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-card animate-pulse" />
            )}
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/45 dark:hover:bg-white/10 transition-colors text-[#2b3e51] dark:text-[#BDD1E5]"
            title="Toggle theme"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* User profile / Sign in */}
          {authUser ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-primary/15 border border-primary/25 hover:bg-primary/20 transition-colors"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden border border-primary/30 flex-shrink-0 bg-primary/20 flex items-center justify-center">
                  {authUser.avatar ? (
                    <img src={authUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-bold text-primary">
                      {authUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-[#1d2b38] dark:text-foreground hidden sm:block" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                  {authUser.name.split(' ')[0]}
                </span>
                <ChevronDown size={11} className="text-[#51667b] dark:text-muted-foreground" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#D7E5F0]/85 dark:bg-[#152332]/85 backdrop-blur-2xl border border-white/60 dark:border-white/12 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/40 dark:border-white/10">
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
            <button
              onClick={() => onNav("login")}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-xs hover:bg-primary/90 transition-all"
              style={{ fontFamily: "'Plus Jakarta Sans'" }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
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

  const reviews = mockReviews[sellerName] || [];
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-3xl rounded-3xl border border-border shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-[#554940] text-white relative flex items-center justify-between border-b border-[#C5C6C7]/40">
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
              <p className="text-white/80 text-xs mt-0.5" style={{ fontFamily: "'Inter'" }}>📍 Verified Member · Community Swapper</p>
              {reviews.length > 0 && averageRating ? (
                <div className="flex items-center gap-1 mt-1 text-amber-300 text-xs font-bold">
                  <Star size={13} className="fill-amber-300 text-amber-300" />
                  <span>{averageRating} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1 text-white/85 text-xs font-medium">
                  <Shield size={11} className="text-[#879A77]" />
                  <span>New Member · No reviews yet</span>
                </div>
              )}
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

            {reviews.length === 0 ? (
              <div className="p-6 rounded-2xl bg-muted/40 border border-border text-center text-muted-foreground space-y-1">
                <Star size={20} className="mx-auto text-muted-foreground/40 mb-1" />
                <p className="text-xs font-bold text-foreground">No Ratings Yet</p>
                <p className="text-[11px]">Peer ratings and feedback will appear here once this member completes verified wardrobe handoffs.</p>
              </div>
            ) : (
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
            )}
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
                    {product.reviews > 0 && product.rating > 0 ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Star size={10} className="fill-amber-400 text-amber-400" /> {product.rating.toFixed(1)} ({product.reviews} {product.reviews === 1 ? 'review' : 'reviews'})
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Shield size={10} className="text-[#879A77]" /> Verified Community Member
                      </span>
                    )}
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

// ─── THREADSWAP WISHLIST ICON (LOGO WITH RED-FILLED CIRCLE ON WISHLIST) ──────

function ThreadSwapWishlistIcon({ 
  wishlisted, 
  size = 15,
  className = "" 
}: { 
  wishlisted: boolean; 
  size?: number; 
  className?: string; 
}) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      className={`inline-block transition-transform duration-200 ${wishlisted ? "scale-110" : "hover:scale-105"} ${className}`}
      style={{ overflow: "visible" }}
    >
      {/* Circle center fill: turns solid bright red when wishlisted, transparent when not */}
      <path 
        d="M48.79 54.86L51.31 54.86L52.24 54.95L52.8 55.04L53.36 55.14L54.48 55.42L55.61 55.79L56.07 55.98L56.73 56.26L57.29 56.54L58.13 57.01L58.97 57.57L59.34 57.85L59.81 58.22L60.46 58.78L61.68 60.0L62.24 60.65L62.52 61.02L62.8 61.4L62.99 61.68L63.17 61.96L63.45 62.42L63.83 63.08L64.2 63.83L64.39 64.29L64.57 64.76L64.95 65.88L65.23 67.0L65.32 67.47L65.41 68.03L65.51 68.87L65.51 71.67L65.41 72.33L65.32 72.89L65.23 73.35L65.13 73.73L65.04 74.1L64.85 74.76L64.57 75.6L64.39 76.06L63.45 77.93L62.7 79.05L62.42 79.43L62.05 79.89L61.49 80.55L60.65 81.39L60.0 81.95L59.53 82.32L59.15 82.6L58.03 83.35L57.19 83.82L56.63 84.1L55.98 84.38L55.51 84.56L54.39 84.94L53.27 85.22L52.8 85.31L52.24 85.41L51.31 85.5L48.13 85.5L47.29 85.41L46.73 85.31L46.26 85.22L45.8 85.13L45.14 84.94L44.49 84.75L44.21 84.66L43.74 84.47L42.9 84.1L42.34 83.82L41.69 83.44L41.22 83.16L40.94 82.98L40.28 82.51L39.82 82.14L39.07 81.48L38.42 80.83L37.76 80.08L37.3 79.52L37.01 79.15L36.45 78.31L36.17 77.84L35.8 77.18L35.24 75.97L34.96 75.22L34.68 74.38L34.59 74.01L34.49 73.63L34.4 73.17L34.31 72.61L34.21 72.05L34.12 70.83L34.12 70.18L34.21 68.78L34.31 68.22L34.4 67.66L34.49 67.19L34.59 66.72L34.77 66.16L35.24 64.76L35.52 64.11L36.08 62.99L36.36 62.52L36.64 62.05L36.83 61.77L37.67 60.65L38.32 59.9L39.26 58.97L39.91 58.41L40.66 57.85L41.03 57.57L41.78 57.1L42.25 56.82L43.55 56.17L44.02 55.98L44.49 55.79L44.77 55.7L45.05 55.61L46.36 55.23L46.82 55.14L47.29 55.04L47.94 54.95Z" 
        fill={wishlisted ? "#EF4444" : "transparent"} 
      />

      {/* Circle ring: filled with red on wishlist, currentColor when not */}
      <path 
        d="M48.6 46.64L47.57 46.73L46.73 46.82L46.17 46.92L44.68 47.2L43.55 47.48L42.9 47.66L42.34 47.85L41.5 48.13L40.75 48.41L40.28 48.6L38.88 49.25L37.67 49.91L37.2 50.19L36.73 50.47L35.61 51.21L34.49 52.06L33.93 52.52L33.18 53.18L32.16 54.2L31.22 55.23L30.85 55.7L30.48 56.17L30.2 56.54L29.92 56.91L28.79 58.59L28.33 59.44L27.49 61.12L26.93 62.52L26.37 64.2L26.18 64.85L26.08 65.23L25.9 66.07L25.8 66.54L25.71 67.0L25.62 67.56L25.52 68.31L25.43 69.71L25.43 71.11L25.52 71.21L25.52 72.7L25.62 73.45L25.71 74.1L25.8 74.57L25.9 75.04L26.08 75.88L26.18 76.25L26.27 76.62L26.83 78.31L27.02 78.77L27.21 79.24L27.49 79.89L27.77 80.45L28.23 81.39L28.89 82.51L29.63 83.63L30.1 84.28L30.48 84.75L30.85 85.22L31.5 85.97L32.81 87.27L33.56 87.93L34.12 88.39L35.61 89.52L35.89 89.7L36.17 89.89L36.92 90.36L37.76 90.82L39.63 91.76L41.03 92.32L41.59 92.51L42.43 92.79L43.46 93.07L44.3 93.25L44.77 93.35L45.33 93.44L45.89 93.53L46.64 93.63L47.48 93.72L49.07 93.81L50.65 93.81L52.24 93.72L52.99 93.63L53.74 93.53L54.3 93.44L55.7 93.16L56.82 92.88L57.75 92.6L58.59 92.32L60.0 91.76L61.4 91.1L62.24 90.64L62.89 90.26L63.64 89.8L63.92 89.61L64.2 89.42L64.85 88.96L65.32 88.58L65.88 88.11L66.44 87.65L68.03 86.06L68.68 85.31L69.15 84.75L69.71 84.0L69.99 83.63L70.08 83.35L70.37 83.07L70.83 82.32L71.11 81.86L72.05 79.99L72.42 79.15L72.7 78.4L72.7 78.12L72.98 77.56L73.07 77.28L73.26 76.62L73.35 76.25L73.63 75.04L73.73 74.57L73.82 73.92L73.92 73.26L74.01 72.42L74.01 68.31L73.92 67.38L73.82 66.72L73.73 66.07L73.54 65.32L73.35 64.48L73.26 64.11L73.17 63.73L72.61 62.05L72.33 61.3L72.05 60.65L70.93 58.41L70.65 57.94L70.27 57.38L69.71 56.54L69.24 55.89L68.78 55.32L68.4 54.86L67.66 54.02L66.54 52.9L65.6 52.06L65.13 51.68L64.76 51.4L64.39 51.12L63.73 50.65L62.7 50.0L62.24 49.72L61.4 49.25L61.21 49.16L59.81 48.51L59.34 48.32L58.87 48.13L57.19 47.57L56.54 47.38L56.17 47.29L54.86 47.01L54.3 46.92L53.74 46.82L52.99 46.73L51.87 46.64Z M48.79 54.86L51.31 54.86L52.24 54.95L52.8 55.04L53.36 55.14L54.48 55.42L55.61 55.79L56.07 55.98L56.73 56.26L57.29 56.54L58.13 57.01L58.97 57.57L59.34 57.85L59.81 58.22L60.46 58.78L61.68 60.0L62.24 60.65L62.52 61.02L62.8 61.4L62.99 61.68L63.17 61.96L63.45 62.42L63.83 63.08L64.2 63.83L64.39 64.29L64.57 64.76L64.95 65.88L65.23 67.0L65.32 67.47L65.41 68.03L65.51 68.87L65.51 71.67L65.41 72.33L65.32 72.89L65.23 73.35L65.13 73.73L65.04 74.1L64.85 74.76L64.57 75.6L64.39 76.06L63.45 77.93L62.7 79.05L62.42 79.43L62.05 79.89L61.49 80.55L60.65 81.39L60.0 81.95L59.53 82.32L59.15 82.6L58.03 83.35L57.19 83.82L56.63 84.1L55.98 84.38L55.51 84.56L54.39 84.94L53.27 85.22L52.8 85.31L52.24 85.41L51.31 85.5L48.13 85.5L47.29 85.41L46.73 85.31L46.26 85.22L45.8 85.13L45.14 84.94L44.49 84.75L44.21 84.66L43.74 84.47L42.9 84.1L42.34 83.82L41.69 83.44L41.22 83.16L40.94 82.98L40.28 82.51L39.82 82.14L39.07 81.48L38.42 80.83L37.76 80.08L37.3 79.52L37.01 79.15L36.45 78.31L36.17 77.84L35.8 77.18L35.24 75.97L34.96 75.22L34.68 74.38L34.59 74.01L34.49 73.63L34.4 73.17L34.31 72.61L34.21 72.05L34.12 70.83L34.12 70.18L34.21 68.78L34.31 68.22L34.4 67.66L34.49 67.19L34.59 66.72L34.77 66.16L35.24 64.76L35.52 64.11L36.08 62.99L36.36 62.52L36.64 62.05L36.83 61.77L37.67 60.65L38.32 59.9L39.26 58.97L39.91 58.41L40.66 57.85L41.03 57.57L41.78 57.1L42.25 56.82L43.55 56.17L44.02 55.98L44.49 55.79L44.77 55.7L45.05 55.61L46.36 55.23L46.82 55.14L47.29 55.04L47.94 54.95Z" 
        fillRule="evenodd" 
        fill={wishlisted ? "#EF4444" : "currentColor"} 
      />

      {/* Hanger top */}
      <path 
        d="M58.69 6.09L57.75 6.19L57.19 6.28L56.73 6.37L56.07 6.56L54.95 6.93L54.48 7.12L53.36 7.68L52.9 7.96L52.06 8.52L51.68 8.8L51.21 9.18L49.81 10.58L49.35 11.14L49.07 11.51L48.51 12.35L48.13 13.01L47.94 13.38L47.66 13.94L47.38 14.59L47.1 15.44L46.92 16.09L46.82 16.46L46.73 16.84L46.64 17.86L46.54 18.14L46.08 18.7L44.96 20.11L44.02 21.13L41.69 24.12L38.23 28.23L35.89 31.22L34.68 32.72L29.35 39.26L27.21 41.78L26.37 42.81L26.08 43.27L24.31 45.33L23.56 46.36L22.72 47.38L22.16 47.94L20.95 49.53L19.64 51.12L18.99 51.77L18.7 52.15L18.42 52.62L18.14 53.18L18.05 53.46L17.96 53.74L17.86 54.11L17.86 54.67L17.77 54.76L17.77 55.23L17.86 55.32L17.86 55.89L17.96 56.26L18.05 56.54L18.24 57.01L18.33 57.19L18.52 57.47L18.8 57.85L19.45 58.5L19.83 58.78L20.29 59.06L20.48 59.15L20.95 59.34L21.23 59.44L21.6 59.53L22.44 59.62L22.72 59.62L23.66 59.53L24.03 59.44L24.31 59.34L24.59 59.25L25.34 58.87L25.62 58.69L25.9 58.5L26.55 57.85L27.39 56.82L28.14 55.79L29.45 54.2L30.76 52.62L33.46 49.44L34.31 48.41L34.59 47.94L36.55 45.52L37.86 44.02L40.56 40.56L41.5 39.54L42.62 38.04L43.55 37.01L43.83 36.55L44.68 35.52L45.61 34.49L45.89 34.03L49.72 29.35L50.19 28.79L50.56 28.51L50.84 28.79L51.49 29.73L53.27 31.97L53.74 32.44L56.17 35.61L56.63 36.08L57.29 37.01L58.13 37.95L59.53 39.72L61.49 42.25L62.7 43.83L65.32 47.29L66.35 48.79L67.84 50.75L69.8 53.27L70.83 54.58L71.3 55.04L71.58 55.51L72.05 55.98L72.61 56.82L73.35 57.75L74.1 58.5L74.38 58.69L74.66 58.87L75.22 59.15L75.69 59.34L76.06 59.44L76.53 59.53L77.93 59.53L78.4 59.44L78.68 59.34L78.96 59.25L79.33 59.06L79.89 58.78L80.27 58.5L81.11 57.66L81.3 57.38L81.58 56.91L81.76 56.45L81.86 56.17L81.95 55.79L82.04 54.86L81.95 54.11L81.86 53.64L81.76 53.36L81.67 53.08L81.3 52.34L81.11 52.06L80.64 51.49L79.52 50.09L78.49 48.79L78.03 48.32L77.75 47.85L76.44 46.36L76.06 45.89L75.78 45.42L75.32 44.96L73.92 43.18L72.23 41.03L71.67 40.19L71.21 39.72L70.37 38.51L69.34 37.3L68.12 35.71L67.94 35.33L66.35 33.28L65.32 31.97L62.8 28.89L61.86 27.58L60.74 26.27L57.1 21.6L56.17 20.39L55.89 20.01L55.61 19.64L55.23 19.08L55.04 18.8L55.04 17.58L55.14 17.21L55.42 16.37L55.51 16.18L55.61 16.0L55.79 15.72L56.82 14.69L57.1 14.5L57.57 14.22L58.03 14.03L58.31 13.94L58.69 13.85L60.18 13.85L61.02 14.13L61.21 14.22L61.49 14.41L62.42 15.34L62.61 15.62L62.7 15.81L62.8 16.0L62.89 16.28L62.99 16.74L62.99 17.68L63.08 17.96L63.17 18.24L63.45 18.8L63.64 19.08L64.39 19.83L64.67 20.01L65.23 20.29L65.51 20.39L65.79 20.48L66.25 20.57L67.56 20.57L67.94 20.48L68.22 20.39L68.5 20.29L69.24 19.92L69.62 19.64L69.99 19.27L70.37 18.8L70.55 18.52L70.65 18.33L70.93 17.49L71.02 17.02L71.02 16.0L70.93 15.15L70.83 14.69L70.55 13.57L70.46 13.29L70.37 13.01L70.08 12.45L69.62 11.51L69.34 11.04L69.06 10.67L68.78 10.3L68.03 9.46L67.84 9.27L67.1 8.62L66.72 8.34L66.44 8.15L66.16 7.96L65.69 7.68L65.13 7.4L64.2 6.93L63.08 6.56L61.96 6.28L61.4 6.19L60.56 6.09Z" 
        fill={wishlisted ? "currentColor" : "currentColor"} 
      />
    </svg>
  );
}

// ─── PRODUCT CARD (ORGANIC ARCH-TOP GALLERY SILHOUETTE) ─────────────────────────

function ProductCard({ p, wishlisted, onWishlist, onClickProduct, aiScore }: {
  p: Product; wishlisted: boolean; onWishlist: () => void; onClickProduct: (p: Product) => void; aiScore?: number;
}) {
  return (
    <motion.div 
      whileHover={{ y: -5 }} 
      onClick={() => onClickProduct(p)}
      className="bg-[#FAF9F7] dark:bg-card/90 rounded-t-[54px] rounded-b-[24px] p-3.5 border border-[#C5C6C7] cursor-pointer group shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
    >
      <div className="relative aspect-[4/5] rounded-t-[46px] rounded-b-[18px] overflow-hidden bg-white dark:bg-muted/40 mb-3.5 flex items-center justify-center border border-[#C5C6C7]/60 shadow-inner">
        <img 
          src={p.image} 
          alt={p.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
        />

        {aiScore !== undefined && aiScore >= 0.25 && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-[#879A77] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-sm">
            <Sparkles size={10} />
            <span>{Math.round(aiScore * 100)}% Match</span>
          </div>
        )}

        {/* Category / Type chips at bottom-left */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${typeColor[p.type]}`} style={{ fontFamily: "'Inter'" }}>
            {p.type.toUpperCase()}
          </span>
          <span className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-xs ${condColor[p.condition]}`} style={{ fontFamily: "'Inter'" }}>
            {p.condition}
          </span>
        </div>

        {/* Floating micro-action stack on top right */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          <button 
            type="button"
            onClick={e => { e.stopPropagation(); onWishlist(); }} 
            className="w-8 h-8 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] dark:text-[#E2EEF8] hover:scale-110 active:scale-95 transition-all"
            title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          >
            <ThreadSwapWishlistIcon wishlisted={wishlisted} size={16} />
          </button>
          <button 
            type="button"
            onClick={e => { e.stopPropagation(); onClickProduct(p); }} 
            className="w-8 h-8 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all"
            title="Quick View"
          >
            <Eye size={14} />
          </button>
          {p.images && p.images.length > 1 && (
            <div className="bg-[#554940]/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center gap-0.5 shadow-sm">
              <ImageIcon size={9} />
              <span>{p.images.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-1.5 pb-1 flex-1 flex flex-col justify-between">
        <div>
          {p.reviews > 0 && p.rating > 0 ? (
            <div className="flex items-center gap-1 mb-1 text-amber-500">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-[#554940] dark:text-stone-200" style={{ fontFamily: "'Inter'" }}>
                {p.rating.toFixed(1)}
              </span>
              <span className="text-[10px] text-[#73787C]">({p.reviews})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-[#554940] bg-[#D7E5F0]/70 px-2 py-0.5 rounded-full border border-[#C5C6C7]/60" style={{ fontFamily: "'Inter'" }}>
                New Listing
              </span>
            </div>
          )}

          <h3 
            className="text-sm font-bold text-[#000000] dark:text-stone-100 truncate group-hover:text-[#879A77] transition-colors"
            style={{ fontFamily: "'Arvo', serif" }}
          >
            {p.name}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[#73787C] text-[11px]" style={{ fontFamily: "'Inter'" }}>
            <MapPin size={10} className="text-[#879A77] flex-shrink-0" />
            <span className="truncate">{p.location || "Nearby"}</span>
            <span className="opacity-40">·</span>
            <span className="truncate">{p.seller}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-3 pt-2.5 border-t border-[#C5C6C7]/50">
          <div className="flex items-baseline gap-1.5">
            <span 
              className={`text-base font-bold ${p.price === 0 ? "text-[#879A77]" : "text-[#554940] dark:text-[#D7E5F0]"}`}
              style={{ fontFamily: "'Arvo', serif" }}
            >
              {fmt(p.price)}
            </span>
            {p.price > 0 && (
              <span className="text-[11px] text-[#73787C] line-through font-normal" style={{ fontFamily: "'Inter'" }}>
                {fmt(Math.round(p.price * 1.45))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClickProduct(p); }}
            className="w-7 h-7 rounded-full bg-[#879A77] hover:bg-[#554940] text-white flex items-center justify-center transition-all shadow-xs"
            title="View details"
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── DYNAMIC MOSAIC PRODUCT CARD (7-SLOT REPEATING EDITORIAL GRID) ───────────────

function DynamicMosaicProductCard({
  p,
  index,
  wishlisted,
  onWishlist,
  onClickProduct,
  aiScore,
}: {
  p: Product;
  index: number;
  wishlisted: boolean;
  onWishlist: () => void;
  onClickProduct: (p: Product) => void;
  aiScore?: number;
}) {
  const slot = index % 7;

  // Slot 4: Wide horizontal banner (Spans 8 columns on desktop)
  if (slot === 4) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        onClick={() => onClickProduct(p)}
        className="col-span-12 md:col-span-8 bg-[#FAF9F7] dark:bg-card/90 rounded-[32px] p-4 sm:p-6 border border-[#C5C6C7] cursor-pointer group shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row items-center gap-6"
      >
        <div className="relative w-full md:w-[48%] aspect-[4/3] md:aspect-auto md:h-full md:min-h-[260px] rounded-[24px] overflow-hidden bg-white dark:bg-muted/40 border border-[#C5C6C7]/60 shadow-inner flex-shrink-0 flex items-center justify-center">
          <img
            src={p.image}
            alt={p.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {aiScore !== undefined && aiScore >= 0.25 && (
            <div className="absolute top-3 left-3 z-10 bg-[#879A77] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-sm">
              <Sparkles size={10} />
              <span>{Math.round(aiScore * 100)}% Match</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${typeColor[p.type]}`} style={{ fontFamily: "'Inter'" }}>
              {p.type.toUpperCase()}
            </span>
            <span className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-xs ${condColor[p.condition]}`} style={{ fontFamily: "'Inter'" }}>
              {p.condition}
            </span>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onWishlist(); }}
              className="w-8 h-8 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] dark:text-[#E2EEF8] hover:scale-110 active:scale-95 transition-all"
              title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
            >
              <ThreadSwapWishlistIcon wishlisted={wishlisted} size={16} />
            </button>
            {p.images && p.images.length > 1 && (
              <div className="bg-[#554940]/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <ImageIcon size={9} />
                <span>{p.images.length}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-[52%] flex flex-col justify-between h-full py-1">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold text-[#879A77] uppercase tracking-wider" style={{ fontFamily: "'Inter'" }}>
                {p.category || "Apparel"} · {p.size ? `Size ${p.size}` : "Unisex"}
              </span>
              {p.reviews > 0 && p.rating > 0 ? (
                <div className="flex items-center gap-1 text-amber-500">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span className="text-[11px] font-bold text-[#554940] dark:text-stone-200" style={{ fontFamily: "'Inter'" }}>
                    {p.rating.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[#73787C]">({p.reviews})</span>
                </div>
              ) : (
                <span className="text-[10px] font-medium text-[#554940] bg-[#D7E5F0]/70 px-2 py-0.5 rounded-full border border-[#C5C6C7]/60" style={{ fontFamily: "'Inter'" }}>
                  New Listing
                </span>
              )}
            </div>

            <h3
              className="text-lg md:text-xl font-bold text-[#000000] dark:text-stone-100 group-hover:text-[#879A77] transition-colors leading-snug mb-2"
              style={{ fontFamily: "'Arvo', serif" }}
            >
              {p.name}
            </h3>

            {p.description && (
              <p className="text-xs text-[#73787C] dark:text-stone-300 line-clamp-2 leading-relaxed mb-3" style={{ fontFamily: "'Inter'" }}>
                {p.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-[#73787C] text-xs" style={{ fontFamily: "'Inter'" }}>
              <MapPin size={12} className="text-[#879A77] flex-shrink-0" />
              <span className="truncate">{p.location || "Nearby"}</span>
              <span className="opacity-40">·</span>
              <span className="truncate font-medium text-[#554940] dark:text-stone-300">Listed by {p.seller}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-3 border-t border-[#C5C6C7]/50">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xl font-bold ${p.price === 0 ? "text-[#879A77]" : "text-[#554940] dark:text-[#D7E5F0]"}`}
                style={{ fontFamily: "'Arvo', serif" }}
              >
                {fmt(p.price)}
              </span>
              {p.price > 0 && (
                <span className="text-xs text-[#73787C] line-through font-normal" style={{ fontFamily: "'Inter'" }}>
                  {fmt(Math.round(p.price * 1.45))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClickProduct(p); }}
              className="px-4 py-2 rounded-full bg-[#879A77] hover:bg-[#554940] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Explore Piece</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Slots 5 & 6: Half-width balanced cards (Span 6 columns each on desktop)
  if (slot === 5 || slot === 6) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        onClick={() => onClickProduct(p)}
        className="col-span-12 md:col-span-6 bg-[#FAF9F7] dark:bg-card/90 rounded-[28px] p-4 sm:p-5 border border-[#C5C6C7] cursor-pointer group shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row items-center gap-5"
      >
        <div className="relative w-full sm:w-[46%] aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[210px] rounded-[22px] overflow-hidden bg-white dark:bg-muted/40 border border-[#C5C6C7]/60 shadow-inner flex-shrink-0 flex items-center justify-center">
          <img
            src={p.image}
            alt={p.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${typeColor[p.type]}`} style={{ fontFamily: "'Inter'" }}>
              {p.type.toUpperCase()}
            </span>
            <span className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-xs ${condColor[p.condition]}`} style={{ fontFamily: "'Inter'" }}>
              {p.condition}
            </span>
          </div>
          <div className="absolute top-2.5 right-2.5 z-10">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onWishlist(); }}
              className="w-8 h-8 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] dark:text-[#E2EEF8] hover:scale-110 active:scale-95 transition-all"
              title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
            >
              <ThreadSwapWishlistIcon wishlisted={wishlisted} size={16} />
            </button>
          </div>
        </div>

        <div className="w-full sm:w-[54%] flex flex-col justify-between h-full py-1">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold text-[#879A77] uppercase tracking-wider" style={{ fontFamily: "'Inter'" }}>
                {p.category || "Apparel"}
              </span>
              {p.reviews > 0 && p.rating > 0 ? (
                <div className="flex items-center gap-1 text-amber-500">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span className="text-[11px] font-bold text-[#554940] dark:text-stone-200" style={{ fontFamily: "'Inter'" }}>
                    {p.rating.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[#73787C]">({p.reviews})</span>
                </div>
              ) : (
                <span className="text-[10px] font-medium text-[#554940] bg-[#D7E5F0]/70 px-2 py-0.5 rounded-full border border-[#C5C6C7]/60" style={{ fontFamily: "'Inter'" }}>
                  New Listing
                </span>
              )}
            </div>

            <h3
              className="text-base font-bold text-[#000000] dark:text-stone-100 group-hover:text-[#879A77] transition-colors leading-snug truncate"
              style={{ fontFamily: "'Arvo', serif" }}
            >
              {p.name}
            </h3>

            <div className="flex items-center gap-1.5 mt-2 text-[#73787C] text-[11px]" style={{ fontFamily: "'Inter'" }}>
              <MapPin size={11} className="text-[#879A77] flex-shrink-0" />
              <span className="truncate">{p.location || "Nearby"}</span>
              <span className="opacity-40">·</span>
              <span className="truncate">{p.seller}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#C5C6C7]/50">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-lg font-bold ${p.price === 0 ? "text-[#879A77]" : "text-[#554940] dark:text-[#D7E5F0]"}`}
                style={{ fontFamily: "'Arvo', serif" }}
              >
                {fmt(p.price)}
              </span>
              {p.price > 0 && (
                <span className="text-[11px] text-[#73787C] line-through font-normal" style={{ fontFamily: "'Inter'" }}>
                  {fmt(Math.round(p.price * 1.45))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClickProduct(p); }}
              className="w-8 h-8 rounded-full bg-[#879A77] hover:bg-[#554940] text-white flex items-center justify-center transition-all shadow-xs"
              title="View details"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Slots 1, 2, 3: Tall Vertical Portrait Cards (Span 4 cols, 2 rows on desktop)
  if (slot === 1 || slot === 2 || slot === 3) {
    return (
      <motion.div
        whileHover={{ y: -5 }}
        onClick={() => onClickProduct(p)}
        className="col-span-12 md:col-span-4 md:row-span-2 bg-[#FAF9F7] dark:bg-card/90 rounded-[32px] p-4 border border-[#C5C6C7] cursor-pointer group shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
      >
        <div className="relative aspect-[3/4] md:aspect-auto md:flex-1 md:min-h-[380px] rounded-[24px] overflow-hidden bg-white dark:bg-muted/40 mb-4 flex items-center justify-center border border-[#C5C6C7]/60 shadow-inner">
          <img
            src={p.image}
            alt={p.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {aiScore !== undefined && aiScore >= 0.25 && (
            <div className="absolute top-3 left-3 z-10 bg-[#879A77] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-sm">
              <Sparkles size={10} />
              <span>{Math.round(aiScore * 100)}% Match</span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${typeColor[p.type]}`} style={{ fontFamily: "'Inter'" }}>
              {p.type.toUpperCase()}
            </span>
            <span className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-xs ${condColor[p.condition]}`} style={{ fontFamily: "'Inter'" }}>
              {p.condition}
            </span>
          </div>

          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onWishlist(); }}
              className="w-8 h-8 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] dark:text-[#E2EEF8] hover:scale-110 active:scale-95 transition-all"
              title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
            >
              <ThreadSwapWishlistIcon wishlisted={wishlisted} size={16} />
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClickProduct(p); }}
              className="w-8 h-8 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all"
              title="Quick View"
            >
              <Eye size={14} />
            </button>
            {p.images && p.images.length > 1 && (
              <div className="bg-[#554940]/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center gap-0.5 shadow-sm">
                <ImageIcon size={9} />
                <span>{p.images.length}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-1 flex flex-col justify-between">
          <div>
            {p.reviews > 0 && p.rating > 0 ? (
              <div className="flex items-center gap-1 mb-1 text-amber-500">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-bold text-[#554940] dark:text-stone-200" style={{ fontFamily: "'Inter'" }}>
                  {p.rating.toFixed(1)}
                </span>
                <span className="text-[10px] text-[#73787C]">({p.reviews})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-medium text-[#554940] bg-[#D7E5F0]/70 px-2 py-0.5 rounded-full border border-[#C5C6C7]/60" style={{ fontFamily: "'Inter'" }}>
                  New Listing
                </span>
              </div>
            )}

            <h3
              className="text-base font-bold text-[#000000] dark:text-stone-100 truncate group-hover:text-[#879A77] transition-colors"
              style={{ fontFamily: "'Arvo', serif" }}
            >
              {p.name}
            </h3>

            <div className="flex items-center gap-1.5 mt-1 text-[#73787C] text-[11px]" style={{ fontFamily: "'Inter'" }}>
              <MapPin size={11} className="text-[#879A77] flex-shrink-0" />
              <span className="truncate">{p.location || "Nearby"}</span>
              <span className="opacity-40">·</span>
              <span className="truncate">{p.seller}</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-3 pt-2.5 border-t border-[#C5C6C7]/50">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-lg font-bold ${p.price === 0 ? "text-[#879A77]" : "text-[#554940] dark:text-[#D7E5F0]"}`}
                style={{ fontFamily: "'Arvo', serif" }}
              >
                {fmt(p.price)}
              </span>
              {p.price > 0 && (
                <span className="text-[11px] text-[#73787C] line-through font-normal" style={{ fontFamily: "'Inter'" }}>
                  {fmt(Math.round(p.price * 1.45))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClickProduct(p); }}
              className="w-8 h-8 rounded-full bg-[#879A77] hover:bg-[#554940] text-white flex items-center justify-center transition-all shadow-xs"
              title="View details"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Slot 0: Top-left Compact Card (Span 4 cols, 1 row)
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => onClickProduct(p)}
      className="col-span-12 md:col-span-4 row-span-1 bg-[#FAF9F7] dark:bg-card/90 rounded-[28px] p-4 border border-[#C5C6C7] cursor-pointer group shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
    >
      <div className="relative aspect-[16/10] sm:aspect-[4/3] rounded-[20px] overflow-hidden bg-white dark:bg-muted/40 mb-3 flex items-center justify-center border border-[#C5C6C7]/60 shadow-inner">
        <img
          src={p.image}
          alt={p.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {aiScore !== undefined && aiScore >= 0.25 && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-[#879A77] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-sm">
            <Sparkles size={10} />
            <span>{Math.round(aiScore * 100)}% Match</span>
          </div>
        )}

        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${typeColor[p.type]}`} style={{ fontFamily: "'Inter'" }}>
            {p.type.toUpperCase()}
          </span>
          <span className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-xs ${condColor[p.condition]}`} style={{ fontFamily: "'Inter'" }}>
            {p.condition}
          </span>
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onWishlist(); }}
            className="w-7 h-7 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm shadow-sm flex items-center justify-center text-[#554940] dark:text-[#E2EEF8] hover:scale-110 active:scale-95 transition-all"
            title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          >
            <ThreadSwapWishlistIcon wishlisted={wishlisted} size={14} />
          </button>
        </div>
      </div>

      <div className="px-1 flex flex-col justify-between">
        <div>
          {p.reviews > 0 && p.rating > 0 ? (
            <div className="flex items-center gap-1 mb-1 text-amber-500">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-[#554940] dark:text-stone-200" style={{ fontFamily: "'Inter'" }}>
                {p.rating.toFixed(1)}
              </span>
              <span className="text-[10px] text-[#73787C]">({p.reviews})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-medium text-[#554940] bg-[#D7E5F0]/70 px-2 py-0.5 rounded-full border border-[#C5C6C7]/60" style={{ fontFamily: "'Inter'" }}>
                New Listing
              </span>
            </div>
          )}

          <h3
            className="text-sm font-bold text-[#000000] dark:text-stone-100 truncate group-hover:text-[#879A77] transition-colors"
            style={{ fontFamily: "'Arvo', serif" }}
          >
            {p.name}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[#73787C] text-[11px]" style={{ fontFamily: "'Inter'" }}>
            <MapPin size={10} className="text-[#879A77] flex-shrink-0" />
            <span className="truncate">{p.location || "Nearby"}</span>
            <span className="opacity-40">·</span>
            <span className="truncate">{p.seller}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-2.5 pt-2 border-t border-[#C5C6C7]/50">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base font-bold ${p.price === 0 ? "text-[#879A77]" : "text-[#554940] dark:text-[#D7E5F0]"}`}
              style={{ fontFamily: "'Arvo', serif" }}
            >
              {fmt(p.price)}
            </span>
            {p.price > 0 && (
              <span className="text-[11px] text-[#73787C] line-through font-normal" style={{ fontFamily: "'Inter'" }}>
                {fmt(Math.round(p.price * 1.45))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClickProduct(p); }}
            className="w-7 h-7 rounded-full bg-[#879A77] hover:bg-[#554940] text-white flex items-center justify-center transition-all shadow-xs"
            title="View details"
          >
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── HOME PAGE (REAL USER LISTINGS IN ORGANIC GALLERY & NEW COLOR PALETTE) ─────

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
  const [activeCollectionTab, setActiveCollectionTab] = useState<"all" | "latest" | "swaps" | "nearby">("all");
  const [heroSlide, setHeroSlide] = useState(0);

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

  // Real items for hero and bento spotlight
  const activeHeroItem = productsList.length > 0
    ? productsList[heroSlide % productsList.length]
    : null;

  const spotlightItem0 = productsList[0] || null;
  const spotlightItem1 = productsList.length > 1 ? productsList[1] : spotlightItem0;
  const spotlightItem2 = productsList.length > 2 ? productsList[2] : (spotlightItem1 || spotlightItem0);

  // Live GPS Geolocation Auto-Detection Handler
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (Math.abs(lat - 30.4035) < 0.4 && Math.abs(lng - 77.9340) < 0.4) {
          if (onSelectCity) onSelectCity('Vikasnagar');
          setActiveCollectionTab('nearby');
          return;
        }
        if (Math.abs(lat - 30.3165) < 0.5 && Math.abs(lng - 78.0322) < 0.5) {
          if (onSelectCity) onSelectCity('Dehradun');
          setActiveCollectionTab('nearby');
          return;
        }
        if (Math.abs(lat - 19.0760) < 0.6 && Math.abs(lng - 72.8777) < 0.6) {
          if (onSelectCity) onSelectCity('Mumbai');
          setActiveCollectionTab('nearby');
          return;
        }
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          if (res.ok) {
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.suburb || data.address?.village || data.address?.state_district;
            if (city && onSelectCity) {
              onSelectCity(city);
              setActiveCollectionTab('nearby');
            }
          }
        } catch (e) {
          if (onSelectCity) onSelectCity('Vikasnagar');
          setActiveCollectionTab('nearby');
        }
      },
      () => {
        alert("Location access denied or unavailable. Please pick your city from the dropdown list.");
      }
    );
  };

  // Determine which products to show based on collection tab
  const getFilteredCollection = () => {
    switch (activeCollectionTab) {
      case "latest":
        return [...productsList].reverse();
      case "swaps":
        return productsList.filter(p => p.type === "Exchange" || p.price === 0);
      case "nearby":
        return productsList.filter(p => isProductInCity(p, activeCity));
      case "all":
      default:
        return productsList;
    }
  };

  const displayedProducts = getFilteredCollection();

  return (
    <div className="bg-[#FAF9F6] dark:bg-background min-h-screen text-[#000000]">
      {/* ─── 1. HERO SECTION (SPOTLIGHTING REAL USER LISTING) ─── */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Column: Headline & Action */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#D7E5F0] border border-[#C5C6C7]/70 rounded-full px-4 py-1.5 shadow-xs">
              <Leaf size={14} className="text-[#879A77]" />
              <span className="text-[#554940] text-xs font-bold tracking-wider uppercase" style={{ fontFamily: "'Inter'" }}>
                Sustainable Circular Wardrobe
              </span>
            </div>

            <h1 
              style={{ fontFamily: "'Arvo', serif", fontWeight: 700, lineHeight: 1.15 }} 
              className="text-4xl sm:text-5xl lg:text-6xl text-[#000000] tracking-tight"
            >
              Discover Unique <br />
              <span className="text-[#879A77]">Pre-Loved Drops</span>
            </h1>

            <p className="text-[#73787C] text-base sm:text-lg max-w-xl leading-relaxed" style={{ fontFamily: "'Inter'" }}>
              Exchange, thrift, and curate authentic wardrobe pieces with verified members in your city. Direct neighborhood handoffs with zero waste.
            </p>

            <div className="flex items-center gap-4 flex-wrap pt-2">
              <button 
                onClick={() => onNav("discover", "grid")} 
                style={{ fontFamily: "'Inter'", fontWeight: 700 }} 
                className="px-8 py-4 bg-[#879A77] hover:bg-[#554940] text-white rounded-full text-sm font-bold flex items-center gap-2.5 shadow-lg hover:shadow-xl transition-all hover:gap-3.5"
              >
                <span>Browse Catalog</span>
                <ArrowRight size={16} />
              </button>

              <button 
                onClick={() => onNav("map", "map")} 
                style={{ fontFamily: "'Inter'", fontWeight: 600 }} 
                className="px-6 py-4 bg-[#D7E5F0] border border-[#C5C6C7] text-[#554940] hover:bg-[#C5C6C7]/50 rounded-full text-sm font-semibold flex items-center gap-2 shadow-xs transition-all"
              >
                <MapPin size={16} className="text-[#879A77]" />
                <span>Map Near {activeCity}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Hero Real Listing Showcase Arch Frame */}
          <div className="lg:col-span-5 relative">
            {activeHeroItem ? (
              <div 
                onClick={() => onClickProduct(activeHeroItem)}
                className="relative aspect-[4/5] rounded-t-[54px] rounded-b-[32px] overflow-hidden shadow-2xl border border-[#C5C6C7]/80 bg-white group cursor-pointer"
              >
                <img 
                  src={activeHeroItem.image} 
                  alt={activeHeroItem.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000000]/85 via-[#000000]/25 to-transparent" />

                {/* Top Badge: Condition & Type */}
                <div className="absolute top-5 left-5 z-10 flex items-center gap-2">
                  <span className="bg-[#D7E5F0] text-[#554940] text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md" style={{ fontFamily: "'Inter'" }}>
                    {activeHeroItem.condition} · {activeHeroItem.type.toUpperCase()}
                  </span>
                </div>

                {/* Carousel Controls to Cycle Real Listings */}
                {productsList.length > 1 && (
                  <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHeroSlide((prev) => (prev > 0 ? prev - 1 : productsList.length - 1));
                      }}
                      className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#554940] shadow-md backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                      title="Previous Listing"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHeroSlide((prev) => (prev < productsList.length - 1 ? prev + 1 : 0));
                      }}
                      className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#554940] shadow-md backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                      title="Next Listing"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                {/* Bottom Caption Container */}
                <div className="absolute bottom-6 left-6 right-6 z-10 text-white space-y-2">
                  <span className="text-[11px] font-semibold text-[#879A77] uppercase tracking-wider block" style={{ fontFamily: "'Inter'" }}>
                    📍 {activeHeroItem.location || "Local Pickup Available"} · Listed by {activeHeroItem.seller}
                  </span>
                  <h3 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-xl sm:text-2xl text-white leading-tight">
                    {activeHeroItem.name}
                  </h3>
                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span style={{ fontFamily: "'Arvo', serif" }} className="text-xl font-bold text-white">
                        {fmt(activeHeroItem.price)}
                      </span>
                      {activeHeroItem.price > 0 && (
                        <span className="text-xs text-white/60 line-through">
                          {fmt(Math.round(activeHeroItem.price * 1.45))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#D7E5F0] group-hover:text-white transition-colors">
                      <span>View details</span>
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-[4/5] rounded-t-[54px] rounded-b-[32px] bg-[#D7E5F0]/30 border border-[#C5C6C7] flex items-center justify-center text-[#73787C]">
                <span>No active listings</span>
              </div>
            )}
          </div>

        </div>
      </section>



      {/* ─── 3. FEATURED GALLERY LISTINGS (MATCHING USER REFERENCE DESIGN) ─── */}
      {productsList.length > 0 && spotlightItem0 && (
        <section className="max-w-7xl mx-auto px-6 py-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold text-[#879A77] uppercase tracking-widest block mb-1" style={{ fontFamily: "'Inter'" }}>
                Editorial Community Spotlight
              </span>
              <h2 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-3xl text-[#000000] dark:text-stone-100">
                Featured Gallery Listings
              </h2>
              <p className="text-xs text-[#73787C] mt-1" style={{ fontFamily: "'Inter'" }}>
                Curated pre-loved wardrobe highlights styled after our signature editorial lookbook
              </p>
            </div>
            <button
              onClick={() => onNav("discover", "grid")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#879A77] hover:text-[#554940] transition-colors"
              style={{ fontFamily: "'Inter'" }}
            >
              <span>Explore All Pieces</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Tall Featured Card (Chairs Style) */}
            <div 
              onClick={() => onClickProduct(spotlightItem0)}
              className="lg:col-span-6 bg-[#FAF9F7] dark:bg-card/90 rounded-[32px] p-6 sm:p-8 border border-[#C5C6C7] flex flex-col justify-between group cursor-pointer shadow-xs hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#E5ECE3] text-[#2B5138] text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: "'Inter'" }}>
                    {spotlightItem0.category || "Apparel"} · {spotlightItem0.condition}
                  </span>
                  <span className="text-[10px] font-bold bg-[#879A77] text-white px-2.5 py-1 rounded-full shadow-xs uppercase tracking-wider" style={{ fontFamily: "'Inter'" }}>
                    Spotlight #1
                  </span>
                </div>

                <h3 
                  style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} 
                  className="text-2xl sm:text-3xl text-[#000000] dark:text-stone-100 leading-tight group-hover:text-[#879A77] transition-colors mb-3"
                >
                  {spotlightItem0.name}
                </h3>

                <p className="text-xs text-[#73787C] dark:text-stone-300 max-w-md leading-relaxed mb-6 line-clamp-2" style={{ fontFamily: "'Inter'" }}>
                  {spotlightItem0.description || "Authentic verified pre-loved piece saved from textile waste, in prime condition."}
                </p>

                {/* Bullets & Specs List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs text-[#554940] dark:text-stone-300 mb-6" style={{ fontFamily: "'Inter'" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#879A77]" />
                    <span>Type: <strong>{spotlightItem0.type}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#879A77]" />
                    <span>Condition: <strong>{spotlightItem0.condition}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#879A77]" />
                    <span>Location: <strong>{spotlightItem0.location || "Nearby"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#879A77]" />
                    <span>Seller: <strong>{spotlightItem0.seller}</strong></span>
                  </div>
                </div>
              </div>

              {/* Large Product Showcase Image */}
              <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full rounded-[24px] overflow-hidden bg-white dark:bg-muted/40 border border-[#C5C6C7]/70 shadow-inner my-4 flex items-center justify-center">
                <img 
                  src={spotlightItem0.image} 
                  alt={spotlightItem0.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <span className="inline-flex items-center gap-1.5 bg-white/95 text-[#554940] text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                    <Eye size={13} /> Quick View Details
                  </span>
                </div>
              </div>

              {/* Bottom Price & Action Row */}
              <div className="flex items-center justify-between pt-4 border-t border-[#C5C6C7]/50 mt-2">
                <div className="flex items-baseline gap-2">
                  <span style={{ fontFamily: "'Arvo', serif" }} className="text-2xl sm:text-3xl font-bold text-[#554940] dark:text-[#D7E5F0]">
                    {fmt(spotlightItem0.price)}
                  </span>
                  {spotlightItem0.price > 0 && (
                    <span className="text-xs text-[#73787C] line-through">
                      {fmt(Math.round(spotlightItem0.price * 1.45))}
                    </span>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClickProduct(spotlightItem0); }}
                  className="px-5 py-2.5 bg-[#879A77] hover:bg-[#554940] text-white rounded-full text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                >
                  <span>Explore Piece</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Right Column: Two Stacked Cards (Sofa & Lighting Style) */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-6">
              {/* Top Stacked Card: spotlightItem1 */}
              {spotlightItem1 && (
                <div 
                  onClick={() => onClickProduct(spotlightItem1)}
                  className="bg-[#FAF9F7] dark:bg-card/90 rounded-[28px] p-5 sm:p-6 border border-[#C5C6C7] flex flex-col sm:flex-row items-center justify-between group cursor-pointer shadow-xs hover:shadow-xl transition-all duration-300 gap-5 flex-1"
                >
                  <div className="w-full sm:w-[54%] flex flex-col justify-between h-full py-1">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-[#FAF0E6] text-[#C85A32] text-[10px] font-bold uppercase tracking-wider mb-2" style={{ fontFamily: "'Inter'" }}>
                        {spotlightItem1.category || "Apparel"} · {spotlightItem1.condition}
                      </span>
                      <h4 
                        style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} 
                        className="text-lg sm:text-xl text-[#000000] dark:text-stone-100 group-hover:text-[#879A77] transition-colors truncate mb-2"
                      >
                        {spotlightItem1.name}
                      </h4>
                      <div className="space-y-1 text-xs text-[#554940] dark:text-stone-300 mb-3" style={{ fontFamily: "'Inter'" }}>
                        <div>• Type: <strong>{spotlightItem1.type}</strong></div>
                        <div>• Location: <strong>{spotlightItem1.location || "Nearby"}</strong></div>
                        <div>• Seller: <strong>{spotlightItem1.seller}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#C5C6C7]/50 mt-2">
                      <span style={{ fontFamily: "'Arvo', serif" }} className="text-xl font-bold text-[#554940] dark:text-[#D7E5F0]">
                        {fmt(spotlightItem1.price)}
                      </span>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClickProduct(spotlightItem1); }}
                        className="w-8 h-8 rounded-full bg-[#879A77] hover:bg-[#554940] text-white flex items-center justify-center transition-all shadow-xs"
                        title="View details"
                      >
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="w-full sm:w-[46%] aspect-[4/3] sm:aspect-square rounded-[22px] overflow-hidden bg-white dark:bg-muted/40 border border-[#C5C6C7]/70 shadow-inner flex-shrink-0 flex items-center justify-center">
                    <img 
                      src={spotlightItem1.image} 
                      alt={spotlightItem1.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
              )}

              {/* Bottom Stacked Card: spotlightItem2 */}
              {spotlightItem2 && (
                <div 
                  onClick={() => onClickProduct(spotlightItem2)}
                  className="bg-[#FAF9F7] dark:bg-card/90 rounded-[28px] p-5 sm:p-6 border border-[#C5C6C7] flex flex-col sm:flex-row items-center justify-between group cursor-pointer shadow-xs hover:shadow-xl transition-all duration-300 gap-5 flex-1"
                >
                  <div className="w-full sm:w-[54%] flex flex-col justify-between h-full py-1">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-[#EBF2F7] text-[#554940] text-[10px] font-bold uppercase tracking-wider mb-2" style={{ fontFamily: "'Inter'" }}>
                        {spotlightItem2.category || "Apparel"} · {spotlightItem2.condition}
                      </span>
                      <h4 
                        style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} 
                        className="text-lg sm:text-xl text-[#000000] dark:text-stone-100 group-hover:text-[#879A77] transition-colors truncate mb-2"
                      >
                        {spotlightItem2.name}
                      </h4>
                      <div className="space-y-1 text-xs text-[#554940] dark:text-stone-300 mb-3" style={{ fontFamily: "'Inter'" }}>
                        <div>• Type: <strong>{spotlightItem2.type}</strong></div>
                        <div>• Location: <strong>{spotlightItem2.location || "Nearby"}</strong></div>
                        <div>• Seller: <strong>{spotlightItem2.seller}</strong></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#C5C6C7]/50 mt-2">
                      <span style={{ fontFamily: "'Arvo', serif" }} className="text-xl font-bold text-[#554940] dark:text-[#D7E5F0]">
                        {fmt(spotlightItem2.price)}
                      </span>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClickProduct(spotlightItem2); }}
                        className="w-8 h-8 rounded-full bg-[#879A77] hover:bg-[#554940] text-white flex items-center justify-center transition-all shadow-xs"
                        title="View details"
                      >
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="w-full sm:w-[46%] aspect-[4/3] sm:aspect-square rounded-[22px] overflow-hidden bg-white dark:bg-muted/40 border border-[#C5C6C7]/70 shadow-inner flex-shrink-0 flex items-center justify-center">
                    <img 
                      src={spotlightItem2.image} 
                      alt={spotlightItem2.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── 4. "OUR PRODUCTS COLLECTIONS" WITH FILTER PILLS & ARCH GALLERY CARDS ─── */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="text-xs font-bold text-[#879A77] uppercase tracking-widest block mb-1" style={{ fontFamily: "'Inter'" }}>
              Curated Community Pieces
            </span>
            <h2 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-3xl sm:text-4xl text-[#000000]">
              Our Products Collections
            </h2>
            <p className="text-xs text-[#73787C] mt-1" style={{ fontFamily: "'Inter'" }}>
              Browse authentic verified listings in your city and nationwide
            </p>
          </div>

          {/* Collection Filter Pills & Dynamic City Switcher with Live GPS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-[#FAF9F7] border border-[#C5C6C7] p-1 rounded-full flex items-center shadow-xs">
              <button
                onClick={() => setActiveCollectionTab("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCollectionTab === "all"
                    ? "bg-[#879A77] text-white shadow-xs"
                    : "text-[#554940] hover:text-[#000000]"
                }`}
                style={{ fontFamily: "'Inter'" }}
              >
                All Products ({productsList.length})
              </button>
              <button
                onClick={() => setActiveCollectionTab("latest")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCollectionTab === "latest"
                    ? "bg-[#879A77] text-white shadow-xs"
                    : "text-[#554940] hover:text-[#000000]"
                }`}
                style={{ fontFamily: "'Inter'" }}
              >
                Latest Drops
              </button>
              <button
                onClick={() => setActiveCollectionTab("swaps")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCollectionTab === "swaps"
                    ? "bg-[#879A77] text-white shadow-xs"
                    : "text-[#554940] hover:text-[#000000]"
                }`}
                style={{ fontFamily: "'Inter'" }}
              >
                Best Swaps
              </button>
              <button
                onClick={() => setActiveCollectionTab("nearby")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCollectionTab === "nearby"
                    ? "bg-[#879A77] text-white shadow-xs"
                    : "text-[#554940] hover:text-[#000000]"
                }`}
                style={{ fontFamily: "'Inter'" }}
              >
                <MapPin size={12} className={activeCollectionTab === "nearby" ? "text-white" : "text-[#879A77]"} />
                <span>Near {activeCity === 'All' ? 'You' : activeCity}</span>
              </button>
            </div>

            {/* City selector dropdown & GPS Auto-Detect Button */}
            <div className="flex items-center gap-1.5 bg-[#FAF9F7] border border-[#C5C6C7] pl-3.5 pr-2 py-1.5 rounded-full shadow-xs">
              <MapPin size={13} className="text-[#879A77] flex-shrink-0" />
              <select 
                value={activeCity} 
                onChange={e => {
                  const selected = e.target.value;
                  if (onSelectCity) onSelectCity(selected);
                  if (selected !== 'All') {
                    setActiveCollectionTab("nearby");
                  }
                }} 
                className="bg-transparent text-xs font-bold text-[#554940] outline-none cursor-pointer pr-1"
              >
                {Array.from(new Set([
                  activeCity,
                  ...productsList.map(p => p.location ? p.location.split(',')[0].trim() : '').filter(Boolean),
                  'Vikasnagar',
                  'Dehradun',
                  'Mumbai',
                  'All'
                ])).filter(Boolean).map(c => (
                  <option key={c} value={c}>{c === 'All' ? 'All Locations' : (c === activeCity ? `${c} (Selected)` : c)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDetectGps}
                title="Auto-Detect Live Location via GPS"
                className="w-6 h-6 rounded-full hover:bg-[#D7E5F0] text-[#879A77] hover:text-[#554940] flex items-center justify-center transition-colors shadow-xs"
              >
                <Navigation size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Gallery Grid of Real Products in Arch Gallery Silhouette */}
        {displayedProducts.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#D7E5F0]/25 border border-[#C5C6C7] text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#879A77]/20 text-[#879A77] flex items-center justify-center">
              <ShoppingBag size={24} />
            </div>
            <h3 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-lg text-[#000000]">
              No Items Found in this Filter
            </h3>
            <p className="text-xs text-[#73787C] max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'Inter'" }}>
              No listings currently match the active filter for <strong>{activeCity}</strong>. You can switch to All Products or list an item!
            </p>
            <div className="flex items-center justify-center gap-3 pt-3">
              <button 
                onClick={() => setActiveCollectionTab("all")} 
                className="px-5 py-2.5 bg-[#879A77] text-white text-xs font-bold rounded-full shadow-xs hover:bg-[#554940] transition-colors"
              >
                Show All Products ({productsList.length})
              </button>
              <button 
                onClick={() => onNav("camera")} 
                className="px-5 py-2.5 bg-white border border-[#C5C6C7] text-[#554940] text-xs font-bold rounded-full hover:bg-muted transition-colors"
              >
                List a Piece in {activeCity}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-stretch">
            {displayedProducts.map((p, idx) => (
              <DynamicMosaicProductCard 
                key={p.id} 
                p={p} 
                index={idx}
                wishlisted={wishlist.includes(p.id)} 
                onWishlist={() => setWishlist(w => w.includes(p.id) ? w.filter(i => i !== p.id) : [...w, p.id])} 
                onClickProduct={onClickProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── 5. FLASH DROPS CALLOUT BANNER ─── */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="rounded-[36px] bg-gradient-to-r from-[#554940] via-[#63564C] to-[#554940] text-white p-8 md:p-12 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-[#879A77]/30">
          <div className="space-y-3 max-w-xl text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 bg-[#879A77]/30 backdrop-blur-md rounded-full px-3.5 py-1 text-xs font-bold text-[#D7E5F0]">
              <Sparkles size={13} />
              <span>COMMUNITY CIRCULAR EXCHANGE</span>
            </div>
            <h2 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-3xl sm:text-4xl text-white leading-tight">
              Have unworn pieces hanging in your closet?
            </h2>
            <p className="text-[#D7E5F0]/90 text-sm leading-relaxed" style={{ fontFamily: "'Inter'" }}>
              Give them a second life. List in under 60 seconds, connect with local buyers, and save textiles from landfills.
            </p>
          </div>

          <div className="z-10 flex flex-col sm:flex-row items-center gap-3.5">
            <button 
              onClick={() => onNav("camera")}
              style={{ fontFamily: "'Inter'", fontWeight: 700 }}
              className="px-8 py-4 bg-[#879A77] hover:bg-white hover:text-[#554940] text-white rounded-full text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Camera size={16} />
              <span>List an Item Now</span>
            </button>
            <button 
              onClick={() => onNav("discover")}
              style={{ fontFamily: "'Inter'", fontWeight: 600 }}
              className="px-6 py-4 bg-white/15 border border-white/25 text-white rounded-full text-sm font-semibold hover:bg-white/25 transition-all"
            >
              Browse All Items
            </button>
          </div>

          {/* Ambient background decoration */}
          <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-[#879A77]/10 pointer-events-none blur-2xl" />
        </div>
      </section>

      {/* ─── 6. HOW IT WORKS ─── */}
      <section className="bg-[#FAF9F7] border-t border-[#C5C6C7]/60 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#879A77] uppercase tracking-widest block mb-1">
              Simple Process
            </span>
            <h2 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-3xl text-[#000000]">
              How ThreadSwap Works
            </h2>
            <p className="text-[#73787C] text-xs mt-1" style={{ fontFamily: "'Inter'" }}>
              Three effortless steps to a sustainable, circular wardrobe
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", icon: <Camera size={26} />, title: "Photograph & List", desc: "Snap quick photos from your mobile device or upload directly. Add condition, tags, and your neighborhood." },
              { step: "02", icon: <MessageCircle size={26} />, title: "Chat & Agree", desc: "Buyers and swappers message you in real-time. Agree on an exchange, cash amount, or direct wardrobe trade." },
              { step: "03", icon: <Leaf size={26} />, title: "Exchange & Impact", desc: "Meet up safely for the local handoff. Zero packaging waste, zero shipping friction, 100% circular impact." },
            ].map(s => (
              <div key={s.step} className="bg-white rounded-3xl border border-[#C5C6C7]/70 p-7 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                <span style={{ fontFamily: "'Arvo', serif", fontWeight: 700, fontSize: "44px", color: "rgba(85, 73, 64, 0.08)", lineHeight: 1 }} className="absolute top-4 right-5">{s.step}</span>
                <div className="w-12 h-12 bg-[#879A77]/20 text-[#879A77] rounded-2xl flex items-center justify-center mb-5">{s.icon}</div>
                <h3 style={{ fontFamily: "'Arvo', serif", fontWeight: 700 }} className="text-[#000000] text-lg mb-2">{s.title}</h3>
                <p className="text-[#73787C] text-xs leading-relaxed" style={{ fontFamily: "'Inter'" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. FOOTER ─── */}
      <footer className="border-t border-[#C5C6C7]/60 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="ThreadSwap" className="w-full h-full object-contain dark:invert" />
            </div>
            <span style={{ fontFamily: "'Amsterdam One', 'Amsterdam', cursive", fontWeight: 400, fontSize: "22px", lineHeight: 1 }} className="text-[#000000] dark:text-white select-none">
              ThreadSwap
            </span>
            <span className="text-[#73787C] text-xs" style={{ fontFamily: "'Inter'" }}>· Circular fashion marketplace</span>
          </div>
          <p className="text-xs text-[#73787C]" style={{ fontFamily: "'Inter'" }}>© 2026 ThreadSwap. Thrift. Exchange. Sustain.</p>
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

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);
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
                {filtered.length === 0 ? (
                  <div className="p-12 text-center bg-[#FAF9F7] dark:bg-card/90 rounded-[28px] border border-[#C5C6C7]">
                    <p className="text-[#554940] dark:text-stone-300 font-bold text-base mb-1" style={{ fontFamily: "'Arvo', serif" }}>No items found</p>
                    <p className="text-[#73787C] text-xs">Try adjusting your filters or search keywords.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-stretch [grid-auto-flow:dense]">
                    {filtered.map((p, idx) => {
                      const aiData = aiScores[String(p.id)] || aiScores[p.name.toLowerCase().trim()];
                      return (
                        <DynamicMosaicProductCard 
                          key={p.id} 
                          p={p} 
                          index={idx}
                          wishlisted={wishlist.includes(p.id)} 
                          onWishlist={() => setWishlist(w => w.includes(p.id) ? w.filter(i => i !== p.id) : [...w, p.id])} 
                          onClickProduct={onClickProduct}
                          aiScore={aiMode ? (aiData ? aiData.score : (matchesDomainFrontend(p, search) ? 0.95 : undefined)) : undefined}
                        />
                      );
                    })}
                  </div>
                )}
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
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 p-1.5 overflow-hidden">
            <img src="/logo.png" alt="ThreadSwap" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          <span style={{ fontFamily: "'Amsterdam One', 'Amsterdam', cursive", fontWeight: 400, fontSize: "32px" }}>ThreadSwap</span>
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
    const itemPhotos = photos && photos.length > 0 ? photos : [];
    if (itemPhotos.length === 0) {
      alert("Please add at least one photo for your listing.");
      return;
    }

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
      rating: 0,
      reviews: 0,
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
        <div className="p-3.5 rounded-2xl bg-[#D7E5F0]/60 border border-[#C5C6C7] flex items-center justify-between text-xs font-semibold text-foreground">
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
        <div className="bg-gradient-to-r from-[#554940] via-[#65584e] to-[#879A77] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden border border-[#C5C6C7]/50">
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
                              isSold ? "bg-muted text-muted-foreground" : "bg-[#879A77] hover:bg-[#554940] text-white"
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
                            <span className="text-[11px] font-bold text-[#879A77] flex items-center gap-1">
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
                            <span className="text-[10px] font-bold px-2.5 py-0.5 bg-[#D7E5F0] text-[#554940] rounded-full border border-[#C5C6C7]/50">PURCHASE</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Bought from {pur.seller} · {pur.date}</p>
                          <span className="text-[10px] font-bold text-[#879A77]">{pur.status}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">{fmt(pur.price)}</span>
                    </div>
                  ))}

                  {/* Swaps */}
                  {(historyFilter === "all" || historyFilter === "swaps") && swaps.map((swp: any) => (
                    <div key={swp.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-4 shadow-xs hover:border-primary/40 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-[#879A77]/15 text-[#879A77] flex items-center justify-center flex-shrink-0">
                          <Repeat size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">{swp.offeredItem} ⇄ {swp.receivedItem}</h4>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 bg-[#C9AD93]/30 text-[#554940] rounded-full border border-[#C9AD93]/50">SWAP</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Traded with {swp.partner} on {swp.date}</p>
                          <span className="text-[10px] font-bold text-[#879A77]">{swp.status}</span>
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
  const [showSplash, setShowSplash] = useState(true);
  const [pageHistory, setPageHistory] = useState<Page[]>([]);
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

  // Active marketplace city — defaults dynamically (defaults to Vikasnagar, primary active hub)
  const [activeCity, setActiveCity] = useState<string>(() => {
    return localStorage.getItem('userActiveCity') || 'Vikasnagar';
  });

  const handleSelectCity = (city: string) => {
    setActiveCity(city);
    localStorage.setItem('userActiveCity', city);
  };

  // Auto-detect user's real city via GPS on initial load if not explicitly saved
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator && !localStorage.getItem('userActiveCity')) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (Math.abs(lat - 30.4035) < 0.4 && Math.abs(lng - 77.9340) < 0.4) {
            setActiveCity('Vikasnagar');
            localStorage.setItem('userActiveCity', 'Vikasnagar');
            return;
          }
          if (Math.abs(lat - 30.3165) < 0.5 && Math.abs(lng - 78.0322) < 0.5) {
            setActiveCity('Dehradun');
            localStorage.setItem('userActiveCity', 'Dehradun');
            return;
          }
          if (Math.abs(lat - 19.0760) < 0.6 && Math.abs(lng - 72.8777) < 0.6) {
            setActiveCity('Mumbai');
            localStorage.setItem('userActiveCity', 'Mumbai');
            return;
          }
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              const detectedCity = data.address?.city || data.address?.town || data.address?.suburb || data.address?.village || data.address?.state_district;
              if (detectedCity) {
                setActiveCity(detectedCity);
                localStorage.setItem('userActiveCity', detectedCity);
              }
            }
          } catch (e) {}
        },
        () => {}
      );
    }
  }, []);

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

  const goNav = (p: Page, mode?: string, addToHistory = true) => {
    if (p === "camera" || p === "listing_form" || p === "inbox" || p === "chat") {
      if (!authUser) {
        alert("Please sign in to view messages or list an item on ThreadSwap!");
        setPage("login");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (addToHistory && p !== page) {
      setPageHistory(prev => [...prev, page]);
    }
    if (p === "inbox" || p === "discover" || p === "home" || p === "profile" || p === "map") {
      setChatTargetSeller(null);
      setChatTargetProduct(null);
    }
    if (p === "map" || mode === "map") {
      setDiscoverInitialView("map");
      setPage("map");
    } else {
      if (p === "discover") setDiscoverInitialView("grid");
      setPage(p);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGoBack = () => {
    if (selectedProduct) {
      setSelectedProduct(null);
      return;
    }
    if (selectedSellerName) {
      setSelectedSellerName(null);
      return;
    }
    if (pageHistory.length > 0) {
      const prev = pageHistory[pageHistory.length - 1];
      setPageHistory(prevList => prevList.slice(0, -1));
      goNav(prev, undefined, false);
    } else if (page !== "home") {
      goNav("home", undefined, false);
    }
  };

  const canGoBack = page !== "home" || pageHistory.length > 0 || Boolean(selectedProduct) || Boolean(selectedSellerName);

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
      case "discover": return <DiscoverPage key={`discover-${discoverInitialView}`} productsList={productsList} initialView={discoverInitialView} onClickProduct={(p) => setSelectedProduct(p)} activeCity={activeCity} onSelectCity={handleSelectCity} />;
      case "map": return <DiscoverPage key="map-page-view" productsList={productsList} initialView="map" onClickProduct={(p) => setSelectedProduct(p)} activeCity={activeCity} onSelectCity={handleSelectCity} />;
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
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background pb-28`} style={{ fontFamily: "'Inter', sans-serif" }}>
      <AnimatePresence>
        {showSplash && <IntroSplash onFinish={() => setShowSplash(false)} />}
      </AnimatePresence>

      <TopNav 
        page={page} 
        onNav={goNav} 
        canGoBack={canGoBack}
        onGoBack={handleGoBack}
        isSplashActive={showSplash}
      />
      
      <AnimatePresence mode="wait">
        <motion.div key={page} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {renderPage()}
        </motion.div>
      </AnimatePresence>

      <BottomControlsBar 
        page={page} 
        onNav={goNav} 
        darkMode={darkMode} 
        onToggleDark={() => setDarkMode(d => !d)} 
        unread={totalUnreadCount}
        authUser={authUser}
        onLogout={handleLogout}
        canGoBack={canGoBack}
        onGoBack={handleGoBack}
      />

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
