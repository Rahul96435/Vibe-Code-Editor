import type { WebContainer, WebContainerProcess, FileSystemTree } from "@webcontainer/api";

export type RuntimeStage = "idle" | "mounting" | "installing" | "starting" | "ready" | "stopped" | "error";
export interface RuntimeState {
  stage: RuntimeStage;
  url: string;
  command: string;
  error: string | null;
  timings: Record<string, number>;
}

export function selectScript(packageText: string): string {
  let manifest: { scripts?: Record<string, unknown> };
  try { manifest = JSON.parse(packageText); }
  catch { throw new Error("package.json is not valid JSON. Correct it and retry."); }
  const scripts = manifest?.scripts ?? {};
  const script = ["dev", "start", "serve", "preview"].find(name => typeof scripts[name] === "string" && String(scripts[name]).trim());
  if (!script) throw new Error(`No runnable script in package.json. Add dev, start, serve, or preview. Detected: ${Object.keys(scripts).join(", ") || "none"}.`);
  return script;
}

function flatten(tree: FileSystemTree, prefix = ""): Map<string, string> {
  const files = new Map<string, string>();
  for (const [name, entry] of Object.entries(tree)) {
    if (!name || name === "." || name === ".." || /[\\/]/.test(name)) throw new Error("Invalid project file name.");
    const path = prefix + name;
    if ("directory" in entry) for (const [key, value] of flatten(entry.directory, path + "/")) files.set(key, value);
    else if ("file" in entry && "contents" in entry.file) files.set(path, typeof entry.file.contents === "string" ? entry.file.contents : new TextDecoder().decode(entry.file.contents));
  }
  return files;
}

