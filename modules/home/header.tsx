import Link from "next/link";
import Image from "next/image";
import { FaGithub } from "react-icons/fa";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import UserButton from "../auth/components/user-button";

export function Header() {
  return <header className="sticky top-0 z-50 border-b border-border bg-background/90 text-foreground backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
    <Link href="/" className="mr-8 flex items-center gap-2"><Image src="/logo.svg" alt="VibeCode" width={32} height={32} /><strong className="text-sm">VibeCode</strong></Link>
    <nav className="hidden items-center gap-6 text-xs text-muted-foreground sm:flex"><Link href="/#features" className="hover:text-foreground">Features</Link><Link href="/#templates" className="hover:text-foreground">Templates</Link><Link href="/docs" className="hover:text-foreground">Docs</Link><Link className="flex items-center gap-1.5 hover:text-foreground" href="https://github.com/Rahul96435/Vibe-Code-Editor" target="_blank"><FaGithub size={14} />GitHub</Link></nav>
    <div className="ml-auto flex items-center gap-2"><ThemeToggle /><UserButton /></div>
  </div></header>;
}
