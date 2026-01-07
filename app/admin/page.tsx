"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Upload, Trash2, Video, Music, Image, File, LogOut, Shield, 
  Package, Download, Eye, Plus, Copy, CheckCircle,
  RefreshCw, BarChart, Ticket, FileText, FileSpreadsheet, 
  Printer, CheckSquare, CloudUpload, X, Calendar, Clock,
  Search, Filter, ChevronLeft, ChevronRight, Grid, List
} from "lucide-react";

// Sanitization functions from lib/sanitizeName.ts
function sanitizeMediaName(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")        // remove extension
    .replace(/[_\-]+/g, " ")          // underscores & dashes → spaces
    .replace(/[^\w\s]/g, "")          // remove special chars
    .replace(/\s+/g, " ")             // collapse spaces
    .trim()
    .toLowerCase();
}

function toTitleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

type Media = {
  original_filename: string;
  id: string;
  fileName: string;
  type: "video" | "audio" | "image";
  file_size?: number;
  uploaded_at?: string;
  b2_file_id?: string;
};

type Coupon = {
  code: string;
  type: "image" | "video" | "audio" | "all";
  createdAt: string;
};

export default function AdminDashboard() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Coupon Generation State
  const [couponType, setCouponType] = useState<"image" | "video" | "audio" | "all">("all");
  const [couponCount, setCouponCount] = useState(1);
  const [generatedCoupons, setGeneratedCoupons] = useState<Coupon[]>([]);
  const [generatingCoupons, setGeneratingCoupons] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Selection State
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Preview State
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "audio" | "image">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size">("newest");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  
  // Existing Coupons State
  const [allCoupons, setAllCoupons] = useState<any[]>([]);
  const [loadingAllCoupons, setLoadingAllCoupons] = useState(false);

  const router = useRouter();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/admin/me");
        if (!res.ok) {
          setAuthorized(false);
          document.cookie = "admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          setTimeout(() => router.push("/admin/login"), 2000);
          return;
        }
        setAuthorized(true);
      } catch (err) {
        setAuthorized(false);
        document.cookie = "admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        setTimeout(() => router.push("/admin/login"), 2000);
      }
    };
    checkAuth();
  }, [router]);

  // Fetch media
  const fetchMedia = async () => {
    try {
      const res = await fetch("/api/get-media");
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setMediaList(data);
      } else {
        console.error("API did not return an array:", data);
        setMediaList([]);
      }
      
      setSelectedMedia(new Set());
      setCurrentPage(1); // Reset to first page on refresh
    } catch (err) {
      console.error("Failed to fetch media", err);
      setMediaList([]);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    fetchMedia();
  }, [authorized]);

  // Filtered and sorted media
  const filteredMedia = useCallback(() => {
    return mediaList.filter(media => {
      // Filter by type
      if (filterType !== "all" && media.type !== filterType) return false;
      
      // Filter by search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const filename = (media.original_filename || media.fileName).toLowerCase();
        const sanitized = sanitizeMediaName(filename);
        return filename.includes(searchLower) || sanitized.includes(searchLower);
      }
      
      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
        case "oldest":
          return new Date(a.uploaded_at || 0).getTime() - new Date(b.uploaded_at || 0).getTime();
        case "size":
          return (b.file_size || 0) - (a.file_size || 0);
        default:
          return 0;
      }
    });
  }, [mediaList, filterType, searchQuery, sortBy]);

  // Pagination calculations
  const totalItems = filteredMedia().length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMedia = filteredMedia().slice(startIndex, endIndex);

  // Separate media by type for statistics
  const videos = mediaList.filter((m) => m.type === "video");
  const audios = mediaList.filter((m) => m.type === "audio");
  const images = mediaList.filter((m) => m.type === "image");

  // Selection handlers
  const toggleMediaSelection = (id: string) => {
    const newSelection = new Set(selectedMedia);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMedia(newSelection);
    setSelectAll(newSelection.size === mediaList.length && mediaList.length > 0);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(mediaList.map(m => m.id)));
    }
    setSelectAll(!selectAll);
  };

  // Get preview URL
  const getPreviewUrl = (id: string) => {
    return `/api/admin/media/stream?id=${id}`;
  };

  // Handle file selection
  const handleFileSelect = (selectedFiles: FileList) => {
    const newFiles = Array.from(selectedFiles);
    const supportedFiles = newFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const supported = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
        'mp4', 'mkv', 'mov', 'webm', 'avi', 'mpg', 'mpeg', 'wmv', 'flv',
        'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'
      ];
      return supported.includes(ext || '');
    });
    
    if (supportedFiles.length !== newFiles.length) {
      alert(`Some files were skipped. Only supported image, video, and audio files are allowed.`);
    }
    
    setFiles(prev => [...prev, ...supportedFiles]);
  };

  // Remove a file from the upload list
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all files from upload list
  const clearAllFiles = () => {
    if (files.length > 0 && window.confirm(`Remove all ${files.length} files from upload list?`)) {
      setFiles([]);
    }
  };

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, []);

  // Upload all selected files with progress
  const uploadAll = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setUploadProgress(0);
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", { 
          method: "POST", 
          body: formData 
        });
        const data = await res.json();
        results.push(data);

        if (data.success) {
          fetchMedia();
        }
      } catch (err) {
        console.error("Upload failed for", file.name, err);
        results.push({ error: `Failed to upload ${file.name}` });
      }
      
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setResult({ uploads: results, total: files.length });
    setFiles([]);
    setLoading(false);
    setUploadProgress(0);
  };

  // Delete single media item
  const deleteMediaItem = async (id: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This will permanently remove the file from storage and cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/delete-media?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }

      setMediaList(prev => prev.filter(m => m.id !== id));
      
      if (selectedMedia.has(id)) {
        const newSelection = new Set(selectedMedia);
        newSelection.delete(id);
        setSelectedMedia(newSelection);
      }

      alert(`Successfully deleted: ${fileName}`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Delete selected media (batch deletion)
  const deleteSelectedMedia = async () => {
    if (selectedMedia.size === 0) {
      alert("No media selected");
      return;
    }

    if (!confirm(`Delete ${selectedMedia.size} selected item(s)? This will permanently remove files from storage and cannot be undone.`)) {
      return;
    }

    try {
      const idsArray = Array.from(selectedMedia);
      const idsParam = idsArray.join(",");
      
      const res = await fetch(`/api/admin/delete-media?ids=${idsParam}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }

      setMediaList(prev => prev.filter(m => !selectedMedia.has(m.id)));
      setSelectedMedia(new Set());
      setSelectAll(false);

      if (data.details?.failed?.length > 0) {
        const failedFiles = data.details.failed.map((f: any) => f.fileName).join(", ");
        alert(`Deleted ${data.details.successful.length} file(s). Failed to delete: ${failedFiles}`);
      } else {
        alert(`Successfully deleted ${data.details.successful.length} file(s)`);
      }
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Failed to delete selected media: ${err.message}`);
    }
  };

  // Generate coupons
  const generateCoupons = async () => {
    if (couponCount < 1 || couponCount > 100) {
      alert("Please enter a number between 1 and 100");
      return;
    }

    setGeneratingCoupons(true);
    try {
      const res = await fetch("/api/admin/generate-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: couponType, 
          count: couponCount 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newCoupons: Coupon[] = data.coupons.map((c: any) => ({
        code: c.code,
        type: c.type,
        createdAt: new Date().toISOString()
      }));
      
      setGeneratedCoupons(newCoupons);
    } catch (err: any) {
      alert(`Failed to generate coupons: ${err.message}`);
    } finally {
      setGeneratingCoupons(false);
    }
  };

  // Export coupons
  const exportCoupons = (format: 'csv' | 'json' | 'txt') => {
    if (generatedCoupons.length === 0) {
      alert("No coupons to export");
      return;
    }

    let content = '';
    let filename = `coupons_${new Date().toISOString().split('T')[0]}`;

    switch (format) {
      case 'csv':
        content = 'Code,Type,Created At\n';
        content += generatedCoupons.map(c => `"${c.code}","${c.type}","${c.createdAt}"`).join('\n');
        filename += '.csv';
        break;
      case 'json':
        content = JSON.stringify(generatedCoupons, null, 2);
        filename += '.json';
        break;
      case 'txt':
        content = generatedCoupons.map(c => 
          `Coupon: ${c.code}\nType: ${c.type}\nCreated: ${c.createdAt}\n${'='.repeat(30)}`
        ).join('\n\n');
        filename += '.txt';
        break;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate printable coupon sheet
  const generatePrintableSheet = () => {
    if (generatedCoupons.length === 0) {
      alert("No coupons to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Coupon Codes - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .coupon-sheet { max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .coupon-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-top: 20px;
          }
          .coupon-card {
            border: 2px dashed #ccc;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            background: #f9f9f9;
            page-break-inside: avoid;
          }
          .coupon-code {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
            margin: 15px 0;
            color: #333;
          }
          .coupon-type {
            color: #666;
            font-size: 14px;
          }
          .watermark {
            position: absolute;
            opacity: 0.1;
            font-size: 100px;
            transform: rotate(-45deg);
            pointer-events: none;
          }
          @media print {
            body { margin: 0; }
            .coupon-card { border: 2px dashed #000; }
          }
        </style>
      </head>
      <body>
        <div class="coupon-sheet">
          <div class="header">
            <h1>Media Access Coupons</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Type: ${couponType.toUpperCase()} • Count: ${generatedCoupons.length}</p>
          </div>
          <div class="coupon-grid">
            ${generatedCoupons.map(coupon => `
              <div class="coupon-card">
                <div class="coupon-type">${coupon.type.toUpperCase()} ACCESS</div>
                <div class="coupon-code">${coupon.code}</div>
                <div style="font-size: 12px; color: #888;">
                  Valid for 24 hours after redemption
                </div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top: 40px; font-size: 12px; color: #999; text-align: center;">
            <p>© ${new Date().getFullYear()} Media Archive • Generated by Admin</p>
          </div>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 1000);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Copy coupon code
  const copyCouponCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Download file
  const downloadFile = async (id: string, fileName: string) => {
    try {
      const res = await fetch(`/api/admin/media/download?id=${id}`);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Download failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download file");
    }
  };

  // Calculate storage statistics
  const totalStorage = Array.isArray(mediaList) 
    ? mediaList.reduce((sum, media) => {
        const size = media?.file_size ? Number(media.file_size) : 0;
        return sum + (isNaN(size) ? 0 : size);
      }, 0)
    : 0;

  const storageInMB = (totalStorage / 1024 / 1024).toFixed(1);

  // Fetch all coupons
  const fetchAllCoupons = async () => {
    setLoadingAllCoupons(true);
    try {
      const res = await fetch('/api/admin/coupons');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      setAllCoupons(data.coupons || []);
      alert(`Loaded ${data.coupons.length} coupons from database`);
    } catch (err: any) {
      console.error("Failed to fetch coupons:", err);
      alert(`Failed to load coupons: ${err.message}`);
    } finally {
      setLoadingAllCoupons(false);
    }
  };

  const exportExistingCouponsFormat = async (format: 'csv' | 'json' | 'txt') => {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `coupons_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const res = await fetch("/api/admin/logout", { 
        method: "POST",
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (res.ok) {
        setAuthorized(false);
        localStorage.removeItem('admin_auth');
        sessionStorage.clear();
        setTimeout(() => {
          router.push("/admin/login");
          router.refresh();
        }, 100);
      } else {
        router.push("/admin/login");
      }
    } catch (err) {
      router.push("/admin/login");
    }
  };

  // Preview media item
  const openPreview = (mediaItem: Media) => {
    setPreviewMedia(mediaItem);
  };

  // Helper to format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Byte";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
  };

  // Pagination controls
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Loading state
  if (authorized === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (authorized === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md p-8 border border-red-500/30 rounded-2xl bg-red-500/10">
          <Shield className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-300 mb-4">You don't have permission to access this area.</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header - Mobile Responsive */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 sm:p-2 rounded-full">
              <img 
                src="/logo.png" 
                alt="LFC Jahi Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                LFC Jahi Admin
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                Secure media and coupon management
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-3 sm:px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm sm:text-base"
          >
            <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Stats Overview - Mobile Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">Total Files</p>
                <p className="text-2xl sm:text-3xl font-bold">{mediaList.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedMedia.size > 0 ? `${selectedMedia.size} selected` : 'No selection'}
                </p>
              </div>
              <Package className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 opacity-30" />
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">Storage Used</p>
                <p className="text-2xl sm:text-3xl font-bold">{storageInMB} MB</p>
                <p className="text-xs text-gray-500 mt-1">
                  {images.length} images, {videos.length} videos, {audios.length} audios
                </p>
              </div>
              <BarChart className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 opacity-30" />
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">Files Ready</p>
                <p className="text-2xl sm:text-3xl font-bold">{files.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                </p>
              </div>
              <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-green-400 opacity-30" />
            </div>
          </div>
        </div>

        {/* Search and Filter Bar - Mobile Responsive */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search files by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-black/30 border border-white/20 rounded-lg outline-none text-sm sm:text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap gap-2">
              {/* File Type Filter */}
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full sm:w-32 px-3 py-2.5 bg-black/30 border border-white/20 rounded-lg outline-none text-sm appearance-none"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                </select>
                <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              </div>

              {/* Sort By */}
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full sm:w-32 px-3 py-2.5 bg-black/30 border border-white/20 rounded-lg outline-none text-sm appearance-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="size">Largest First</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-black/30 border border-white/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2.5 ${viewMode === "list" ? "bg-white/20" : "hover:bg-white/10"} transition-colors`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2.5 ${viewMode === "grid" ? "bg-white/20" : "hover:bg-white/10"} transition-colors`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Results Info */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
            <div className="flex items-center gap-3">
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} files
              </span>
              {searchQuery && (
                <span className="px-2 py-1 bg-blue-500/20 rounded text-xs">
                  Search: "{searchQuery}"
                </span>
              )}
              {filterType !== "all" && (
                <span className="px-2 py-1 bg-purple-500/20 rounded text-xs">
                  Filter: {filterType}
                </span>
              )}
            </div>
            
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-black/30 border border-white/20 rounded text-xs"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selection Actions Bar */}
        {selectedMedia.size > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <span className="font-medium text-sm sm:text-base">
                  {selectedMedia.size} item{selectedMedia.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={deleteSelectedMedia}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Delete Selected</span>
                  <span className="sm:hidden">Delete</span>
                </button>
                <button
                  onClick={() => setSelectedMedia(new Set())}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Left Column: Upload & Coupons */}
          <div className="space-y-6 sm:space-y-8">
            {/* Upload Section */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
                  <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">Upload Media</h2>
                {files.length > 0 && (
                  <button
                    onClick={clearAllFiles}
                    className="ml-auto px-2 py-1 sm:px-3 sm:py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear ({files.length})
                  </button>
                )}
              </div>

              <div className="space-y-4 sm:space-y-6">
                {/* Drag & Drop Area */}
                <div 
                  className={`border-2 border-dashed rounded-xl p-4 sm:p-8 text-center transition-all duration-300 ${
                    dragActive 
                      ? "border-blue-500 bg-blue-500/10 scale-[1.02]" 
                      : "border-white/20 hover:border-blue-500/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                    className="hidden"
                    id="file-upload"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.mp4,.mkv,.mov,.webm,.avi,.mpg,.mpeg,.wmv,.flv,.mp3,.wav,.ogg,.flac,.m4a,.aac,.wma"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className="flex flex-col items-center justify-center">
                      {dragActive ? (
                        <CloudUpload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-blue-400 mb-3 sm:mb-4 animate-pulse" />
                      ) : (
                        <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-500 mb-3 sm:mb-4" />
                      )}
                      <p className="text-base sm:text-xl font-medium mb-1 sm:mb-2">
                        {dragActive ? "Drop files here" : files.length > 0 
                          ? `${files.length} file${files.length > 1 ? 's' : ''} selected` 
                          : "Click or drag files to upload"}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                        Supports images, videos, and audio files
                      </p>
                      <button
                        type="button"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="px-4 py-1.5 sm:px-6 sm:py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors text-sm sm:text-base"
                      >
                        Browse Files
                      </button>
                    </div>
                  </label>
                  
                  {files.length > 0 && (
                    <div className="mt-4 sm:mt-8 space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center text-xs sm:text-sm text-gray-400">
                        <span>Files to upload:</span>
                        <span>
                          Total: {(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 max-h-40 sm:max-h-64 overflow-y-auto pr-2">
                        {files.map((file, index) => (
                          <div 
                            key={`${file.name}-${index}`} 
                            className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded-lg group hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <div className={`p-1 sm:p-2 rounded-lg ${
                                file.type.startsWith('image/') ? 'bg-green-500/20' :
                                file.type.startsWith('video/') ? 'bg-red-500/20' :
                                file.type.startsWith('audio/') ? 'bg-blue-500/20' :
                                'bg-gray-500/20'
                              }`}>
                                {file.type.startsWith('image/') ? (
                                  <Image className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                                ) : file.type.startsWith('video/') ? (
                                  <Video className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                                ) : file.type.startsWith('audio/') ? (
                                  <Music className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                                ) : (
                                  <File className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm truncate" title={file.name}>
                                  {file.name.length > 30 ? `${file.name.substring(0, 30)}...` : file.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="p-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                              title="Remove file"
                            >
                              <X className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {loading && uploadProgress > 0 && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span>Uploading {files.length} file{files.length > 1 ? 's' : ''}...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <button
                  onClick={uploadAll}
                  disabled={loading || files.length === 0}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 sm:gap-3 transition-all text-sm sm:text-base"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                      Uploading ({uploadProgress}%)
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4 sm:w-5 sm:h-5" />
                      Upload {files.length} file{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Coupon Generation */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg">
                  <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">Generate Coupons</h2>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                      Coupon Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {(["image", "video", "audio", "all"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setCouponType(type)}
                          className={`py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            couponType === type
                              ? "bg-blue-600 text-white"
                              : "bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                      Number of Coupons
                    </label>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={couponCount}
                        onChange={(e) => setCouponCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                        className="flex-1 p-2 sm:p-3 bg-black/30 border border-white/20 rounded-lg outline-none text-sm"
                      />
                      <button
                        onClick={generateCoupons}
                        disabled={generatingCoupons}
                        className="px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center gap-1.5 sm:gap-2 transition-all text-sm sm:text-base"
                      >
                        {generatingCoupons ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                            <span className="hidden sm:inline">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {generatedCoupons.length > 0 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm sm:text-base">Generated Coupons:</h3>
                      <span className="text-xs sm:text-sm text-gray-400">
                        {generatedCoupons.length} coupon{generatedCoupons.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Export Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      <button
                        onClick={() => exportCoupons('csv')}
                        className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
                        title="Export as CSV"
                      >
                        <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs">CSV</span>
                      </button>
                      <button
                        onClick={() => exportCoupons('json')}
                        className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
                        title="Export as JSON"
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs">JSON</span>
                      </button>
                      <button
                        onClick={() => exportCoupons('txt')}
                        className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
                        title="Export as Text"
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs">TXT</span>
                      </button>
                    </div>

                    <button
                      onClick={generatePrintableSheet}
                      className="w-full p-2 sm:p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors text-sm"
                    >
                      <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                      Generate Printable Sheet
                    </button>

                    <div className="space-y-1.5 sm:space-y-2 max-h-40 sm:max-h-60 overflow-y-auto">
                      {generatedCoupons.map((coupon, index) => (
                        <div
                          key={coupon.code}
                          className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded-lg group"
                        >
                          <div className="min-w-0">
                            <code className="font-mono text-xs sm:text-sm truncate block">{coupon.code}</code>
                            <span className="text-xs text-gray-400">{coupon.type}</span>
                          </div>
                          <button
                            onClick={() => copyCouponCode(coupon.code, index)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                            title="Copy code"
                          >
                            {copiedIndex === index ? (
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Media Management */}
          <div className="space-y-6 sm:space-y-8">
            {/* Media Library Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-bold">Media Library</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectAll ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={fetchMedia}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Media Display */}
            {paginatedMedia.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                <p className="text-gray-400">
                  {searchQuery || filterType !== "all" 
                    ? "No files match your search criteria" 
                    : "No media files found"}
                </p>
                {(searchQuery || filterType !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterType("all");
                    }}
                    className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : viewMode === "list" ? (
              // List View
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {paginatedMedia.map((m) => {
                    const sanitizedName = sanitizeMediaName(m.original_filename || m.fileName);
                    
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${
                          selectedMedia.has(m.id) 
                            ? 'bg-blue-500/20 border border-blue-500/30' 
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedMedia.has(m.id)}
                            onChange={() => toggleMediaSelection(m.id)}
                            className="w-4 h-4 rounded border-white/30 bg-white/5 flex-shrink-0"
                          />
                          {m.type === "image" ? (
                            <Image className="w-4 h-4 text-green-400 flex-shrink-0" />
                          ) : m.type === "video" ? (
                            <Video className="w-4 h-4 text-red-400 flex-shrink-0" />
                          ) : (
                            <Music className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate" title={m.original_filename || m.fileName}>
                              {toTitleCase(sanitizedName)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                              {m.file_size && (
                                <span>{(m.file_size / 1024 / 1024).toFixed(2)} MB</span>
                              )}
                              {m.uploaded_at && (
                                <span>{new Date(m.uploaded_at).toLocaleDateString()}</span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                m.type === 'image' ? 'bg-green-500/20 text-green-400' :
                                m.type === 'video' ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {m.type}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 sm:gap-2">
                          {/* Preview Button */}
                          <button
                            onClick={() => openPreview(m)}
                            className="p-1.5 sm:p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                          </button>
                          
                          {/* Download Button */}
                          <button
                            onClick={() => downloadFile(m.id, m.fileName)}
                            className="p-1.5 sm:p-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => deleteMediaItem(m.id, m.fileName)}
                            className="p-1.5 sm:p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {paginatedMedia.map((m) => {
                  const sanitizedName = sanitizeMediaName(m.original_filename || m.fileName);
                  
                  return (
                    <div
                      key={m.id}
                      className={`bg-white/5 border rounded-xl p-4 transition-colors group ${
                        selectedMedia.has(m.id) 
                          ? 'border-blue-500/50 bg-blue-500/10' 
                          : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedMedia.has(m.id)}
                            onChange={() => toggleMediaSelection(m.id)}
                            className="w-4 h-4 rounded border-white/30 bg-white/5 flex-shrink-0 mt-0.5"
                          />
                          {m.type === "image" ? (
                            <Image className="w-5 h-5 text-green-400 flex-shrink-0" />
                          ) : m.type === "video" ? (
                            <Video className="w-5 h-5 text-red-400 flex-shrink-0" />
                          ) : (
                            <Music className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate" title={m.original_filename || m.fileName}>
                              {toTitleCase(sanitizedName)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {m.file_size ? `${(m.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            m.type === 'image' ? 'bg-green-500/20 text-green-400' :
                            m.type === 'video' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {m.type}
                          </span>
                          {m.uploaded_at && (
                            <span className="text-xs text-gray-400">
                              {new Date(m.uploaded_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openPreview(m)}
                            className="p-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                          </button>
                          <button
                            onClick={() => deleteMediaItem(m.id, m.fileName)}
                            className="p-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-400">
                    Page {currentPage} of {totalPages} • {totalItems} total files
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="First page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <ChevronLeft className="w-4 h-4 -ml-2" />
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`w-8 h-8 rounded-lg transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 hover:bg-white/20'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="text-gray-400 px-1">...</span>
                          <button
                            onClick={() => goToPage(totalPages)}
                            className={`w-8 h-8 rounded-lg transition-colors ${
                              currentPage === totalPages
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 hover:bg-white/20'
                            }`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Last page"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <ChevronRight className="w-4 h-4 -ml-2" />
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    {itemsPerPage} per page
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Existing Coupon Management */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 mt-8 sm:mt-12">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Manage Existing Coupons</h2>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={fetchAllCoupons}
                disabled={loadingAllCoupons}
                className="py-2.5 sm:py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-50 text-sm"
              >
                {loadingAllCoupons ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 sm:w-4 sm:h-4" />
                    Load All Coupons
                  </>
                )}
              </button>
              
              <button
                onClick={() => exportExistingCouponsFormat('json')}
                disabled={allCoupons.length === 0}
                className="py-2.5 sm:py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-50 text-sm"
              >
                <Download className="w-4 h-4 sm:w-4 sm:h-4" />
                Export All ({allCoupons.length})
              </button>
            </div>

            {allCoupons.length > 0 && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 text-center">
                    <div className="text-xl sm:text-2xl font-bold">{allCoupons.length}</div>
                    <div className="text-xs text-gray-400">Total</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 text-center">
                    <div className="text-xl sm:text-2xl font-bold">
                      {allCoupons.filter(c => c.redeemed).length}
                    </div>
                    <div className="text-xs text-gray-400">Redeemed</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 text-center">
                    <div className="text-xl sm:text-2xl font-bold">
                      {allCoupons.filter(c => !c.redeemed).length}
                    </div>
                    <div className="text-xs text-gray-400">Available</div>
                  </div>
                </div>

                {/* Coupon List */}
                <div className="space-y-1.5 sm:space-y-2 max-h-60 sm:max-h-80 overflow-y-auto">
                  {allCoupons.slice(0, 20).map((coupon, index) => (
                    <div
                      key={coupon.id}
                      className={`p-2.5 sm:p-3 rounded-lg ${
                        coupon.redeemed 
                          ? 'bg-green-500/10 border border-green-500/20' 
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <code className="font-mono text-xs sm:text-sm truncate block">{coupon.code}</code>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-400 mt-1">
                            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full ${
                              coupon.type === 'all' ? 'bg-blue-500/20 text-blue-400' :
                              coupon.type === 'image' ? 'bg-green-500/20 text-green-400' :
                              coupon.type === 'video' ? 'bg-red-500/20 text-red-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>
                              {coupon.type}
                            </span>
                            <span className={coupon.redeemed ? 'text-green-400' : 'text-yellow-400'}>
                              {coupon.redeemed ? '✓ Redeemed' : 'Available'}
                            </span>
                            <span>
                              {new Date(coupon.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => copyCouponCode(coupon.code, index)}
                          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors ml-2 flex-shrink-0"
                          title="Copy code"
                        >
                          <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                      {coupon.expires_at && (
                        <div className="text-xs text-gray-500 mt-2">
                          Expires: {new Date(coupon.expires_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                  {allCoupons.length > 20 && (
                    <div className="text-center p-3 text-gray-400 text-sm">
                      ... and {allCoupons.length - 20} more coupons
                    </div>
                  )}
                </div>

                {/* Export Options */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => exportExistingCouponsFormat('csv')}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    title="Export as CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs">CSV</span>
                  </button>
                  <button
                    onClick={() => exportExistingCouponsFormat('json')}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    title="Export as JSON"
                  >
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs">JSON</span>
                  </button>
                  <button
                    onClick={() => exportExistingCouponsFormat('txt')}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    title="Export as Text"
                  >
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs">TXT</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-2 sm:gap-3">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-yellow-400 mb-1 text-sm sm:text-base">Security Note</h4>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                • Always log out after admin sessions<br/>
                • Generated coupons should be distributed securely<br/>
                • Review file uploads for content compliance<br/>
                • Monitor storage usage regularly
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-gray-900 rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold text-sm sm:text-lg truncate pr-4">
                {toTitleCase(sanitizeMediaName(previewMedia.fileName))}
              </h3>
              <button
                onClick={() => setPreviewMedia(null)}
                className="text-gray-400 hover:text-white text-xl sm:text-2xl flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="p-3 sm:p-6 max-h-[70vh] overflow-auto">
              {previewMedia.type === "image" ? (
                <img
                  src={getPreviewUrl(previewMedia.id)}
                  alt={previewMedia.fileName}
                  className="max-w-full h-auto rounded-lg mx-auto"
                  onError={(e) => {
                    console.error("Modal image failed to load");
                    e.currentTarget.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23333"/><text x="200" y="150" text-anchor="middle" fill="white" font-family="sans-serif" font-size="16">Preview not available</text></svg>`;
                  }}
                />
              ) : previewMedia.type === "video" ? (
                <video
                  controls
                  className="w-full rounded-lg"
                  src={getPreviewUrl(previewMedia.id)}
                >
                  Your browser does not support the video tag.
                </video>
              ) : previewMedia.type === "audio" ? (
                <div className="space-y-4">
                  <audio
                    controls
                    className="w-full"
                    src={getPreviewUrl(previewMedia.id)}
                  />
                  <div className="text-center text-gray-400">
                    <Music className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2" />
                    <p>{toTitleCase(sanitizeMediaName(previewMedia.fileName))}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <File className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-500 mb-3 sm:mb-4" />
                  <p className="text-gray-400 text-sm sm:text-base">Preview not available for this file type</p>
                </div>
              )}
            </div>
            <div className="p-3 sm:p-4 border-t border-white/10 flex justify-between">
              <button
                onClick={() => downloadFile(previewMedia.id, previewMedia.fileName)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Download
              </button>
              <button
                onClick={() => setPreviewMedia(null)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 sm:py-6 mt-6 sm:mt-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 text-center text-gray-500 text-xs sm:text-sm">
          <p>© {new Date().getFullYear()} LFC Jahi Media Archive • All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}