export function dependencyFingerprint(files: Map<string, string>): string {
  return JSON.stringify(["package.json", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"].map(name => [name, files.get(name) ?? null]));
}

// The workspace owns this session; hiding Preview does not stop its processes.
export class RuntimeSession {
  state: RuntimeState = { stage: "idle", url: "", command: "", error: null, timings: {} };
  private listeners = new Set<() => void>();
  private logListeners = new Set<(chunk: string) => void>();
  private output = "";
  private mounted = false;
  private files = new Map<string, string>();
  private installed = "";
  private process: WebContainerProcess | null = null;
  private generation = 0;
  private unsubscribeReady?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private container: WebContainer;
  private limits: { install: number; start: number; mount: number };
  constructor(container: WebContainer, limits = { install: 240000, start: 120000, mount: 30000 }) {
    this.container = container;
    this.limits = limits;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  subscribeOutput(listener: (chunk: string) => void) {
    listener(this.output);
    this.logListeners.add(listener);
    return () => { this.logListeners.delete(listener); };
  }
  private log(chunk: string) {
    this.output = (this.output + chunk).slice(-200000);
    this.logListeners.forEach(listener => listener(chunk));
  }
  private update(patch: Partial<RuntimeState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private cleanup() {
    clearTimeout(this.timer);
    this.unsubscribeReady?.();
    this.unsubscribeReady = undefined;
    this.process?.kill();
    this.process = null;
  }
  stop = () => {
    this.generation++;
    this.cleanup();
    this.update({ stage: "stopped", url: "", error: null });
    this.log("\r\nServer stopped.\r\n");
  };
  dispose() { this.disposed = true; this.stop(); this.listeners.clear(); this.logListeners.clear(); }
  private fail(error: unknown, generation: number) {
    if (generation !== this.generation || this.disposed) return;
    this.generation++;
    this.cleanup();
    const message = error instanceof Error ? error.message : String(error);
    this.update({ stage: "error", error: message, url: "" });
    this.log(`\r\nError: ${message}\r\n`);
  }
  private async timed<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]);
    } finally { clearTimeout(timer); }
  }
  private pipe(process: WebContainerProcess) {
    void process.output.pipeTo(new WritableStream({ write: chunk => this.log(chunk) })).catch(() => {});
  }
  private logMountedEntry(files: Map<string, string>) {
    if (process.env.NODE_ENV !== "development") return;
    const path = ["src/index.ts", "src/index.tsx", "src/App.tsx", "app/page.tsx", "src/App.vue", "src/main.ts", "index.js", "pages/index.html"].find(candidate => files.has(candidate));
    if (path) this.log(`\r\n[preview debug] mounted ${path}\r\n${files.get(path)}\r\n`);
  }
  sync(tree: FileSystemTree, restart = false): Promise<void> {
    this.queue = this.queue.then(async () => {
      if (this.disposed) return;
      let generation = this.generation;
      const current = () => generation === this.generation && !this.disposed;
      try {
        const files = flatten(tree);
        this.logMountedEntry(files);
        const fingerprint = dependencyFingerprint(files);
        const script = selectScript(files.get("package.json") ?? "{}");
        const changedDependencies = fingerprint !== this.installed;
        const shouldStart = restart || this.state.stage === "idle" || (changedDependencies && ["ready", "starting"].includes(this.state.stage));
        if (shouldStart) { generation = ++this.generation; this.cleanup(); }
        const mountStarted = performance.now();
        if (!this.mounted) {
          this.update({ stage: "mounting", error: null });
          await this.timed(this.container.mount(tree), this.limits.mount, "Mounting files timed out. Reload the workspace and retry.");
          if (!current()) return;
          this.mounted = true;
        } else {
          for (const path of this.files.keys()) if (!files.has(path)) await this.container.fs.rm(path, { force: true });
          for (const [path, content] of files) if (this.files.get(path) !== content) {
            if (path.includes("/")) await this.container.fs.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
            await this.container.fs.writeFile(path, content);
          }
        }
        if (!current()) return;
        this.files = files;
        this.update({ timings: { ...this.state.timings, mounting: performance.now() - mountStarted } });
        if (!shouldStart) return;
        this.update({ url: "", error: null, command: `npm run ${script}` });
        // Reuse successful installs until the project's package metadata changes.
        if (changedDependencies) {
          const started = performance.now();
          this.update({ stage: "installing" });
          this.log("\r\n$ npm install --no-audit --no-fund\r\n");
          const install = await this.timed(this.container.spawn("npm", ["install", "--no-audit", "--no-fund"]), this.limits.mount, "Could not launch npm.");
          if (!current()) { install.kill(); return; }
          this.process = install;
          this.pipe(install);
          const exit = await this.timed(install.exit, this.limits.install, "Dependency installation timed out. Check network access and retry.");
          if (!current()) return;
          this.process = null;
          if (exit !== 0) throw new Error(`Dependency installation failed (exit ${exit}). Check the terminal, fix package.json, and retry.`);
          this.installed = fingerprint;
          this.update({ timings: { ...this.state.timings, installing: performance.now() - started } });
        } else this.log("\r\nDependencies unchanged; reusing installed packages.\r\n");
        this.update({ stage: "starting" });
        const started = performance.now();
        // Subscribe before spawn so fast servers cannot race the listener.
        this.unsubscribeReady = this.container.on("server-ready", (_port, url) => {
          if (!current() || !/^https?:\/\//.test(url)) return;
          clearTimeout(this.timer);
          this.update({ stage: "ready", url, timings: { ...this.state.timings, starting: performance.now() - started } });
        });
        this.timer = setTimeout(() => this.fail(new Error("Server startup timed out. Check terminal output and ensure the server listens on 0.0.0.0."), generation), this.limits.start);
        this.log(`\r\n$ npm run ${script}\r\n`);
        const server = await this.timed(this.container.spawn("npm", ["run", script]), this.limits.mount, "Could not launch the development server.");
        if (!current()) { server.kill(); return; }
        this.process = server;
        this.pipe(server);
        void server.exit.then(code => this.fail(new Error(`Development server exited (code ${code}). Check the terminal, correct the project, and retry.`), generation), error => this.fail(error, generation));
      } catch (error) { this.fail(error, generation); }
    });
    return this.queue;
  }
}

const sessions = new WeakMap<WebContainer, RuntimeSession>();
export function getRuntime(container: WebContainer) {
  let session = sessions.get(container);
  if (!session) { session = new RuntimeSession(container); sessions.set(container, session); }
  return session;
}
