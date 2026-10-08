"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { ArrowDown, GitBranch, LoaderCircle } from "lucide-react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useState } from "react";

import { toast } from "sonner";

import { importGithubRepository } from "../actions";

const AddRepo = () => {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");

  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    const value = repoUrl.trim();

    if (!value) {
      toast.error("Enter a GitHub repository URL");

      return;
    }

    if (isImporting) {
      return;
    }

    try {
      setIsImporting(true);

      const result = await importGithubRepository(value);

      if (!result.success) {
        toast.error(result.error);

        return;
      }

      toast.success("Repository imported successfully");

      setRepoUrl("");
      setOpen(false);

      router.push(`/playground/${result.playgroundId}`);
    } catch (error) {
      console.error("Repository import failed:", error);

      toast.error("Unable to import repository");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isImporting && !nextOpen) {
          return;
        }

        setOpen(nextOpen);

        if (!nextOpen) {
          setRepoUrl("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="
            group
            flex
            w-full
            cursor-pointer
            flex-row
            items-center
            justify-between
            rounded-lg
            border
            bg-muted
            px-6
            py-6
            text-left

            shadow-[0_2px_10px_rgba(0,0,0,0.08)]

            transition-all
            duration-300
            ease-in-out

            hover:scale-[1.02]
            hover:border-[#E93F3F]
            hover:bg-background

            hover:shadow-[0_10px_30px_rgba(233,63,63,0.15)]
          "
        >
          <div
            className="
              flex
              flex-row
              items-start
              justify-center
              gap-4
            "
          >
            <span
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-md
                border
                bg-white
                text-black

                transition-colors
                duration-300

                group-hover:border-[#E93F3F]
                group-hover:bg-[#fff8f8]
                group-hover:text-[#E93F3F]
              "
            >
              <ArrowDown
                size={20}
                className="
                  transition-transform
                  duration-300

                  group-hover:translate-y-1
                "
              />
            </span>

            <div
              className="
                flex
                flex-col
              "
            >
              <h1
                className="
                  text-xl
                  font-bold
                  text-[#e93f3f]
                "
              >
                Open Github Repository
              </h1>

              <p
                className="
                  max-w-[220px]
                  text-sm
                  text-muted-foreground
                "
              >
                Work with your repositories in our editor
              </p>
            </div>
          </div>

          <div
            className="
              relative
              overflow-hidden
            "
          >
            <Image
              src="/github.svg"
              alt="Open GitHub repository"
              width={150}
              height={150}
              style={{
                width: "150px",
                height: "auto",
              }}
              className="
                transition-transform
                duration-300

                group-hover:scale-110
              "
            />
          </div>
        </button>
      </DialogTrigger>

      <DialogContent
        className="
          border-white/10
          bg-[#111318]
          sm:max-w-[480px]
        "
      >
        <DialogHeader>
          <div
            className="
              mb-1
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-lg
                bg-white
                text-black
              "
            >
              <GitBranch size={22} />
            </div>

            <DialogTitle>Import GitHub Repository</DialogTitle>
          </div>

          <DialogDescription>
            Paste a public GitHub repository URL. VibeCode will import its
            source files and open it as a new playground.
          </DialogDescription>
        </DialogHeader>

        <div
          className="
            py-2
          "
        >
          <label
            htmlFor="github-repository-url"
            className="
              mb-2
              block
              text-sm
              font-medium
            "
          >
            Repository URL
          </label>

          <input
            id="github-repository-url"
            type="url"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={repoUrl}
            disabled={isImporting}
            placeholder="https://github.com/username/project"
            onChange={(event) => setRepoUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isImporting) {
                event.preventDefault();

                void handleImport();
              }
            }}
            className="
              h-11
              w-full
              rounded-md
              border
              border-white/10
              bg-black/30
              px-3
              text-sm
              text-white
              outline-none

              transition

              placeholder:text-zinc-600

              focus:border-[#e93f3f]/70
              focus:ring-2
              focus:ring-[#e93f3f]/10

              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          />

          <p
            className="
              mt-2
              text-xs
              leading-5
              text-muted-foreground
            "
          >
            Supports public single-package React, Next.js, Vue, Angular, Express
            and Hono repositories.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isImporting}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isImporting || !repoUrl.trim()}
            onClick={() => void handleImport()}
            className="
              bg-[#e93f3f]
              text-white

              hover:bg-[#d93636]
            "
          >
            {isImporting ? (
              <>
                <LoaderCircle
                  className="
                    mr-2
                    h-4
                    w-4
                    animate-spin
                  "
                />
                Importing...
              </>
            ) : (
              <>
                <GitBranch
                  className="
                    mr-2
                    h-4
                    w-4
                  "
                />
                Import Repository
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRepo;
