"use client";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { Separator } from "@/components/ui/separator";

import {
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import LoadingStep from "@/modules/playground/components/loader";

import { PlaygroundEditor } from "@/modules/playground/components/playground-editor";

import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";

import ToggleAI from "@/modules/playground/components/toggle-ai";

import { useAISuggestions } from "@/modules/playground/hooks/useAISuggestion";

import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";

import { usePlayground } from "@/modules/playground/hooks/usePlayground";

import {
  findFilePath,
  listProjectFiles,
  updateProjectFile,
} from "@/modules/playground/lib";

import { getEditorLanguage } from "@/modules/playground/lib/editor-config";

import {
  IdeCommandCenter,
  defaultIdeSettings,
  type EditorSettings,
} from "@/modules/playground/components/ide-command-center";

import { getRuntime } from "@/modules/webcontainers/lib/runtime";

import { transformToWebContainerFormat } from "@/modules/webcontainers/hooks/transformer";

import {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";

import WebContainerPreview from "@/modules/webcontainers/components/webcontainer-preview";

import { useWebContainer } from "@/modules/webcontainers/hooks/useWebContainer";

import {
  AlertCircle,
  Circle,
  FileText,
  FolderOpen,
  Save,
  Settings,
  X,
} from "lucide-react";

import { useParams } from "next/navigation";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "sonner";

const MainPlaygroundPage = () => {
  const { id } = useParams<{
    id: string;
  }>();

  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  /*
   * FILE EXPLORER WIDTH
   *
   * Default: 256px
   * Minimum: 180px
   * Maximum: 520px
   *
   * Width is saved so the explorer keeps
   * the user's preferred size.
   */
  const { state: sidebarState } = useSidebar();

  const [explorerWidth, setExplorerWidth] = useState(256);

  /*
   * Restore saved explorer width.
   */
  useEffect(() => {
    const stored = window.localStorage.getItem("vibecode-explorer-width");

    if (!stored) {
      return;
    }

    const width = Number(stored);

    if (!Number.isFinite(width)) {
      return;
    }

    setExplorerWidth(Math.min(520, Math.max(180, width)));
  }, []);

  /*
   * Save explorer width.
   */
  useEffect(() => {
    window.localStorage.setItem(
      "vibecode-explorer-width",
      String(explorerWidth),
    );
  }, [explorerWidth]);

  /*
   * Drag File Explorer boundary.
   */
  const handleExplorerResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (sidebarState === "collapsed") {
        return;
      }

      event.preventDefault();

      const startX = event.clientX;

      const startWidth = explorerWidth;

      document.body.style.cursor = "col-resize";

      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const difference = moveEvent.clientX - startX;

        const nextWidth = Math.min(520, Math.max(180, startWidth + difference));

        setExplorerWidth(nextWidth);
      };

      const handlePointerUp = () => {
        document.body.style.cursor = "";

        document.body.style.userSelect = "";

        window.removeEventListener("pointermove", handlePointerMove);

        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);

      window.addEventListener("pointerup", handlePointerUp);
    },
    [explorerWidth, sidebarState],
  );

  const [cursor, setCursor] = useState({
    line: 1,
    column: 1,
  });

  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    if (typeof window === "undefined") {
      return defaultIdeSettings;
    }

    const stored = window.localStorage.getItem("vibecode-editor-settings");

    if (!stored) {
      return defaultIdeSettings;
    }

    try {
      return {
        ...defaultIdeSettings,
        ...JSON.parse(stored),
      };
    } catch {
      return defaultIdeSettings;
    }
  });

  const { playgroundData, templateData, isLoading, error, saveTemplateData } =
    usePlayground(id);

  const aiSuggestions = useAISuggestions();

  const {
    setTemplateData,
    setActiveFileId,
    setPlaygroundId,
    setOpenFiles,
    activeFileId,
    closeAllFiles,
    closeFile,
    openFile,
    openFiles,

    handleAddFile,
    handleAddFolder,
    handleDeleteFile,
    handleDeleteFolder,
    handleRenameFile,
    handleRenameFolder,
    updateFileContent,
  } = useFileExplorer();

  const {
    serverUrl,
    isLoading: containerLoading,
    error: containerError,
    instance,
    writeFileSync,
  } = useWebContainer({
    templateData,
    workspaceId: id,
  });

  const lastSyncedContent = useRef<Map<string, string>>(new Map());

  /*
   * Tell file explorer which
   * project is currently open.
   */
  useEffect(() => {
    setPlaygroundId(id);
  }, [id, setPlaygroundId]);

  /*
   * Open the first useful source file
   * when the project loads.
   */
  useEffect(() => {
    if (!templateData) {
      return;
    }

    setTemplateData(templateData);

    if (!openFiles.length) {
      const files = listProjectFiles(templateData);

      const first =
        files.find((file) =>
          /^(tsx?|jsx?|html|vue)$/.test(file.fileExtension),
        ) ?? files[0];

      if (first) {
        openFile(first);
      }
    }
  }, [templateData, setTemplateData, openFiles.length, openFile]);

  const persistSettings = (settings: EditorSettings) => {
    setEditorSettings(settings);

    window.localStorage.setItem(
      "vibecode-editor-settings",
      JSON.stringify(settings),
    );
  };

  /*
   * FILE EXPLORER ACTIONS
   */

  const wrappedHandleAddFile = useCallback(
    (newFile: TemplateFile, parentPath: string) => {
      return handleAddFile(
        newFile,
        parentPath,
        writeFileSync!,
        instance,
        saveTemplateData,
      );
    },
    [handleAddFile, writeFileSync, instance, saveTemplateData],
  );

  const wrappedHandleAddFolder = useCallback(
    (newFolder: TemplateFolder, parentPath: string) => {
      return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
    },
    [handleAddFolder, instance, saveTemplateData],
  );

  const wrappedHandleDeleteFile = useCallback(
    (file: TemplateFile, parentPath: string) => {
      return handleDeleteFile(file, parentPath, saveTemplateData);
    },
    [handleDeleteFile, saveTemplateData],
  );

  const wrappedHandleDeleteFolder = useCallback(
    (folder: TemplateFolder, parentPath: string) => {
      return handleDeleteFolder(folder, parentPath, saveTemplateData);
    },
    [handleDeleteFolder, saveTemplateData],
  );

  const wrappedHandleRenameFile = useCallback(
    (
      file: TemplateFile,
      newFilename: string,
      newExtension: string,
      parentPath: string,
    ) => {
      return handleRenameFile(
        file,
        newFilename,
        newExtension,
        parentPath,
        saveTemplateData,
      );
    },
    [handleRenameFile, saveTemplateData],
  );

  const wrappedHandleRenameFolder = useCallback(
    (folder: TemplateFolder, newFolderName: string, parentPath: string) => {
      return handleRenameFolder(
        folder,
        newFolderName,
        parentPath,
        saveTemplateData,
      );
    },
    [handleRenameFolder, saveTemplateData],
  );

  const activeFile = openFiles.find((file) => file.id === activeFileId);

  const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

  const handleFileSelect = (file: TemplateFile) => {
    openFile(file);
  };

  /*
   * SAVE CURRENT FILE
   */

  const handleSave = useCallback(
    async (fileId?: string) => {
      const targetFileId = fileId || activeFileId;

      if (!targetFileId) {
        return;
      }

      const fileToSave = openFiles.find((file) => file.id === targetFileId);

      if (!fileToSave) {
        return;
      }

      const latestTemplateData = useFileExplorer.getState().templateData;

      if (!latestTemplateData) {
        return;
      }

      try {
        const filePath = findFilePath(fileToSave, latestTemplateData);

        if (!filePath) {
          toast.error(
            `Could not find path for file: ${fileToSave.filename}.${fileToSave.fileExtension}`,
          );

          return;
        }

        const updatedTemplateData = updateProjectFile(
          latestTemplateData,
          filePath,
          fileToSave.content,
        );

        /*
         * Write only the changed file into
         * the running WebContainer.
         *
         * We do NOT reinstall dependencies
         * for normal source-code edits.
         */
        if (writeFileSync) {
          await writeFileSync(filePath, fileToSave.content);

          lastSyncedContent.current.set(fileToSave.id, fileToSave.content);
        }

        await saveTemplateData(updatedTemplateData);

        setTemplateData(updatedTemplateData);

        const updatedOpenFiles = openFiles.map((file) =>
          file.id === targetFileId
            ? {
                ...file,

                content: fileToSave.content,

                originalContent: fileToSave.content,

                hasUnsavedChanges: false,
              }
            : file,
        );

        setOpenFiles(updatedOpenFiles);

        toast.success(
          `Saved ${fileToSave.filename}.${fileToSave.fileExtension}`,
        );
      } catch (error) {
        console.error("Error saving file:", error);

        toast.error(
          `Failed to save ${fileToSave.filename}.${fileToSave.fileExtension}`,
        );

        throw error;
      }
    },
    [
      activeFileId,
      openFiles,
      writeFileSync,
      saveTemplateData,
      setTemplateData,
      setOpenFiles,
    ],
  );

  /*
   * SAVE ALL
   */

  const handleSaveAll = useCallback(async () => {
    const unsavedFiles = openFiles.filter((file) => file.hasUnsavedChanges);

    if (unsavedFiles.length === 0) {
      toast.info("No unsaved changes");

      return;
    }

    try {
      await Promise.all(unsavedFiles.map((file) => handleSave(file.id)));

      toast.success(`Saved ${unsavedFiles.length} file(s)`);
    } catch {
      toast.error("Failed to save some files");
    }
  }, [openFiles, handleSave]);

  /*
   * AUTO SAVE
   */

  useEffect(() => {
    if (!editorSettings.autoSave || !activeFile?.hasUnsavedChanges) {
      return;
    }

    const timer = setTimeout(() => {
      void handleSave(activeFile.id);
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    activeFile?.content,
    activeFile?.hasUnsavedChanges,
    activeFile?.id,
    editorSettings.autoSave,
    handleSave,
  ]);

  /*
   * KEYBOARD SHORTCUTS
   *
   * Ctrl/Cmd + S
   * Ctrl/Cmd + Shift + S
   */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key.toLowerCase() === "s" && event.shiftKey) {
        event.preventDefault();

        void handleSaveAll();

        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();

        void handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleSaveAll]);

  /*
   * Server status used by
   * our bottom status bar.
   */

  const runtimeStatus = containerError
    ? "Error"
    : containerLoading
      ? "Starting"
      : serverUrl
        ? "Ready"
        : "Idle";

  const runtimeDot =
    runtimeStatus === "Ready"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
      : runtimeStatus === "Error"
        ? "bg-red-500"
        : runtimeStatus === "Starting"
          ? "bg-amber-400 animate-pulse"
          : "bg-zinc-600";

  /*
   * ERROR STATE
   */

  if (error) {
    return (
      <div
        className="
          flex
          h-[calc(100vh-4rem)]
          flex-col
          items-center
          justify-center
          bg-[#09090b]
          p-4
        "
      >
        <AlertCircle
          className="
            mb-4
            h-12
            w-12
            text-red-500
          "
        />

        <h2
          className="
            mb-2
            text-xl
            font-semibold
            text-red-400
          "
        >
          Something went wrong
        </h2>

        <p
          className="
            mb-4
            max-w-lg
            text-center
            text-sm
            text-zinc-500
          "
        >
          {error}
        </p>

        <Button onClick={() => window.location.reload()} variant="destructive">
          Try Again
        </Button>
      </div>
    );
  }

  /*
   * LOADING STATE
   */

  if (isLoading) {
    return (
      <div
        className="
          ide-loading
          h-screen
          bg-[#09090b]
          p-4
          text-zinc-300
        "
      >
        <div
          className="
            h-11
            animate-pulse
            border-b
            border-white/10
            bg-white/[0.035]
          "
        />

        <div
          className="
            grid
            h-[calc(100%-2.75rem)]
            grid-cols-[240px_1fr_36%]
            gap-px
            bg-white/[0.06]
          "
        >
          <div
            className="
              bg-[#111318]
              p-4
            "
          >
            <LoadingStep
              currentStep={1}
              step={1}
              label="Loading project files"
            />
          </div>

          <div
            className="
              bg-[#0b0d10]
            "
          />

          <div
            className="
              bg-[#111318]
            "
          />
        </div>
      </div>
    );
  }

  /*
   * NO TEMPLATE
   */

  if (!templateData) {
    return (
      <div
        className="
          flex
          h-[calc(100vh-4rem)]
          flex-col
          items-center
          justify-center
          bg-[#09090b]
          p-4
        "
      >
        <FolderOpen
          className="
            mb-4
            h-12
            w-12
            text-amber-500
          "
        />

        <h2
          className="
            mb-2
            text-xl
            font-semibold
            text-amber-400
          "
        >
          No template data available
        </h2>

        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Template
        </Button>
      </div>
    );
  }

  return (
   <TooltipProvider>
    <div
      className="
        relative
        flex
        min-h-svh
        w-full
      "
      style={
        {
          "--sidebar-width":
            `${explorerWidth}px`,
        } as React.CSSProperties
      }
    >
        {/* ============================
            FILE EXPLORER
        ============================ */}

        {!focusMode && (
          <TemplateFileTree
            data={templateData}
            onFileSelect={handleFileSelect}
            selectedFile={activeFile}
            title="File Explorer"
            onAddFile={wrappedHandleAddFile}
            onAddFolder={wrappedHandleAddFolder}
            onDeleteFile={wrappedHandleDeleteFile}
            onDeleteFolder={wrappedHandleDeleteFolder}
            onRenameFile={wrappedHandleRenameFile}
            onRenameFolder={wrappedHandleRenameFolder}
          />
        )}

        {/* ============================
            FILE EXPLORER RESIZE HANDLE
        ============================ */}
        {!focusMode && sidebarState === "expanded" && (
          <div
            role="separator"
            aria-label="Resize File Explorer"
            aria-orientation="vertical"
            aria-valuemin={180}
            aria-valuemax={520}
            aria-valuenow={explorerWidth}
            title="Drag to resize • Double-click to reset"
            onPointerDown={handleExplorerResize}
            onDoubleClick={() => setExplorerWidth(256)}
            style={{ left: explorerWidth - 3 }}
            className="fixed inset-y-0 z-50 hidden w-[6px] cursor-col-resize touch-none select-none bg-transparent transition-colors hover:bg-rose-500/35 active:bg-rose-500/60 md:block"
          />
        )}

        <SidebarInset
          className="
            overflow-hidden
            bg-[#09090b]
          "
        >
          {/* ============================
              TOP IDE HEADER
          ============================ */}

          <header
            className="
              relative
              flex
              h-12
              shrink-0
              items-center
              gap-2
              border-b
              border-white/[0.06]
              bg-[#101216]/95
              px-3
              text-zinc-100
              backdrop-blur-xl
            "
          >
            {/* subtle accent line */}

            <div
              className="
                pointer-events-none
                absolute
                bottom-[-1px]
                left-0
                h-px
                w-28
                bg-gradient-to-r
                from-rose-500
                to-transparent
                opacity-70
              "
            />

            <SidebarTrigger
              className="
                -ml-1
                text-zinc-500
                transition-colors
                hover:text-zinc-100
              "
            />

            <Separator
              orientation="vertical"
              className="
                mr-2
                h-4
                bg-white/[0.07]
              "
            />

            <div
              className="
                flex
                flex-1
                items-center
                gap-2
              "
            >
              <div
                className="
                  flex
                  min-w-0
                  flex-1
                  flex-col
                "
              >
                <h1
                  className="
                    truncate
                    text-sm
                    font-medium
                    tracking-tight
                    text-zinc-200
                  "
                >
                  {playgroundData?.title || "Code Playground"}
                </h1>

                <p
                  className="
                    mt-0.5
                    text-[9px]
                    text-zinc-600
                  "
                >
                  {openFiles.length} File(s) Open
                  {hasUnsavedChanges && " • Unsaved changes"}
                </p>
              </div>

              {/* RIGHT TOOLBAR */}

              <div
                className="
                  flex
                  items-center
                  gap-1
                "
              >
                <IdeCommandCenter
                  files={listProjectFiles(templateData)}
                  onOpenFile={handleFileSelect}
                  onRun={() =>
                    instance &&
                    void getRuntime(instance).sync(
                      transformToWebContainerFormat(templateData),
                      true,
                    )
                  }
                  onTogglePreview={() => setIsPreviewVisible((value) => !value)}
                  onToggleTerminal={() =>
                    window.dispatchEvent(
                      new KeyboardEvent("keydown", {
                        key: "j",
                        ctrlKey: true,
                      }),
                    )
                  }
                  onFocus={() => setFocusMode((value) => !value)}
                  settings={editorSettings}
                  onSettings={persistSettings}
                />

                {/* SAVE */}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave()}
                      disabled={!activeFile || !activeFile.hasUnsavedChanges}
                      className="
                        h-8
                        border-white/[0.08]
                        bg-white/[0.025]
                        text-zinc-400
                        transition-all
                        hover:border-white/[0.14]
                        hover:bg-white/[0.06]
                        hover:text-white
                      "
                    >
                      <Save
                        className="
                          h-3.5
                          w-3.5
                        "
                      />
                    </Button>
                  </TooltipTrigger>

                  <TooltipContent>Save (Ctrl+S)</TooltipContent>
                </Tooltip>

                {/* SAVE ALL */}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveAll}
                      disabled={!hasUnsavedChanges}
                      className="
                        h-8
                        border-white/[0.08]
                        bg-white/[0.025]
                        text-zinc-400
                        transition-all
                        hover:border-white/[0.14]
                        hover:bg-white/[0.06]
                        hover:text-white
                      "
                    >
                      <Save
                        className="
                          h-3.5
                          w-3.5
                        "
                      />

                      <span
                        className="
                          hidden
                          xl:inline
                        "
                      >
                        All
                      </span>
                    </Button>
                  </TooltipTrigger>

                  <TooltipContent>Save All (Ctrl+Shift+S)</TooltipContent>
                </Tooltip>

                {/* AI */}

                <ToggleAI
                  isEnabled={aiSuggestions.isEnabled}
                  onToggle={aiSuggestions.toggleEnabled}
                  suggestionLoading={aiSuggestions.isLoading}
                />

                {/* SETTINGS */}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="
                        h-8
                        w-8
                        border-white/[0.08]
                        bg-white/[0.025]
                        p-0
                        text-zinc-500
                        transition-all
                        hover:border-white/[0.14]
                        hover:bg-white/[0.06]
                        hover:text-white
                      "
                    >
                      <Settings
                        className="
                          h-3.5
                          w-3.5
                        "
                      />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className="
                      border-white/[0.08]
                      bg-[#111318]
                    "
                  >
                    <DropdownMenuItem
                      onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                    >
                      {isPreviewVisible ? "Hide" : "Show"} Preview
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={closeAllFiles}>
                      Close All Files
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* ============================
              IDE WORKSPACE
          ============================ */}

          <div
            className="
              h-[calc(100vh-3rem)]
              bg-[#09090b]
            "
          >
            {openFiles.length > 0 ? (
              <div
                className="
                  flex
                  h-full
                  flex-col
                "
              >
                {/* ============================
                    FILE TABS
                ============================ */}

                <div
                  className="
                    shrink-0
                    border-b
                    border-white/[0.06]
                    bg-[#0e1014]
                  "
                >
                  <Tabs
                    value={activeFileId || ""}
                    onValueChange={setActiveFileId}
                  >
                    <div
                      className="
                        flex
                        h-9
                        items-center
                        justify-between
                        overflow-hidden
                      "
                    >
                      <TabsList
                        className="
                          h-9
                          max-w-full
                          justify-start
                          overflow-x-auto
                          rounded-none
                          bg-transparent
                          p-0
                          [scrollbar-width:none]
                        "
                      >
                        {openFiles.map((file) => (
                          <TabsTrigger
                            key={file.id}
                            value={file.id}
                            className="
                                group
                                relative
                                h-9
                                min-w-fit
                                rounded-none
                                border-r
                                border-white/[0.05]
                                px-3
                                text-[11px]
                                text-zinc-500
                                transition-all
                                duration-150

                                hover:bg-white/[0.025]
                                hover:text-zinc-300

                                data-[state=active]:
                                bg-[#09090b]

                                data-[state=active]:
                                text-zinc-200

                                data-[state=active]:
                                shadow-[inset_0_2px_0_0_rgba(244,63,94,0.9)]
                              "
                          >
                            <div
                              className="
                                  flex
                                  items-center
                                  gap-2
                                "
                            >
                              <FileText
                                className="
                                    h-3
                                    w-3
                                    text-zinc-600
                                    group-data-[state=active]:
                                    text-rose-400
                                  "
                              />

                              <span>
                                {file.filename}.{file.fileExtension}
                              </span>

                              {file.hasUnsavedChanges && (
                                <span
                                  className="
                                      h-1.5
                                      w-1.5
                                      rounded-full
                                      bg-amber-400
                                    "
                                />
                              )}

                              <span
                                role="button"
                                tabIndex={0}
                                className="
                                    ml-1
                                    flex
                                    h-5
                                    w-5
                                    cursor-pointer
                                    items-center
                                    justify-center
                                    rounded
                                    opacity-0
                                    transition-all
                                    duration-150

                                    group-hover:
                                    opacity-100

                                    hover:
                                    bg-white/[0.08]

                                    hover:
                                    text-white
                                  "
                                onClick={(event) => {
                                  event.stopPropagation();

                                  closeFile(file.id);
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.stopPropagation();

                                    closeFile(file.id);
                                  }
                                }}
                              >
                                <X
                                  className="
                                      h-3
                                      w-3
                                    "
                                />
                              </span>
                            </div>
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {openFiles.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={closeAllFiles}
                          className="
                            mr-1
                            h-7
                            shrink-0
                            px-2
                            text-[10px]
                            text-zinc-600
                            hover:bg-white/[0.04]
                            hover:text-zinc-300
                          "
                        >
                          Close All
                        </Button>
                      )}
                    </div>
                  </Tabs>
                </div>

                {/* ============================
                    BREADCRUMBS
                ============================ */}

                <div
                  className="
                    flex
                    h-7
                    shrink-0
                    items-center
                    gap-1.5
                    border-b
                    border-white/5
                    bg-[#090a0d]
                    px-3
                    font-mono
                    text-[10px]
                    text-zinc-600
                  "
                >
                  {activeFile?.path
                    ?.split("/")
                    .filter(Boolean)
                    .map((part, index, array) => (
                      <React.Fragment key={`${part}-${index}`}>
                        {index > 0 && (
                          <span
                            className="
                                text-zinc-700
                              "
                          >
                            ›
                          </span>
                        )}

                        <span
                          className={
                            index === array.length - 1
                              ? "text-zinc-300"
                              : "text-zinc-600"
                          }
                        >
                          {part}
                        </span>
                      </React.Fragment>
                    ))}
                </div>

                {/* ============================
                    EDITOR + PREVIEW
                ============================ */}

                <div
                  className="
                    min-h-0
                    flex-1
                  "
                >
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="h-full"
                  >
                    {/* EDITOR */}

                    <ResizablePanel
                      defaultSize={isPreviewVisible && !focusMode ? 55 : 100}
                      minSize={isPreviewVisible && !focusMode ? 30 : 100}
                    >
                      <div
                        className="
                          h-full
                          bg-[#090a0d]
                        "
                      >
                        <PlaygroundEditor
                          filePath={activeFile?.path}
                          editorOptions={editorSettings}
                          onCursorChange={(line, column) =>
                            setCursor({
                              line,
                              column,
                            })
                          }
                          activeFile={activeFile}
                          content={activeFile?.content || ""}
                          onContentChange={(value) =>
                            activeFileId &&
                            updateFileContent(activeFileId, value)
                          }
                          suggestion={aiSuggestions.suggestion}
                          suggestionLoading={aiSuggestions.isLoading}
                          suggestionPosition={aiSuggestions.position}
                          onAcceptSuggestion={(editor, monaco) =>
                            aiSuggestions.acceptSuggestion(editor, monaco)
                          }
                          onRejectSuggestion={(editor) =>
                            aiSuggestions.rejectSuggestion(editor)
                          }
                          onTriggerSuggestion={(type, editor) =>
                            aiSuggestions.fetchSuggestion(type, editor)
                          }
                        />
                      </div>
                    </ResizablePanel>

                    {/* PREVIEW */}

                    {isPreviewVisible && !focusMode && (
                      <>
                        <ResizableHandle
                          className="
                              relative
                              w-px
                              bg-white/[0.06]
                              transition-all
                              duration-150

                              hover:
                              w-[2px]

                              hover:
                              bg-rose-500/50

                              data-[resize-handle-active]:
                              bg-rose-500
                            "
                        />

                        <ResizablePanel defaultSize={45} minSize={25}>
                          <WebContainerPreview
                            templateData={templateData}
                            instance={instance}
                            writeFileSync={writeFileSync}
                            isLoading={containerLoading}
                            error={containerError}
                            serverUrl={serverUrl}
                            forceResetup={false}
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </div>

                {/* ============================
                    STATUS BAR
                ============================ */}

                <footer
                  className="
                    relative
                    flex
                    h-6
                    shrink-0
                    items-center
                    gap-4
                    overflow-hidden
                    border-t
                    border-white/[0.06]
                    bg-[#0d0f13]
                    px-3
                    text-[9px]
                    text-zinc-500
                  "
                >
                  {/* Left accent */}

                  <span
                    className="
                      absolute
                      left-0
                      top-0
                      h-full
                      w-[2px]
                      bg-rose-500
                    "
                  />

                  {/* Branch */}

                  <span
                    className="
                      flex
                      items-center
                      gap-1.5
                      text-zinc-300
                    "
                  >
                    <Circle
                      className={`
                        h-1.5
                        w-1.5
                        fill-current
                        stroke-0

                        ${
                          hasUnsavedChanges ? "text-amber-400" : "text-zinc-500"
                        }
                      `}
                    />
                    main
                    {hasUnsavedChanges ? "*" : ""}
                  </span>

                  {/* runtime */}

                  <span
                    className="
                      hidden
                      items-center
                      gap-1.5
                      lg:flex
                    "
                  >
                    <span
                      className={`
                        h-1.5
                        w-1.5
                        rounded-full
                        ${runtimeDot}
                      `}
                    />

                    {runtimeStatus}
                  </span>

                  {/* RIGHT SIDE */}

                  <span
                    className="
                      ml-auto
                      capitalize
                      text-zinc-400
                    "
                  >
                    {activeFile
                      ? getEditorLanguage(activeFile.fileExtension)
                      : "Plain Text"}
                  </span>

                  <span>
                    Ln {cursor.line}, Col {cursor.column}
                  </span>

                  <span
                    className="
                      hidden
                      md:inline
                    "
                  >
                    Spaces: {editorSettings.tabSize}
                  </span>

                  <span
                    className="
                      hidden
                      lg:inline
                    "
                  >
                    UTF-8
                  </span>

                  <span
                    className="
                      hidden
                      xl:inline
                    "
                  >
                    Node 20
                  </span>
                </footer>
              </div>
            ) : (
              /* ============================
                  NO FILE OPEN
              ============================ */

              <div
                className="
                  relative
                  flex
                  h-full
                  flex-col
                  items-center
                  justify-center
                  gap-4
                  overflow-hidden
                  text-zinc-600
                "
              >
                {/* Background glow */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    h-72
                    w-72
                    rounded-full
                    bg-rose-500/[0.04]
                    blur-[100px]
                  "
                />

                <div
                  className="
                    relative
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-white/[0.06]
                    bg-white/[0.025]
                  "
                >
                  <FileText
                    className="
                      h-7
                      w-7
                      text-zinc-700
                    "
                  />
                </div>

                <div
                  className="
                    relative
                    text-center
                  "
                >
                  <p
                    className="
                      text-sm
                      font-medium
                      text-zinc-400
                    "
                  >
                    No files open
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-zinc-600
                    "
                  >
                    Select a file from the explorer to start editing.
                  </p>
                </div>

                <div
                  className="
                    relative
                    mt-2
                    flex
                    items-center
                    gap-2
                    font-mono
                    text-[10px]
                    text-zinc-700
                  "
                >
                  <kbd
                    className="
                      rounded
                      border
                      border-white/[0.06]
                      bg-white/[0.025]
                      px-2
                      py-1
                    "
                  >
                    Ctrl P
                  </kbd>
                  Quick Open
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </div>
    </TooltipProvider>
  );
};

export default MainPlaygroundPage;
