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
} from "lucide-react";
import { ChannelRow } from "../types";
import {
  SampleLibraryManager,
  SampleNode,
  UserFolder,
  getLibraryManager,
} from "../audio/SampleLibraryManager";
import { useAudioEngine } from "../audio/useAudioEngine";
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
}



// ─── Component ───────────────────────────────────────────────────────────────

export function SampleBrowser({
  engine,
  channels,
  getSampleBuffer,
  previewChannel,
  onSampleLoaded,
}: SampleBrowserProps) {
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

  const { playbackState } = useAudioEngine();

  // ── Preview Source Tracking ──
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const localPreviewCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  // Stop active preview when transport plays or stops
  useEffect(() => {
    if (playbackState === "playing" || playbackState === "stopped") {
      stopActivePreview();
    }
  }, [playbackState]);

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
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch (e) {}
      previewSourceRef.current = null;
    }
  };

  const playBufferDirect = (buffer: AudioBuffer) => {
    stopActivePreview();

    const ctx = engine.audioContext as AudioContext;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Route to master gain node so DAW volume applies, or fallback to destination
    const destinationNode = (engine as any).masterGainNode || ctx.destination;
    source.connect(destinationNode);

    source.start(0);
    previewSourceRef.current = source;

    source.onended = () => {
      if (previewSourceRef.current === source) {
        previewSourceRef.current = null;
      }
    };
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

  const renderUserNode = (node: SampleNode, folderIndex: number, depth: number = 0) => {
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
      return (
        <div key={node.path} className="space-y-0.5">
          <div
            onClick={() => togglePath(node.path)}
            className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-[#121316]/30 cursor-pointer text-[9px] text-zinc-400 select-none font-mono"
            style={{ paddingLeft: `${10 + depth * 8}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="space-y-0.5">
              {node.children.map((child) => renderUserNode(child, folderIndex, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const stableId = node.path;
      const isSelected = selectedSampleId === stableId;
      const isLoading = !!loadingItems[node.path];

      return (
        <div
          key={`file_${folderIndex}_${node.path}`}
          draggable
          onDragStart={(e) => handleDragStartUser(e, node)}
          onClick={() => {
            setSelectedSampleId(stableId);
            handlePreviewUser(node);
          }}
          className={`group flex items-center justify-between py-1 px-2 cursor-grab active:cursor-grabbing text-[9px] font-mono select-none rounded-none transition-all duration-100 border ${
            isSelected
              ? "bg-[#181d26] text-amber-400 border-amber-500/30"
              : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-neutral-850/30"
          }`}
          style={{ paddingLeft: `${10 + depth * 8}px` }}
          title={node.name}
        >
          <div className="flex items-center gap-1.5 truncate">
            {isLoading ? (
              <Loader2 className="h-3 w-3 text-amber-500 animate-spin shrink-0" />
            ) : (
              <Music className={`h-3 w-3 shrink-0 ${isSelected ? "text-amber-400" : "text-zinc-650"}`} />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {!isLoading && (
            <Volume2 className="h-2.5 w-2.5 text-amber-400/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      );
    }
  };

  const hasFSAASupport = typeof (window as any).showDirectoryPicker !== "undefined";

  return (
    <div className="w-[220px] shrink-0 border border-[#1b1c20]/40 bg-black/15 flex flex-col h-full select-none scrollbar-thin overflow-hidden">
      {/* Search Header */}
      <div className="p-2 border-b border-neutral-900 bg-[#0c0d10] flex items-center gap-1.5 shrink-0">
        <Search className="h-3 w-3 text-zinc-500 shrink-0" />
        <input
          type="text"
          placeholder="Search samples..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-[9px] text-neutral-200 outline-none w-full placeholder-zinc-600 font-mono"
        />
        <button
          onClick={handleAddFolderClick}
          className="p-1 hover:bg-[#1b1c20] text-zinc-400 hover:text-amber-400 transition-colors rounded-xs border border-transparent hover:border-neutral-800"
          title={hasFSAASupport ? "Add native sample folder from disk" : "Upload directory fallback (Firefox/Safari)"}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Directory Folders Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 select-none scrollbar-thin">
        {/* ── Built-in Samples Section ── */}
        <div className="space-y-1">
          <div
            onClick={() => togglePath("__builtin__")}
            className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-[#121316]/50 cursor-pointer select-none text-[9.5px] font-bold text-zinc-400 uppercase tracking-widest transition-colors duration-100"
          >
            {expandedPaths.__builtin__ ? (
              <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
            )}
            <Package className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
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

              return (
                <div key={category.name} className="pl-2 space-y-1">
                  <div
                    onClick={() => togglePath(catKey)}
                    className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-[#121316]/30 cursor-pointer text-[9px] font-bold text-zinc-500 uppercase select-none"
                  >
                    {isCatExpanded ? (
                      <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                    )}
                    <span className="truncate">{category.name}</span>
                  </div>

                  {isCatExpanded && (
                    <div className="pl-3.5 space-y-0.5 border-l border-neutral-900 ml-1.5">
                      {filteredSamples.map((sample) => {
                        const isSelected = selectedSampleId === sample.id;
                        const isLoading = !!loadingItems[sample.id];

                        return (
                          <div
                            key={sample.id}
                            draggable
                            onDragStart={(e) => handleDragStartBuiltIn(e, sample)}
                            onClick={() => {
                              setSelectedSampleId(sample.id);
                              handlePreviewBuiltIn(sample);
                            }}
                            className={`group flex items-center justify-between py-1 px-2 cursor-grab active:cursor-grabbing text-[9px] font-mono select-none rounded-none transition-all duration-100 border ${
                              isSelected
                                ? "bg-[#181d26] text-cyan-400 border-cyan-500/30"
                                : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-neutral-850/30"
                            }`}
                            title={sample.name}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 text-cyan-500 animate-spin shrink-0" />
                              ) : (
                                <Music
                                  className={`h-3 w-3 shrink-0 ${
                                    isSelected ? "text-cyan-400" : "text-zinc-600"
                                  }`}
                                />
                              )}
                              <span className="truncate">{sample.name}</span>
                            </div>
                            {!isLoading && (
                              <Volume2 className="h-2.5 w-2.5 text-cyan-400/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
        <div className="pt-2 border-t border-neutral-900/60 space-y-1">
          <div className="flex items-center justify-between px-1.5 py-1 text-[9.5px] font-bold text-zinc-400 uppercase tracking-widest select-none">
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>User Folders</span>
            </div>
          </div>

          {userFolders.length === 0 && (
            <div className="px-2 py-3 border border-dashed border-neutral-850 text-center text-[8.5px] text-zinc-500 font-mono">
              No custom folders added. Click the plus button above to add one.
            </div>
          )}

          {userFolders.map((folder, folderIndex) => {
            const isExpanded = !!expandedPaths[folder.name];
            const filteredChildren = folder.children;

            return (
              <div key={folder.name} className="space-y-0.5">
                <div
                  onClick={() => togglePath(folder.name)}
                  className="group flex items-center gap-1.5 py-1 px-1.5 hover:bg-[#121316]/50 cursor-pointer select-none text-[9px] font-bold text-zinc-400 uppercase tracking-wide transition-colors duration-100"
                >
                  {folder.authorized ? (
                    isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                    )
                  ) : (
                    <span title="Re-authorize folder permission">
                      <RefreshCw
                        onClick={(e) => handleReauthorizeFolder(folderIndex, e)}
                        className="h-3 w-3 text-amber-500 hover:text-amber-400 animate-pulse shrink-0"
                      />
                    </span>
                  )}
                  {isExpanded && folder.authorized ? (
                    <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className="truncate flex-1">{folder.name}</span>

                  {!folder.authorized && (
                    <span
                      onClick={(e) => handleReauthorizeFolder(folderIndex, e)}
                      className="text-[7.5px] text-amber-500 hover:text-amber-400 font-normal normal-case tracking-normal hover:underline shrink-0 pr-1"
                    >
                      re-authorize
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => handleRemoveFolder(folderIndex, e)}
                    className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-950/30 text-zinc-650 hover:text-red-400 transition-all cursor-pointer rounded-xs"
                    title="Remove folder from library"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>

                {/* Folder contents */}
                {isExpanded && folder.authorized && (
                  <div className="pl-2 space-y-0.5 border-l border-neutral-900/60 ml-2">
                    {filteredChildren.map((child) => renderUserNode(child, folderIndex))}
                    {filteredChildren.length === 0 && (
                      <div className="px-2 py-2 text-[8px] text-zinc-600 font-mono">
                        No audio files found in this folder.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden fallback input for Firefox/Safari */}
      <input
        ref={fallbackInputRef}
        type="file"
        // @ts-ignore — webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFallbackFiles}
      />
    </div>
  );
}
