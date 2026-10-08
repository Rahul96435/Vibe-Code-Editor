"use client";

import { useEffect, useState } from "react";
import { FileCode2, Focus, Monitor, Play, Settings, TerminalSquare } from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TemplateFile } from "../lib/path-to-json";

export interface EditorSettings { fontSize: number; wordWrap: "on" | "off"; minimap: boolean; tabSize: number; autoSave: boolean; }
export const defaultIdeSettings: EditorSettings = { fontSize: 14, wordWrap: "off", minimap: true, tabSize: 2, autoSave: false };

interface Props {
  files: TemplateFile[];
  onOpenFile: (file: TemplateFile) => void;
  onRun: () => void;
  onTogglePreview: () => void;
  onToggleTerminal: () => void;
  onFocus: () => void;
  settings: EditorSettings;
  onSettings: (settings: EditorSettings) => void;
}

export function IdeCommandCenter(props: Props) {
  const [palette, setPalette] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { setTheme } = useTheme();
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === "p") { event.preventDefault(); setPalette(true); }
      else if (!event.shiftKey && event.key.toLowerCase() === "p") { event.preventDefault(); setQuickOpen(true); }
      else if (!event.shiftKey && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  const run = (action: () => void) => { setPalette(false); action(); };
  return <>
    <button className="ide-search" onClick={() => setPalette(true)} aria-label="Open command palette">Search commands or files <kbd>Ctrl K</kbd></button>
    <CommandDialog open={palette} onOpenChange={setPalette} title="Command palette">
      <CommandInput placeholder="Type a command..." />
      <CommandList><CommandEmpty>No matching command.</CommandEmpty><CommandGroup heading="Workspace">
        <CommandItem onSelect={() => run(() => setQuickOpen(true))}><FileCode2 />Open file<CommandShortcut>Ctrl P</CommandShortcut></CommandItem>
        <CommandItem onSelect={() => run(props.onRun)}><Play />Run or restart project</CommandItem>
        <CommandItem onSelect={() => run(props.onTogglePreview)}><Monitor />Toggle preview</CommandItem>
        <CommandItem onSelect={() => run(props.onToggleTerminal)}><TerminalSquare />Toggle terminal<CommandShortcut>Ctrl J</CommandShortcut></CommandItem>
        <CommandItem onSelect={() => run(props.onFocus)}><Focus />Focus mode</CommandItem>
        <CommandItem onSelect={() => run(() => setSettingsOpen(true))}><Settings />Settings</CommandItem>
      </CommandGroup><CommandGroup heading="Appearance">
        <CommandItem onSelect={() => run(() => setTheme("dark"))}>VibeCode Dark</CommandItem>
        <CommandItem onSelect={() => run(() => setTheme("light"))}>Light</CommandItem>
      </CommandGroup></CommandList>
    </CommandDialog>
    <CommandDialog open={quickOpen} onOpenChange={setQuickOpen} title="Quick open">
      <CommandInput placeholder="Search files..." />
      <CommandList><CommandEmpty>No files found.</CommandEmpty><CommandGroup heading="Files">{props.files.map(file => <CommandItem key={file.path} value={file.path} onSelect={() => { props.onOpenFile(file); setQuickOpen(false); }}><FileCode2 /><span>{file.path}</span></CommandItem>)}</CommandGroup></CommandList>
    </CommandDialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Workspace settings</DialogTitle><DialogDescription>Stored locally in this browser.</DialogDescription></DialogHeader>
      <div className="grid gap-5">
        <div className="grid grid-cols-2 items-center gap-3"><Label htmlFor="font-size">Editor font size</Label><Input id="font-size" type="number" min={10} max={24} value={props.settings.fontSize} onChange={event => props.onSettings({ ...props.settings, fontSize: Number(event.target.value) })} /></div>
        <div className="grid grid-cols-2 items-center gap-3"><Label htmlFor="tab-size">Tab size</Label><Input id="tab-size" type="number" min={2} max={8} value={props.settings.tabSize} onChange={event => props.onSettings({ ...props.settings, tabSize: Number(event.target.value) })} /></div>
      {(
        [
          [
            "Word wrap",
            "word-wrap",
            props.settings.wordWrap === "on",
            (value: boolean) =>
              props.onSettings({
                ...props.settings,
                wordWrap: value ? "on" : "off",
              }),
          ],
          [
            "Minimap",
            "minimap",
            props.settings.minimap,
            (value: boolean) =>
              props.onSettings({
                ...props.settings,
                minimap: value,
              }),
          ],
          [
            "Auto save",
            "auto-save",
            props.settings.autoSave,
            (value: boolean) =>
              props.onSettings({
                ...props.settings,
                autoSave: value,
              }),
          ],
        ] as const
      ).map(([label, id, checked, change]) => (
        <div
          key={id}
          className="flex items-center justify-between"
        >
          <Label htmlFor={id}>{label}</Label>

          <Switch
            id={id}
            checked={checked}
            onCheckedChange={change}
          />
        </div>
      ))}
      </div></DialogContent></Dialog>
  </>;
}
