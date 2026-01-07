"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Download, FileVideo, FileAudio, Image, File, 
  Home, Eye, Calendar, Clock, Search, 
  Filter, Video, Music, Image as ImageIcon, 
  Grid, FolderOpen, X 
} from "lucide-react";

// Updated sanitization functions - SAME AS ADMIN PAGE
function sanitizeMediaName(filename: string) {
  if (!filename) return '';
  return filename
    .replace(/\.[^/.]+$/, "")        // remove extension
    .replace(/[_\-]+/g, " ")          // underscores & dashes → spaces
    .replace(/[^\w\s]/g, "")          // remove special chars
    .replace(/\s+/g, " ")             // collapse spaces
    .trim()
    .toLowerCase();
}

function toTitleCase(str: string) {
  if (!str) return '';
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Updated Media type to include original_filename
type Media = {
  id: string;
  fileName: string;
  original_filename?: string;  // Added this
  type: "video" | "audio" | "image";
  file_path?: string;
  size?: number;
  created_at?: string;
};

// Helper function to get icon based on file type
const getFileIcon = (type: string) => {
  switch (type) {
    case "video":
      return <FileVideo className="w-5 h-5" />;
    case "audio":
      return <FileAudio className="w-5 h-5" />;
    case "image":
      return <Image className="w-5 h-5" />;
    default:
      return <File className="w-5 h-5" />;
  }
};

// Helper function to get type badge color
const getTypeColor = (type: string) => {
  switch (type) {
    case "video":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "audio":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "image":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
};

// Helper to format file size
const formatFileSize = (bytes?: number) => {
  if (!bytes) return "N/A";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
};

// Helper to get file extension
const getFileExtension = (filename: string) => {
  return filename.split('.').pop()?.toUpperCase() || "FILE";
};

// Function to get preview URL with token as query parameter
const getPreviewUrl = (id: string) => {
  const token = localStorage.getItem("coupon_access");
  if (!token) return "";
  return `/api/media/stream?id=${id}&token=${encodeURIComponent(token)}`;
};

// File type filter options
const FILTER_OPTIONS = [
  { value: "all", label: "All Files", icon: <Grid className="w-4 h-4" />, count: 0 },
  { value: "video", label: "Videos", icon: <Video className="w-4 h-4" />, count: 0 },
  { value: "audio", label: "Audio", icon: <Music className="w-4 h-4" />, count: 0 },
  { value: "image", label: "Images", icon: <ImageIcon className="w-4 h-4" />, count: 0 },
];

export default function MediaPage() {
  const router = useRouter();
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [expiryTime, setExpiryTime] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [search, setSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");

  useEffect(() => {
    const token = localStorage.getItem("coupon_access");
    setAccessToken(token || "");
    
    if (!token) {
      router.push("/redeem");
      return;
    }

    const fetchMedia = async () => {
      try {
        const res = await fetch("/api/media/access", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
          return;
        }
        
        // IMPORTANT: The API returns only fileName, not original_filename
        // So we need to apply sanitization to fileName
        setMedia(data.media ?? []);
        
        if (data.expires_at) {
          const expiryDate = new Date(data.expires_at);
          setExpiryTime(expiryDate.toLocaleString());
        }
        
      } catch (err) {
        console.error(err);
        setError("Failed to fetch media");
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [router]);

  const downloadFile = async (id: string, fileName: string) => {
    if (!accessToken) {
      console.error("No access token found in localStorage");
      alert("Your session has expired. Please redeem a new coupon.");
      router.push("/redeem");
      return;
    }

    try {
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      const isVideo = ['mkv', 'mp4', 'mov', 'avi', 'webm'].includes(fileExt || '');
      
      if (isVideo) {
        const encodedToken = encodeURIComponent(accessToken);
        const videoUrl = `/api/media/download?id=${id}&token=${encodedToken}`;
        window.open(videoUrl, '_blank');
        return;
      }
      
      const downloadUrl = `/api/media/download?id=${id}`;
      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      
      const res = await fetch(downloadUrl, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        credentials: 'same-origin',
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("coupon_access");
          router.push("/redeem");
        }
        throw new Error(`Download failed with status ${res.status}`);
      }
      
      const blob = await res.blob();
      if (blob.size === 0) {
        alert("Received empty file. Please try again.");
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (err: any) {
      console.error("Download error:", err);
      alert(`Download failed: ${err.message || 'Unknown error'}`);
    }
  };

  const previewMedia = (mediaItem: Media) => {
    setSelectedMedia(mediaItem);
  };

  const handleLogout = () => {
    localStorage.removeItem("coupon_access");
    router.push("/redeem");
  };

  const renderInlinePreview = (mediaItem: Media) => {
    if (!accessToken) return null;
    
    const previewUrl = getPreviewUrl(mediaItem.id);
    
    if (mediaItem.type === "image") {
      return (
        <img
          src={previewUrl}
          alt={mediaItem.fileName}
          className="w-16 h-16 object-cover rounded-lg border border-white/10"
          onError={(e) => {
            console.error("Image failed to load:", e);
            e.currentTarget.style.display = 'none';
          }}
          onLoad={() => console.log("Image loaded successfully:", mediaItem.fileName)}
        />
      );
    }
    return null;
  };

  // Get display name - SAME LOGIC AS ADMIN PAGE
  const getDisplayName = (mediaItem: Media): string => {
    // If original_filename exists (like in admin), use it
    if (mediaItem.original_filename) {
      return toTitleCase(sanitizeMediaName(mediaItem.original_filename));
    }
    // Otherwise, sanitize the fileName (like in client)
    return toTitleCase(sanitizeMediaName(mediaItem.fileName));
  };

  // Sort media by sanitized name
  const sortedMedia = useMemo(() => {
    return [...media].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b))
    );
  }, [media]);

  // Normalize search term
  const normalizedSearch = sanitizeMediaName(search.toLowerCase());

  // Filter media based on search AND file type
  const filteredMedia = useMemo(() => {
    return sortedMedia.filter((m) => {
      const sanitized = sanitizeMediaName(getDisplayName(m));
      
      // Apply file type filter
      if (fileTypeFilter !== "all" && m.type !== fileTypeFilter) {
        return false;
      }
      
      // Apply search filter
      if (search) {
        return (
          sanitized.toLowerCase().includes(normalizedSearch) ||
          m.fileName.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return true;
    });
  }, [sortedMedia, fileTypeFilter, search, normalizedSearch]);

  // Calculate counts for filter buttons
  const getFilterCounts = () => {
    const counts = {
      all: media.length,
      video: media.filter(m => m.type === 'video').length,
      audio: media.filter(m => m.type === 'audio').length,
      image: media.filter(m => m.type === 'image').length,
    };
    
    return FILTER_OPTIONS.map(option => ({
      ...option,
      count: counts[option.value as keyof typeof counts] || 0
    }));
  };

  const filterOptions = getFilterCounts();

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-xl">Loading your media...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-red-300">{error}</p>
        </div>
        <button
          onClick={() => router.push("/redeem")}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Try Another Coupon
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-full">
                <img 
                  src="/logo.png" 
                  alt="LFC Jahi Logo" 
                  className="w-10 h-10"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  LFC Jahi Media Library
                </h1>
                <div className="flex items-center gap-4 mt-2 text-gray-400 text-sm">
                  {expiryTime && (
                    <>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Expires: {expiryTime}</span>
                      </div>
                      <div className="text-gray-500">•</div>
                    </>
                  )}
                  <span>{media.length} {media.length === 1 ? 'item' : 'items'} available</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Redeem Another
            </button>
          </div>
          
          {/* Search and Filter Section */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search media by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-black/50 border border-white/20 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {(search || fileTypeFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFileTypeFilter("all");
                    }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white flex items-center gap-1 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>
              
              {/* File Type Filter Dropdown for mobile */}
              <div className="md:hidden w-full">
                <div className="relative">
                  <select
                    value={fileTypeFilter}
                    onChange={(e) => setFileTypeFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-black/50 border border-white/20 rounded-lg appearance-none outline-none focus:border-blue-500"
                  >
                    {filterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                  <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
              </div>
            </div>
            
            {/* File Type Filter Tabs for desktop */}
            <div className="hidden md:flex items-center gap-2 p-1 bg-black/30 rounded-lg border border-white/10">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFileTypeFilter(option.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    fileTypeFilter === option.value
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  } ${option.count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={option.count === 0}
                >
                  {option.icon}
                  <span>{option.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Preview Modal */}
      {selectedMedia && accessToken && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold text-lg truncate">
                {getDisplayName(selectedMedia)}
              </h3>
              <button
                onClick={() => setSelectedMedia(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-auto">
              {selectedMedia.type === "image" ? (
                <img
                  src={getPreviewUrl(selectedMedia.id)}
                  alt={selectedMedia.fileName}
                  className="max-w-full h-auto rounded-lg mx-auto"
                  onError={(e) => {
                    console.error("Modal image failed to load");
                    e.currentTarget.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23333"/><text x="200" y="150" text-anchor="middle" fill="white" font-family="sans-serif" font-size="16">Preview not available</text></svg>`;
                  }}
                />
              ) : selectedMedia.type === "video" ? (
                <video
                  controls
                  className="w-full rounded-lg"
                  src={getPreviewUrl(selectedMedia.id)}
                >
                  Your browser does not support the video tag.
                </video>
              ) : selectedMedia.type === "audio" ? (
                <div className="space-y-4">
                  <audio
                    controls
                    className="w-full"
                    src={getPreviewUrl(selectedMedia.id)}
                  />
                  <div className="text-center text-gray-400">
                    <FileAudio className="w-16 h-16 mx-auto mb-2" />
                    <p>{getDisplayName(selectedMedia)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <File className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400">Preview not available for this file type</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 flex justify-between">
              <button
                onClick={() => downloadFile(selectedMedia.id, selectedMedia.fileName)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => setSelectedMedia(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredMedia.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl">
            <div className="flex flex-col items-center justify-center">
              <FolderOpen className="w-20 h-20 text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                {search || fileTypeFilter !== "all" ? "No matching files found" : "No media files"}
              </h3>
              <p className="text-gray-500 mb-6 max-w-md">
                {search 
                  ? "No files match your search criteria. Try a different search term."
                  : fileTypeFilter !== "all"
                  ? `No ${fileTypeFilter} files available in your collection.`
                  : "Your coupon doesn't have any associated media files."}
              </p>
              <div className="flex gap-3">
                {(search || fileTypeFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFileTypeFilter("all");
                    }}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                )}
                <button
                  onClick={() => router.push("/redeem")}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                >
                  Try Another Coupon
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Results Header */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FolderOpen className="w-6 h-6" />
                  Your Media Library
                </h2>
                <p className="text-gray-400 mt-1">
                  Showing {filteredMedia.length} of {media.length} files
                  {search && ` matching "${search}"`}
                  {fileTypeFilter !== "all" && ` • Filtered by ${fileTypeFilter}s`}
                </p>
              </div>
              {(search || fileTypeFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setFileTypeFilter("all");
                  }}
                  className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
            
            {/* Media Grid */}
            <div className="grid gap-6">
              {filteredMedia.map((m) => {
                const displayName = getDisplayName(m);
                
                return (
                  <div
                    key={m.id}
                    className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300 hover:border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {m.type === "image" ? (
                          <div className="flex-shrink-0">
                            {renderInlinePreview(m)}
                          </div>
                        ) : (
                          <div className="p-3 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                            {getFileIcon(m.type)}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 
                              className="font-semibold text-lg truncate" 
                              title={m.fileName}
                            >
                              {displayName}
                            </h3>
                            <span className={`text-xs px-3 py-1 rounded-full border ${getTypeColor(m.type)} whitespace-nowrap`}>
                              {getFileExtension(m.fileName)} • {m.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                            {m.size && <span>{formatFileSize(m.size)}</span>}
                            {m.created_at && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(m.created_at).toLocaleDateString()}</span>
                              </div>
                            )}
                            <div className="text-xs text-gray-500 truncate max-w-xs" title="Original filename">
                              {m.fileName}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {["image", "video", "audio"].includes(m.type) && (
                          <button
                            onClick={() => previewMedia(m)}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium flex items-center gap-2 transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Preview</span>
                          </button>
                        )}
                        <button
                          onClick={() => downloadFile(m.id, m.fileName)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Stats Footer */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{filteredMedia.length}</div>
                  <div className="text-gray-400 text-sm">Showing</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {filteredMedia.filter(m => m.type === 'image').length}
                  </div>
                  <div className="text-gray-400 text-sm">Images</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-400">
                    {filteredMedia.filter(m => m.type === 'video').length}
                  </div>
                  <div className="text-gray-400 text-sm">Videos</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    {filteredMedia.filter(m => m.type === 'audio').length}
                  </div>
                  <div className="text-gray-400 text-sm">Audio Files</div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          {expiryTime && (
            <p className="mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Your access expires on {expiryTime}. Download your files before they expire.
            </p>
          )}
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} LFC Jahi Media Archive • All rights reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
}