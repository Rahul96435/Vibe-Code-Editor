import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Command, Container, Cpu, TerminalSquare } from "lucide-react";

const frameworks = [["React", "/react.svg"], ["Next.js", "/nextjs-icon.svg"], ["Vue", "/vuejs-icon.svg"], ["Angular", "/angular-2.svg"], ["Express", "/expressjs-icon.svg"], ["Hono", "/hono.svg"]];
const features = [[Cpu,"Monaco intelligence","Fast editing, diagnostics, multi-file tabs, and AI-assisted suggestions."],[Container,"Isolated runtime","Install dependencies and run servers directly in the browser."],[TerminalSquare,"Developer workflow","Integrated terminal, live preview, device modes, and runtime status."],[Command,"Keyboard first","Command palette and quick file open keep the workspace moving."],[Check,"Six templates","React, Next.js, Vue, Angular, Express, and Hono are ready to start."],[ArrowRight,"Understandable code","Focused components extend the existing architecture without replacing it."]] as const;

export default function Home() {
  return (
    <div className="landing-grid bg-background text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl flex-col items-center px-4 pt-16 text-center sm:pt-20">
        <p className="mb-5 border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-700 dark:text-red-300">BROWSER IDE · ZERO LOCAL SETUP</p>
        <h1 className="max-w-4xl text-5xl font-bold leading-[1.06] sm:text-7xl">VibeCode Editor</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Build, run, and preview complete web projects in one focused workspace. Your files, editor, terminal, and live server stay together.</p>
        <div className="mt-7 flex gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-sm bg-[#e23d57] px-5 py-3 text-sm font-semibold text-white hover:bg-[#f04b64]">Start coding <ArrowRight size={15} /></Link>
          <Link href="/docs" className="rounded-sm border border-border px-5 py-3 text-sm hover:bg-muted">Read docs</Link>
        </div>

        <div className="mt-12 w-full overflow-hidden rounded-md border border-border bg-card text-left shadow-2xl shadow-black/10 dark:shadow-black/50">
          <div className="flex h-10 items-center border-b border-border bg-muted/50 px-3 text-[11px] text-muted-foreground">
            <span className="text-red-500">●</span><span className="ml-3 text-foreground">vibecode / app</span>
            <span className="mx-auto hidden rounded-sm border border-border bg-background px-16 py-1 sm:block">Search commands or files</span><span>Run ▶</span>
          </div>
          <div className="grid h-[380px] grid-cols-[42px_180px_1fr] sm:grid-cols-[42px_220px_1fr_34%]">
            <div className="border-r border-border py-3 text-center text-muted-foreground"><div className="border-l-2 border-red-500 py-3 text-foreground">□</div><div className="py-3">⌕</div><div className="py-3">▷</div></div>
            <div className="border-r border-border bg-muted/30 p-3 text-xs text-muted-foreground"><p className="mb-4 text-[10px] font-bold text-foreground/80">EXPLORER</p><p>⌄ src</p><p className="py-1 pl-4 text-red-600 dark:text-red-300">◇ App.tsx</p><p className="py-1 pl-4"># styles.css</p><p className="py-1">{} package.json</p></div>
            <div className="min-w-0 bg-background font-mono text-xs"><div className="border-b border-border px-4 py-3 text-foreground">App.tsx <span className="text-red-500">●</span></div><pre className="overflow-hidden p-5 leading-7 text-muted-foreground"><span className="text-pink-600 dark:text-pink-400">export default function</span> <span className="text-amber-700 dark:text-amber-200">App</span>() {`{`}\n  <span className="text-pink-600 dark:text-pink-400">return</span> (\n    &lt;<span className="text-red-600 dark:text-red-300">Workspace</span> status=<span className="text-emerald-700 dark:text-emerald-300">&quot;ready&quot;</span> /&gt;\n  )\n{`}`}</pre></div>
            <div className="hidden border-l border-border bg-white sm:block"><div className="h-9 bg-zinc-100 px-3 py-2 text-[10px] text-zinc-600 dark:bg-[#16181d] dark:text-zinc-400">● Ready · localhost:3000</div><div className="flex h-[calc(100%-2.25rem)] items-center justify-center bg-zinc-50 text-zinc-900"><div className="text-center"><Image src="/logo.svg" alt="VibeCode preview" width={64} height={64} className="mx-auto" /><strong>Ship the idea.</strong><p className="mt-2 text-xs text-zinc-500">Your preview is live.</p></div></div></div>
          </div>
          <div className="flex h-6 items-center bg-[#c9344c] px-3 text-[10px] text-white">main* <span className="ml-auto">TypeScript · Ln 8, Col 14 · Node 20 · ● Ready</span></div>
        </div>
      </section>

      <section id="templates" className="border-y border-border bg-muted/40 px-4 py-14">
        <p className="text-center text-xs text-muted-foreground">START WITH THE STACK YOU KNOW</p>
        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-3 gap-px border border-border bg-border sm:grid-cols-6">{frameworks.map(([name, src]) => <div key={name} className="flex items-center justify-center gap-2 bg-card px-4 py-5 text-xs"><Image src={src} alt="" width={22} height={22} />{name}</div>)}</div>
      </section>
      <section id="features" className="mx-auto max-w-7xl px-6 py-24"><div className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">{features.map(([Icon,title,copy]) => <article key={title} className="bg-card p-7"><Icon size={20} className="text-red-500"/><h2 className="mt-5 text-sm font-semibold">{title}</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">{copy}</p></article>)}</div></section>
      <section className="border-t border-border px-6 py-24 text-center"><h2 className="text-3xl font-bold">Ready to build?</h2><p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">Launch a complete development workspace directly in your browser.</p><div className="mt-7 flex justify-center gap-3"><Link href="/dashboard" className="bg-[#e23d57] px-5 py-3 text-sm font-semibold text-white">Start coding</Link><Link href="https://github.com/Rahul96435/Vibe-Code-Editor" className="border border-border px-5 py-3 text-sm hover:bg-muted">View GitHub</Link></div></section>
    </div>
  );
}
