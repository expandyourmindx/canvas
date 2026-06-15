/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Music,
  Volume2,
  Loader2,
  Search,
  X,
  RefreshCw,
  HardDrive,
  Package,
  Pin,
  PinOff,
} from "lucide-react";
import { Cloud } from "lucide-react";
import { ChannelRow } from "../types";
import {
  SampleLibraryManager,
  SampleNode,
  UserFolder,
  getLibraryManager,
} from "../audio/SampleLibraryManager";
import { useAudioEngine } from "../audio/useAudioEngine";
import { getCloudSampleCache, setCloudSampleCache } from "../audio/CloudSampleCache";
import { useTheme } from "../theme/ThemeContext";
export { getLibraryManager };

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sample {
  id: string;
  name: string;
  path: string;
}

interface Category {
  name: string;
  samples: Sample[];
}

interface SampleBrowserProps {
  engine: any;
  channels: ChannelRow[];
  getSampleBuffer: (id: string) => AudioBuffer | undefined;
  previewChannel: (
    channelId: string,
    sampleId?: string,
    volume?: number,
    pan?: number,
    settings?: any
  ) => void;
  onSampleLoaded?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}



// ─── Component ───────────────────────────────────────────────────────────────

export function SampleBrowser({
  engine,
  channels,
  getSampleBuffer,
  previewChannel,
  onSampleLoaded,
  isPinned,
  onTogglePin,
}: SampleBrowserProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  // Local fallback pin state if not controlled from props
  const [localPinned, setLocalPinned] = useState(true);
  const pinned = isPinned !== undefined ? isPinned : localPinned;
  const togglePin = onTogglePin || (() => setLocalPinned(!localPinned));

  // ── Hover state tracking ──
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // ── Search Focus state ──
  const [searchFocused, setSearchFocused] = useState(false);
  // ── Built-in sample index (from /public/samples/sample-index.json) ──
  const [builtInCategories, setBuiltInCategories] = useState<Category[]>([]);

  // ── User folders (FSAA or fallback) ──
  const [userFolders, setUserFolders] = useState<UserFolder[]>([]);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  // ── UI state ──
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    __builtin__: true,
    __builtin__Kicks: true,
  });
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [cloudPacks, setCloudPacks] = useState<Record<string, string[]>>({});
  // keys are folder names, values are arrays of full file paths

  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudFetched, setCloudFetched] = useState(false);
  // cloudFetched prevents re-fetching if section is collapsed and reopened

  useAudioEngine();

  // ── Preview Source Tracking ──
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const localPreviewCacheRef = useRef<Map<string, AudioBuffer>>(new Map());


  // Load sample index and subscribe to library changes
  useEffect(() => {
    let active = true;

    async function fetchSampleIndex() {
      try {
        const res = await fetch("/samples/sample-index.json");
        if (!res.ok) throw new Error("Index file not found");
        const data = await res.json();
        if (active) {
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error("Failed to load sample index:", err);
      }
    }

    // Adapt sample index categories array directly
    function setCategories(cats: Category[]) {
      setBuiltInCategories(cats);
    }

    fetchSampleIndex();

    // Subscribe to FSAA library updates
    setUserFolders([...getLibraryManager().getFolders()]);
    const unsubscribe = getLibraryManager().subscribe(() => {
      if (active) {
        setUserFolders([...getLibraryManager().getFolders()]);
      }
    });

    return () => {
      active = false;
      unsubscribe();
      stopActivePreview();
    };
  }, []);

  const stopActivePreview = () => {
    engine.stopSampleBrowserPreview();
  };

  const playBufferDirect = (buffer: AudioBuffer) => {
    engine.playSampleBrowserPreview(buffer);
  };

  // On-demand load and decode of a single built-in sample for preview (does not register in engine timeline state)
  const loadBuiltInSample = async (sample: Sample): Promise<AudioBuffer | null> => {
    const cached = localPreviewCacheRef.current.get(sample.id) || getSampleBuffer(sample.id);
    if (cached) return cached;

    setLoadingItems((prev) => ({ ...prev, [sample.id]: true }));

    try {
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
      const ab = await res.arrayBuffer();
      
      const ctx = engine.audioContext as AudioContext;
      const decodedBuffer = await ctx.decodeAudioData(ab);
      
      localPreviewCacheRef.current.set(sample.id, decodedBuffer);
      return decodedBuffer;
    } catch (err) {
      console.error(`Failed to lazy load/decode built-in sample for preview: ${sample.name}`, err);
      return null;
    } finally {
      setLoadingItems((prev) => ({ ...prev, [sample.id]: false }));
    }
  };

  // On-demand load and decode of a single user sample for preview (does not register in engine timeline state)
  const loadUserSample = async (node: SampleNode): Promise<AudioBuffer | null> => {
    const cached = localPreviewCacheRef.current.get(node.path) || getSampleBuffer(node.path);
    if (cached) return cached;

    setLoadingItems((prev) => ({ ...prev, [node.path]: true }));

    try {
      const arrayBuffer = await getLibraryManager().loadBuffer(node);
      
      const ctx = engine.audioContext as AudioContext;
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      localPreviewCacheRef.current.set(node.path, decodedBuffer);
      return decodedBuffer;
    } catch (err) {
      console.error(`Failed to lazy load/decode user sample for preview: ${node.name}`, err);
      return null;
    } finally {
      setLoadingItems((prev) => ({ ...prev, [node.path]: false }));
    }
  };

  const loadCloudSample = async (filePath: string): Promise<AudioBuffer | null> => {
    const url = `https://samples.canvasdaw.com/${filePath.split('/').map(encodeURIComponent).join('/')}`
    
    // 1. In-memory cache (fastest)
    const cached = localPreviewCacheRef.current.get(url)
    if (cached) return cached

    setLoadingItems(prev => ({ ...prev, [url]: true }))
    try {
      const ctx = engine.audioContext as AudioContext

      // 2. IndexedDB cache (disk, no network)
      const idbBuffer = await getCloudSampleCache(url)
      if (idbBuffer) {
        const buffer = await ctx.decodeAudioData(idbBuffer)
        localPreviewCacheRef.current.set(url, buffer)
        return buffer
      }

      // 3. Network fetch (R2)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ab = await res.arrayBuffer()
      
      // Save to IndexedDB before decoding (decodeAudioData may detach buffer in some browsers)
      await setCloudSampleCache(url, ab)
      
      const buffer = await ctx.decodeAudioData(ab.slice(0))
      localPreviewCacheRef.current.set(url, buffer)
      return buffer
    } catch (err) {
      console.error('Failed to load cloud sample:', err)
      return null
    } finally {
      setLoadingItems(prev => ({ ...prev, [url]: false }))
    }
  }

  // ── Preview click handlers ──
  const handlePreviewBuiltIn = async (sample: Sample) => {
    stopActivePreview(); // Stop immediately on click
    try {
      const buffer = await loadBuiltInSample(sample);
      if (buffer) {
        playBufferDirect(buffer);
      }
    } catch (err) {
      console.warn("Sample preview trigger failed:", err);
    }
  };

  const handlePreviewUser = async (node: SampleNode) => {
    stopActivePreview(); // Stop immediately on click
    try {
      const buffer = await loadUserSample(node);
      if (buffer) {
        playBufferDirect(buffer);
      }
    } catch (err) {
      console.warn("User sample preview failed:", err);
    }
  };

  const handlePreviewCloud = async (filePath: string) => {
    stopActivePreview()
    const buffer = await loadCloudSample(filePath)
    if (buffer) playBufferDirect(buffer)
  }

  // ── Drag handlers ──
  const handleDragStartBuiltIn = (e: React.DragEvent, sample: Sample) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: sample.id,
        path: sample.path,
        name: sample.name,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
    loadBuiltInSample(sample); // Pre-fetch and cache
  };

  const handleDragStartUser = (e: React.DragEvent, node: SampleNode) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: node.path, // path is the unique ID for custom samples
        path: "", // loaded purely from engine memory cache
        name: node.name,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
    loadUserSample(node); // Pre-fetch and cache
  };

  const handleDragStartCloud = (e: React.DragEvent, filePath: string, displayName: string) => {
    const url = `https://samples.canvasdaw.com/${filePath.split('/').map(encodeURIComponent).join('/')}`
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: url,
      path: url,
      name: displayName,
    }))
    e.dataTransfer.effectAllowed = 'copy'
    loadCloudSample(filePath) // pre-fetch and cache on drag
  }

  // Toggle path expansion
  const togglePath = (path: string) => {
    setExpandedPaths((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleAddFolderClick = async () => {
    if (typeof (window as any).showDirectoryPicker !== "undefined") {
      try {
        const beforeFolders = getLibraryManager().getFolders().map(f => f.name);
        await getLibraryManager().addFolder();
        const afterFolders = getLibraryManager().getFolders();
        const newFolder = afterFolders.find(f => !beforeFolders.includes(f.name));
        if (newFolder) {
          setExpandedPaths(prev => ({ ...prev, [newFolder.name]: true }));
        }
      } catch (err) {
        console.warn("FSAA folder pick failed/cancelled", err);
      }
    } else {
      fallbackInputRef.current?.click();
    }
  };

  const handleFetchCloud = async () => {
    if (cloudFetched) return
    setCloudLoading(true)
    setCloudError(null)
    try {
      const res = await fetch('https://canvas-samples-list.electricblade5.workers.dev/')
      if (!res.ok) throw new Error(`Worker returned ${res.status}`)
      const paths: string[] = await res.json()
      // Group by first path segment (folder name)
      const grouped: Record<string, string[]> = {}
      for (const p of paths) {
        const folder = p.split('/')[0]
        if (!grouped[folder]) grouped[folder] = []
        grouped[folder].push(p)
      }
      setCloudPacks(grouped)
      setCloudFetched(true)
    } catch (err) {
      console.error('Cloud sample fetch failed:', err)
      setCloudError('Could not connect to sample library.')
    } finally {
      setCloudLoading(false)
    }
  }

  const handleRemoveFolder = async (folderIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await getLibraryManager().removeFolder(folderIndex);
  };

  const handleReauthorizeFolder = async (folderIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await getLibraryManager().reauthorizeFolder(folderIndex);
  };

  const handleFallbackFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      getLibraryManager().addFilesFromFallback(e.target.files);
    }
  };

  // ── Render Helpers ──

  const renderUserNode = (node: SampleNode, folderIndex: number, depth: number = 1) => {
    const isFolder = node.type === "folder";
    const isExpanded = !!expandedPaths[node.path];

    // Search query filter: only render if matches search
    if (searchQuery) {
      const matchesSearch = (n: SampleNode): boolean => {
        if (n.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
        if (n.children) {
          return n.children.some(matchesSearch);
        }
        return false;
      };
      if (!matchesSearch(node)) return null;
    }

    if (isFolder) {
      const isHovered = hoveredItemId === node.path;
      let bg = DARK.bg1;
      let fg = DARK.textMid;
      if (isHovered) {
        bg = DARK.bg3;
        fg = DARK.textHi;
      }

      return (
        <div key={node.path} style={{ display: "flex", flexDirection: "column" }}>
          <div
            onClick={() => togglePath(node.path)}
            onMouseEnter={() => setHoveredItemId(node.path)}
            onMouseLeave={() => setHoveredItemId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.sm}px`,
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              paddingLeft: `${depth * SPACE.xl}px`,
              backgroundColor: bg,
              color: fg,
              fontFamily: DARK.font,
              fontSize: "8px",
              textTransform: "uppercase" as const,
              cursor: "pointer",
              boxSizing: "border-box" as const,
              userSelect: "none" as const,
            }}
          >
            <ChevronRight
              size={10}
              style={{
                color: DARK.textLo,
                transform: isExpanded ? "rotate(90deg)" : "none",
                flexShrink: 0,
              }}
            />
            {isExpanded ? (
              <FolderOpen size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
            ) : (
              <Folder size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {node.children.map((child) => renderUserNode(child, folderIndex, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const stableId = node.path;
      const isSelected = selectedSampleId === stableId;
      const isLoading = !!loadingItems[node.path];
      const isHovered = hoveredItemId === stableId;

      let bg = DARK.bg1;
      let fg = DARK.textMid;
      if (isSelected) {
        bg = DARK.bg4;
        fg = DARK.accentMaster;
      } else if (isHovered) {
        bg = DARK.bg3;
        fg = DARK.textHi;
      }

      return (
        <div
          key={`file_${folderIndex}_${node.path}`}
          draggable
          onDragStart={(e) => handleDragStartUser(e, node)}
          onClick={() => {
            setSelectedSampleId(stableId);
            handlePreviewUser(node);
          }}
          onMouseEnter={() => setHoveredItemId(stableId)}
          onMouseLeave={() => setHoveredItemId(null)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            paddingLeft: `${depth * SPACE.xl}px`,
            backgroundColor: bg,
            color: fg,
            fontFamily: DARK.font,
            fontSize: "8px",
            textTransform: "uppercase" as const,
            cursor: "grab",
            boxSizing: "border-box" as const,
            userSelect: "none" as const,
          }}
          title={node.name}
        >
          <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px`, overflow: "hidden", flex: 1 }}>
            {isLoading ? (
              <Loader2 size={10} style={{ color: isSelected ? DARK.accentMaster : DARK.textLo, flexShrink: 0 }} />
            ) : (
              <Music size={10} style={{ color: isSelected ? DARK.accentMaster : DARK.textLo, flexShrink: 0 }} />
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          </div>
          {!isLoading && (
            <Volume2
              size={10}
              style={{
                color: isSelected ? DARK.accentMaster : DARK.textLo,
                opacity: isHovered || isSelected ? 1 : 0,
                flexShrink: 0,
              }}
            />
          )}
        </div>
      );
    }
  };

  const hasFSAASupport = typeof (window as any).showDirectoryPicker !== "undefined";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: DARK.bg1,
        borderRight: `1px solid ${DARK.bevelMid}`,
        userSelect: "none",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Header Title Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: `${SIZE.titleBarHeight}px`,
          backgroundColor: DARK.bg3,
          backgroundImage: DARK.titleBarGradient,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          padding: `0 ${SPACE.md}px`,
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontFamily: DARK.font,
            fontSize: "9px",
            color: DARK.textHi,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            fontWeight: "bold",
          }}
        >
          Sample Browser
        </span>
        <button
          onClick={togglePin}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "14px",
            height: "14px",
            backgroundColor: DARK.bg3,
            border: "none",
            cursor: "pointer",
            padding: 0,
            boxSizing: "border-box",
            ...(pinned ? sunken(DARK) : raised(DARK)),
          }}
          title={pinned ? "Unpin - switch to floating window" : "Pin - dock to left edge"}
        >
          {pinned ? (
            <Pin size={8} style={{ color: DARK.accentMaster }} />
          ) : (
            <PinOff size={8} style={{ color: DARK.textMid }} />
          )}
        </button>
      </div>

      {/* Search Header Container */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: `${SPACE.sm}px`,
          padding: `${SPACE.md}px`,
          backgroundColor: DARK.bg1,
          borderBottom: `1px solid ${DARK.bevelDark}`,
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flex: 1, alignItems: "center", position: "relative" }}>
          <input
            type="text"
            placeholder="SEARCH SAMPLES..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              flex: 1,
              backgroundColor: DARK.bg0,
              color: DARK.textHi,
              fontFamily: DARK.font,
              fontSize: "9px",
              padding: `${SPACE.xs}px ${SPACE.sm}px ${SPACE.xs}px 18px`,
              outline: "none",
              border: "none",
              textTransform: "uppercase",
              boxSizing: "border-box",
              ...(searchFocused ? { border: `1px solid ${DARK.bevelLight}` } : sunken(DARK)),
            }}
          />
          <Search
            size={10}
            style={{
              position: "absolute",
              left: "6px",
              color: DARK.textMid,
              pointerEvents: "none",
            }}
          />
        </div>
        <button
          onClick={handleAddFolderClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            backgroundColor: DARK.bg3,
            color: DARK.textMid,
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            padding: 0,
            ...raised(DARK),
          }}
          title={hasFSAASupport ? "Add native sample folder from disk" : "Upload directory fallback (Firefox/Safari)"}
        >
          <FolderPlus size={12} style={{ color: DARK.textMid }} />
        </button>
      </div>

      {/* Directory Folders Tree List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: `${SPACE.xs}px`,
          padding: `${SPACE.xs}px 0`,
          boxSizing: "border-box",
        }}
      >
        {/* ── Built-in Samples Section ── */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Section Header */}
          <div
            onClick={() => togglePath("__builtin__")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.sm}px`,
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: DARK.bg2,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              cursor: "pointer",
              boxSizing: "border-box",
              ...flat(DARK),
            }}
          >
            <ChevronRight
              size={10}
              style={{
                color: DARK.textLo,
                transform: expandedPaths.__builtin__ ? "rotate(90deg)" : "none",
                flexShrink: 0,
              }}
            />
            <Package size={12} style={{ color: DARK.accentBlue, flexShrink: 0 }} />
            <span>Built-in Presets</span>
          </div>

          {expandedPaths.__builtin__ &&
            builtInCategories.map((category) => {
              const catKey = `__builtin__${category.name}`;
              const isCatExpanded = !!expandedPaths[catKey];

              // Filter built-in samples based on search query
              const filteredSamples = category.samples.filter((s) =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (searchQuery && filteredSamples.length === 0) return null;

              const isCatHovered = hoveredItemId === catKey;
              let catBg = DARK.bg1;
              let catFg = DARK.textMid;
              if (isCatHovered) {
                catBg = DARK.bg3;
                catFg = DARK.textHi;
              }

              return (
                <div key={category.name} style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    onClick={() => togglePath(catKey)}
                    onMouseEnter={() => setHoveredItemId(catKey)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: `${SPACE.sm}px`,
                      padding: `${SPACE.xs}px ${SPACE.sm}px`,
                      paddingLeft: `${1 * SPACE.xl}px`,
                      backgroundColor: catBg,
                      color: catFg,
                      fontFamily: DARK.font,
                      fontSize: "8px",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <ChevronRight
                      size={10}
                      style={{
                        color: DARK.textLo,
                        transform: isCatExpanded ? "rotate(90deg)" : "none",
                        flexShrink: 0,
                      }}
                    />
                    {isCatExpanded ? (
                      <FolderOpen size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
                    ) : (
                      <Folder size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{category.name}</span>
                  </div>

                  {isCatExpanded && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {filteredSamples.map((sample) => {
                        const isSelected = selectedSampleId === sample.id;
                        const isLoading = !!loadingItems[sample.id];
                        const isSampleHovered = hoveredItemId === sample.id;

                        let sampBg = DARK.bg1;
                        let sampFg = DARK.textMid;
                        if (isSelected) {
                          sampBg = DARK.bg4;
                          sampFg = DARK.accentMaster;
                        } else if (isSampleHovered) {
                          sampBg = DARK.bg3;
                          sampFg = DARK.textHi;
                        }

                        return (
                          <div
                            key={sample.id}
                            draggable
                            onDragStart={(e) => handleDragStartBuiltIn(e, sample)}
                            onClick={() => {
                              setSelectedSampleId(sample.id);
                              handlePreviewBuiltIn(sample);
                            }}
                            onMouseEnter={() => setHoveredItemId(sample.id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: `${SPACE.xs}px ${SPACE.sm}px`,
                              paddingLeft: `${2 * SPACE.xl}px`,
                              backgroundColor: sampBg,
                              color: sampFg,
                              fontFamily: DARK.font,
                              fontSize: "8px",
                              textTransform: "uppercase",
                              cursor: "grab",
                              boxSizing: "border-box",
                            }}
                            title={sample.name}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px`, overflow: "hidden", flex: 1 }}>
                              {isLoading ? (
                                <Loader2 size={10} style={{ color: isSelected ? DARK.accentMaster : DARK.textLo, flexShrink: 0 }} />
                              ) : (
                                <Music size={10} style={{ color: isSelected ? DARK.accentMaster : DARK.textLo, flexShrink: 0 }} />
                              )}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sample.name}</span>
                            </div>
                            {!isLoading && (
                              <Volume2
                                size={10}
                                style={{
                                  color: isSelected ? DARK.accentMaster : DARK.textLo,
                                  opacity: isSampleHovered || isSelected ? 1 : 0,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* ── User Folders Section ── */}
        <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${DARK.bevelDark}`, paddingTop: `${SPACE.sm}px` }}>
          {/* Section Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: DARK.bg2,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              boxSizing: "border-box",
              ...flat(DARK),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
              <HardDrive size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
              <span>User Folders</span>
            </div>
          </div>

          {userFolders.length === 0 && (
            <div
              style={{
                padding: `${SPACE.lg}px`,
                textAlign: "center",
                fontSize: "8px",
                color: DARK.textDim,
                fontFamily: DARK.font,
                border: `1px dashed ${DARK.bevelMid}`,
                margin: `${SPACE.sm}px`,
                boxSizing: "border-box",
              }}
            >
              No custom folders added. Click the plus button above to add one.
            </div>
          )}

          {userFolders.map((folder, folderIndex) => {
            const isExpanded = !!expandedPaths[folder.name];
            const filteredChildren = folder.children;
            const isFolderHovered = hoveredItemId === folder.name;

            let fldBg = DARK.bg1;
            let fldFg = DARK.textMid;
            if (isFolderHovered) {
              fldBg = DARK.bg3;
              fldFg = DARK.textHi;
            }

            return (
              <div key={folder.name} style={{ display: "flex", flexDirection: "column" }}>
                <div
                  onClick={() => {
                    if (folder.authorized) {
                      togglePath(folder.name);
                    }
                  }}
                  onMouseEnter={() => setHoveredItemId(folder.name)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: `${SPACE.sm}px`,
                    padding: `${SPACE.xs}px ${SPACE.sm}px`,
                    paddingLeft: `${1 * SPACE.xl}px`,
                    backgroundColor: fldBg,
                    color: fldFg,
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  {folder.authorized ? (
                    <ChevronRight
                      size={10}
                      style={{
                        color: DARK.textLo,
                        transform: isExpanded ? "rotate(90deg)" : "none",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span
                      title="Re-authorize folder permission"
                      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
                    >
                      <RefreshCw
                        onClick={(e) => handleReauthorizeFolder(folderIndex, e)}
                        size={10}
                        style={{
                          color: DARK.accentMaster,
                          cursor: "pointer",
                        }}
                      />
                    </span>
                  )}
                  {isExpanded && folder.authorized ? (
                    <FolderOpen size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
                  ) : (
                    <Folder size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{folder.name}</span>

                  {!folder.authorized && (
                    <span
                      onClick={(e) => handleReauthorizeFolder(folderIndex, e)}
                      style={{
                        fontSize: "7.5px",
                        color: DARK.accentMaster,
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontFamily: DARK.font,
                        textTransform: "none",
                        paddingRight: `${SPACE.xs}px`,
                        flexShrink: 0,
                      }}
                    >
                      re-authorize
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => handleRemoveFolder(folderIndex, e)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "12px",
                      height: "12px",
                      backgroundColor: DARK.bg3,
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      opacity: isFolderHovered ? 1 : 0,
                      boxSizing: "border-box",
                      ...raised(DARK),
                    }}
                    title="Remove folder from library"
                  >
                    <X size={8} style={{ color: DARK.stateRed }} />
                  </button>
                </div>

                {/* Folder contents */}
                {isExpanded && folder.authorized && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {filteredChildren.map((child) => renderUserNode(child, folderIndex, 2))}
                    {filteredChildren.length === 0 && (
                      <div
                        style={{
                          padding: `${SPACE.xs}px ${SPACE.sm}px`,
                          paddingLeft: `${2 * SPACE.xl}px`,
                          fontSize: "8px",
                          color: DARK.textDim,
                          fontFamily: DARK.font,
                        }}
                      >
                        No audio files found in this folder.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Cloud Samples Section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${DARK.bevelDark}`, paddingTop: `${SPACE.sm}px` }}>
          {/* Section Header */}
          <div
            onClick={() => {
              togglePath('__cloud__')
              if (!cloudFetched) handleFetchCloud()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.sm}px`,
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: DARK.bg2,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              boxSizing: 'border-box',
              ...flat(DARK),
            }}
          >
            <ChevronRight
              size={10}
              style={{
                color: DARK.textLo,
                transform: expandedPaths.__cloud__ ? 'rotate(90deg)' : 'none',
                flexShrink: 0,
              }}
            />
            <Cloud size={12} style={{ color: DARK.accentBlue, flexShrink: 0 }} />
            <span>Cloud Samples</span>
          </div>

          {expandedPaths.__cloud__ && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {cloudLoading && (
                <div style={{ padding: `${SPACE.lg}px`, textAlign: 'center', fontSize: '8px', color: DARK.textDim, fontFamily: DARK.font }}>
                  <Loader2 size={12} style={{ color: DARK.accentMaster }} />
                </div>
              )}

              {cloudError && (
                <div style={{ padding: `${SPACE.sm}px ${SPACE.md}px`, fontSize: '8px', color: DARK.stateRed, fontFamily: DARK.font }}>
                  {cloudError}
                </div>
              )}

              {!cloudLoading && !cloudError && Object.entries(cloudPacks).map(([folderName, filePaths]) => {
                const packKey = `__cloud__${folderName}`
                const isExpanded = !!expandedPaths[packKey]
                const isHovered = hoveredItemId === packKey

                const filteredPaths = searchQuery
                  ? filePaths.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
                  : filePaths

                if (searchQuery && filteredPaths.length === 0) return null

                return (
                  <div key={folderName} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      onClick={() => togglePath(packKey)}
                      onMouseEnter={() => setHoveredItemId(packKey)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${SPACE.sm}px`,
                        padding: `${SPACE.xs}px ${SPACE.sm}px`,
                        paddingLeft: `${1 * SPACE.xl}px`,
                        backgroundColor: isHovered ? DARK.bg3 : DARK.bg1,
                        color: isHovered ? DARK.textHi : DARK.textMid,
                        fontFamily: DARK.font,
                        fontSize: '8px',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        userSelect: 'none',
                      }}
                    >
                      <ChevronRight size={10} style={{ color: DARK.textLo, transform: isExpanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
                      {isExpanded
                        ? <FolderOpen size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
                        : <Folder size={12} style={{ color: DARK.accentMaster, flexShrink: 0 }} />
                      }
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{folderName}</span>
                      <span style={{ fontSize: '7px', color: DARK.textDim, fontFamily: DARK.font, flexShrink: 0 }}>{filePaths.length}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredPaths.map((filePath) => {
                          const url = `https://samples.canvasdaw.com/${filePath.split('/').map(encodeURIComponent).join('/')}`
                          // Strip folder prefix and file extension for display
                          const rawName = filePath.split('/').slice(1).join('/')
                          const displayName = rawName.replace(/\.[^/.]+$/, '')
                          const isSelected = selectedSampleId === url
                          const isLoading = !!loadingItems[url]
                          const isHov = hoveredItemId === url

                          return (
                            <div
                              key={url}
                              draggable
                              onDragStart={(e) => handleDragStartCloud(e, filePath, displayName)}
                              onClick={() => {
                                setSelectedSampleId(url)
                                handlePreviewCloud(filePath)
                              }}
                              onMouseEnter={() => setHoveredItemId(url)}
                              onMouseLeave={() => setHoveredItemId(null)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: `${SPACE.xs}px ${SPACE.sm}px`,
                                paddingLeft: `${2 * SPACE.xl}px`,
                                backgroundColor: isSelected ? DARK.bg4 : isHov ? DARK.bg3 : DARK.bg1,
                                color: isSelected ? DARK.accentMaster : isHov ? DARK.textHi : DARK.textMid,
                                fontFamily: DARK.font,
                                fontSize: '8px',
                                textTransform: 'uppercase',
                                cursor: 'grab',
                                boxSizing: 'border-box',
                                userSelect: 'none',
                              }}
                              title={displayName}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: `${SPACE.sm}px`, overflow: 'hidden', flex: 1 }}>
                                {isLoading
                                  ? <Loader2 size={10} style={{ color: isSelected ? DARK.accentMaster : DARK.textLo, flexShrink: 0 }} />
                                  : <Music size={10} style={{ color: isSelected ? DARK.accentMaster : DARK.textLo, flexShrink: 0 }} />
                                }
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                              </div>
                              {!isLoading && (
                                <Volume2
                                  size={10}
                                  style={{
                                    color: isSelected ? DARK.accentMaster : DARK.textLo,
                                    opacity: isHov || isSelected ? 1 : 0,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hidden fallback input for Firefox/Safari */}
      <input
        ref={fallbackInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: "none" }}
        onChange={handleFallbackFiles}
      />
    </div>
  );
}
