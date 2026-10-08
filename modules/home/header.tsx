import Link from "next/link";
import Image from "next/image";
import { FaGithub } from "react-icons/fa";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import UserButton from "../auth/components/user-button";

export function Header() {
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
    <Link href="/" className="mr-8 flex items-center gap-2"><Image src="/logo.svg" alt="VibeCode" width={32} height={32} /><strong className="text-sm text-white">VibeCode</strong></Link>
    <nav className="hidden items-center gap-6 text-xs text-zinc-400 sm:flex"><Link href="/#features">Features</Link><Link href="/#templates">Templates</Link><Link href="/docs">Docs</Link><Link className="flex items-center gap-1.5" href="https://github.com/BRaj-05/Code-Editor" target="_blank"><FaGithub size={14} />GitHub</Link></nav>
    <div className="ml-auto flex items-center gap-2"><ThemeToggle /><UserButton /></div>
  </div></header>;
}
