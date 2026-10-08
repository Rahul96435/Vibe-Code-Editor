"use server";

import { db } from "@/lib/db";

import { currentUser } from "@/modules/auth/actions";

import type {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";

import JSZip from "jszip";

import {
  revalidatePath,
} from "next/cache";

import {
  cache,
} from "react";

/* =====================================================
   EXISTING DASHBOARD ACTIONS
===================================================== */

const loadPlaygroundsForUser =
  cache(async (userId: string) =>
    db.playground.findMany({
      where: {
        userId,
      },

      include: {
        user: true,

        Starmark: {
          where: {
            userId,
          },

          select: {
            isMarked: true,
          },
        },
      },
    }),
  );

export const toggleStarMarked =
  async (
    playgroundId: string,
    isChecked: boolean,
  ) => {
    const user =
      await currentUser();

    const userId =
      user?.id;

    if (!userId) {
      throw new Error(
        "User Id is Required",
      );
    }

    try {
      if (isChecked) {
        await db.starMark.create({
          data: {
            userId,
            playgroundId,
            isMarked:
              isChecked,
          },
        });
      } else {
        await db.starMark.delete({
          where: {
            userId_playgroundId:
              {
                userId,
                playgroundId,
              },
          },
        });
      }

      revalidatePath(
        "/dashboard",
      );

      return {
        success: true,
        isMarked:
          isChecked,
      };
    } catch (error) {
      console.error(
        "Error updating star:",
        error,
      );

      return {
        success: false,
        error:
          "Failed to update star",
      };
    }
  };

export const getAllPlaygroundForUser =
  async () => {
    const user =
      await currentUser();

    if (!user?.id) {
      return [];
    }

    try {
      return await loadPlaygroundsForUser(
        user.id,
      );
    } catch (error) {
      console.error(
        "Failed to load playgrounds:",
        error,
      );

      return [];
    }
  };

export const createPlayground =
  async (data: {
    title: string;

    template:
      | "REACT"
      | "NEXTJS"
      | "EXPRESS"
      | "VUE"
      | "HONO"
      | "ANGULAR";

    description?: string;
  }) => {
    const user =
      await currentUser();

    if (!user?.id) {
      throw new Error(
        "You must be signed in to create a playground",
      );
    }

    const {
      template,
      title,
      description,
    } = data;

    try {
      const playground =
        await db.playground.create({
          data: {
            title,
            description,
            template,
            userId:
              user.id,
          },
        });

      return playground;
    } catch (error) {
      console.error(
        "Failed to create playground:",
        error,
      );

      return null;
    }
  };

export const deleteProjectById =
  async (
    id: string,
  ) => {
    try {
      await db.playground.delete({
        where: {
          id,
        },
      });

      revalidatePath(
        "/dashboard",
      );
    } catch (error) {
      console.error(
        "Failed to delete project:",
        error,
      );
    }
  };

export const editProjectById =
  async (
    id: string,

    data: {
      title: string;
      description: string;
    },
  ) => {
    try {
      await db.playground.update({
        where: {
          id,
        },

        data,
      });

      revalidatePath(
        "/dashboard",
      );
    } catch (error) {
      console.error(
        "Failed to edit project:",
        error,
      );
    }
  };

export const duplicateProjectById =
  async (
    id: string,
  ) => {
    try {
      const originalPlayground =
        await db.playground.findUnique({
          where: {
            id,
          },
        });

      if (!originalPlayground) {
        throw new Error(
          "Original playground not found",
        );
      }

      const duplicatedPlayground =
        await db.playground.create({
          data: {
            title:
              `${originalPlayground.title} (Copy)`,

            description:
              originalPlayground.description,

            template:
              originalPlayground.template,

            userId:
              originalPlayground.userId,
          },
        });

      revalidatePath(
        "/dashboard",
      );

      return duplicatedPlayground;
    } catch (error) {
      console.error(
        "Error duplicating project:",
        error,
      );

      return null;
    }
  };

/* =====================================================
   GITHUB IMPORT
===================================================== */

type SupportedTemplate =
  | "REACT"
  | "NEXTJS"
  | "EXPRESS"
  | "VUE"
  | "HONO"
  | "ANGULAR";

type ImportResult =
  | {
      success: true;
      playgroundId: string;
    }
  | {
      success: false;
      error: string;
    };

/*
 * We intentionally support source/config files only.
 *
 * This keeps the existing TemplateFolder model unchanged
 * and avoids touching the stable WebContainer runtime.
 */
const TEXT_EXTENSIONS =
  new Set([
    "js",
    "jsx",
    "ts",
    "tsx",
    "mjs",
    "cjs",
    "mts",
    "cts",

    "json",

    "html",
    "htm",

    "css",
    "scss",
    "sass",
    "less",

    "vue",

    "md",
    "mdx",
    "txt",

    "yaml",
    "yml",
    "toml",

    "xml",
    "svg",

    "prisma",

    "sh",
    "bash",
  ]);

const SAFE_EXTENSIONLESS_FILES =
  new Set([
    "Dockerfile",
    "LICENSE",
    "README",
    "Makefile",
    ".gitignore",
    ".nvmrc",
    ".prettierrc",
    ".eslintrc",
  ]);

const IGNORED_FOLDERS =
  new Set([
    "node_modules",
    ".git",
    ".next",
    ".turbo",
    ".cache",

    "dist",
    "build",
    "out",
    "coverage",

    ".idea",
    ".vscode",
  ]);

/*
 * MongoDB documents have a size limit.
 *
 * Keeping project source well below it
 * prevents repository import from creating
 * an unusable TemplateFile record.
 */
const MAX_ARCHIVE_BYTES =
  20 * 1024 * 1024;

const MAX_TOTAL_TEXT_BYTES =
  8 * 1024 * 1024;

const MAX_SINGLE_FILE_BYTES =
  1024 * 1024;

const MAX_FILES =
  600;

function parseGithubRepositoryUrl(
  value: string,
):
  | {
      owner: string;
      repo: string;
    }
  | null {
  try {
    const url =
      new URL(value);

    if (
      url.protocol !==
        "https:" ||
      ![
        "github.com",
        "www.github.com",
      ].includes(
        url.hostname,
      )
    ) {
      return null;
    }

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    if (
      parts.length !== 2
    ) {
      return null;
    }

    const owner =
      parts[0];

    const repo =
      parts[1].replace(
        /\.git$/i,
        "",
      );

    if (
      !owner ||
      !repo
    ) {
      return null;
    }

    return {
      owner,
      repo,
    };
  } catch {
    return null;
  }
}

function containsIgnoredFolder(
  filePath: string,
) {
  return filePath
    .split("/")
    .some((part) =>
      IGNORED_FOLDERS.has(
        part,
      ),
    );
}

function looksSensitive(
  filePath: string,
) {
  const filename =
    filePath
      .split("/")
      .at(-1) ?? "";

  return (
    /^\.env(?:\.|$)/i.test(
      filename,
    ) ||
    /^\.npmrc$/i.test(
      filename,
    ) ||
    /^\.yarnrc(?:\.yml)?$/i.test(
      filename,
    ) ||
    /secret|credential|private[_-]?key|access[_-]?token/i.test(
      filename,
    ) ||
    /\.(pem|pfx|p12|crt|cer|key)$/i.test(
      filename,
    )
  );
}

function isSupportedTextFile(
  filePath: string,
) {
  const filename =
    filePath
      .split("/")
      .at(-1) ?? "";

  if (
    SAFE_EXTENSIONLESS_FILES.has(
      filename,
    )
  ) {
    return true;
  }

  const lastDot =
    filename.lastIndexOf(
      ".",
    );

  if (
    lastDot <= 0 ||
    lastDot ===
      filename.length - 1
  ) {
    return false;
  }

  const extension =
    filename
      .slice(
        lastDot + 1,
      )
      .toLowerCase();

  return TEXT_EXTENSIONS.has(
    extension,
  );
}

function createTemplateFile(
  filename: string,
  content: string,
): TemplateFile {
  const lastDot =
    filename.lastIndexOf(
      ".",
    );

  /*
   * Dot files such as .gitignore
   * have no file extension in our tree.
   */
  if (
    lastDot <= 0 ||
    lastDot ===
      filename.length - 1
  ) {
    return {
      filename,
      fileExtension: "",
      content,
    };
  }

  return {
    filename:
      filename.slice(
        0,
        lastDot,
      ),

    fileExtension:
      filename.slice(
        lastDot + 1,
      ),

    content,
  };
}

function insertFileIntoTree(
  root: TemplateFolder,
  filePath: string,
  content: string,
) {
  const parts =
    filePath
      .split("/")
      .filter(Boolean);

  const filename =
    parts.pop();

  if (!filename) {
    return;
  }

  let current =
    root;

  for (
    const folderName
    of parts
  ) {
    let folder =
      current.items.find(
        (item) =>
          "folderName" in item &&
          item.folderName ===
            folderName,
      ) as
        | TemplateFolder
        | undefined;

    if (!folder) {
      folder = {
        folderName,
        items: [],
      };

      current.items.push(
        folder,
      );
    }

    current =
      folder;
  }

  current.items.push(
    createTemplateFile(
      filename,
      content,
    ),
  );
}

function analyzePackageJson(
  packageText: string,
):
  | {
      template:
        SupportedTemplate;

      script:
        string;
    }
  | {
      error: string;
    } {
  try {
    const packageJson =
      JSON.parse(
        packageText,
      ) as {
        scripts?: Record<
          string,
          unknown
        >;

        dependencies?: Record<
          string,
          unknown
        >;

        devDependencies?: Record<
          string,
          unknown
        >;

        workspaces?:
          unknown;
      };

    /*
     * Current WebContainer runner is
     * designed around one package.json.
     *
     * Reject monorepos instead of
     * importing something that cannot
     * reliably start.
     */
    if (
      packageJson.workspaces
    ) {
      return {
        error:
          "Monorepo/workspace repositories are not supported yet.",
      };
    }

    const dependencies = {
      ...(packageJson.dependencies ??
        {}),

      ...(packageJson.devDependencies ??
        {}),
    };

    let template:
      SupportedTemplate |
      null = null;

    if (
      "next" in
      dependencies
    ) {
      template =
        "NEXTJS";
    } else if (
      "@angular/core" in
      dependencies
    ) {
      template =
        "ANGULAR";
    } else if (
      "vue" in
      dependencies
    ) {
      template =
        "VUE";
    } else if (
      "hono" in
        dependencies ||
      "@hono/node-server" in
        dependencies
    ) {
      template =
        "HONO";
    } else if (
      "express" in
      dependencies
    ) {
      template =
        "EXPRESS";
    } else if (
      "react" in
      dependencies
    ) {
      template =
        "REACT";
    }

    if (!template) {
      return {
        error:
          "This repository is not one of the currently supported VibeCode frameworks.",
      };
    }

    const scripts =
      packageJson.scripts ??
      {};

    const runnableScript =
      [
        "dev",
        "start",
        "serve",
        "preview",
      ].find(
        (name) =>
          typeof scripts[
            name
          ] ===
            "string" &&
          String(
            scripts[name],
          ).trim().length >
            0,
      );

    if (!runnableScript) {
      return {
        error:
          'package.json must contain a "dev", "start", "serve", or "preview" script.',
      };
    }

    return {
      template,
      script:
        runnableScript,
    };
  } catch {
    return {
      error:
        "The repository contains an invalid package.json.",
    };
  }
}

export const importGithubRepository =
  async (
    repositoryUrl: string,
  ): Promise<ImportResult> => {
    const user =
      await currentUser();

    if (!user?.id) {
      return {
        success: false,

        error:
          "You must be signed in to import a repository.",
      };
    }

    const parsed =
      parseGithubRepositoryUrl(
        repositoryUrl,
      );

    if (!parsed) {
      return {
        success: false,

        error:
          "Enter a valid public GitHub repository URL such as https://github.com/user/project",
      };
    }

    const {
      owner,
      repo,
    } = parsed;

    try {
      /*
       * GitHub's zipball endpoint uses
       * the repository's default branch,
       * so we do not have to assume
       * "main" or "master".
       *
       * Public repositories work without
       * requiring an API key.
       */
      const response =
        await fetch(
          `https://api.github.com/repos/${encodeURIComponent(
            owner,
          )}/${encodeURIComponent(
            repo,
          )}/zipball`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/vnd.github+json",

              "User-Agent":
                "VibeCode-Repository-Importer",
            },

            redirect:
              "follow",

            cache:
              "no-store",
          },
        );

      if (
        response.status ===
        404
      ) {
        return {
          success: false,

          error:
            "Repository not found. Only public repositories are supported right now.",
        };
      }

      if (
        response.status ===
        403 ||
        response.status ===
          429
      ) {
        return {
          success: false,

          error:
            "GitHub rate limit reached. Please wait and try again.",
        };
      }

      if (!response.ok) {
        return {
          success: false,

          error:
            `GitHub could not download this repository (${response.status}).`,
        };
      }

      const archive =
        await response.arrayBuffer();

      if (
        archive.byteLength >
        MAX_ARCHIVE_BYTES
      ) {
        return {
          success: false,

          error:
            "Repository archive is too large. Maximum supported archive size is 20 MB.",
        };
      }

      const zip =
        await JSZip.loadAsync(
          archive,
        );

      const entries =
        Object.values(
          zip.files,
        );

      /*
       * GitHub wraps a zipball inside
       * one generated root directory.
       */
      const firstFile =
        entries.find(
          (entry) =>
            !entry.dir &&
            entry.name.includes(
              "/",
            ),
        );

      const rootPrefix =
        firstFile
          ? firstFile.name.split(
              "/",
            )[0]
          : "";

      const root:
        TemplateFolder = {
        folderName:
          repo,

        items: [],
      };

      let packageJson:
        string |
        null = null;

      let importedFiles =
        0;

      let totalBytes =
        0;

      for (
        const entry
        of entries
      ) {
        if (entry.dir) {
          continue;
        }

        let relativePath =
          entry.name;

        if (
          rootPrefix &&
          relativePath.startsWith(
            `${rootPrefix}/`,
          )
        ) {
          relativePath =
            relativePath.slice(
              rootPrefix.length +
                1,
            );
        }

        if (
          !relativePath ||
          containsIgnoredFolder(
            relativePath,
          ) ||
          looksSensitive(
            relativePath,
          ) ||
          !isSupportedTextFile(
            relativePath,
          )
        ) {
          continue;
        }

        if (
          importedFiles >=
          MAX_FILES
        ) {
          return {
            success: false,

            error:
              `Repository contains too many source files. Maximum supported files: ${MAX_FILES}.`,
          };
        }

        const content =
          await entry.async(
            "string",
          );

        const fileBytes =
          Buffer.byteLength(
            content,
            "utf8",
          );

        if (
          fileBytes >
          MAX_SINGLE_FILE_BYTES
        ) {
          continue;
        }

        totalBytes +=
          fileBytes;

        if (
          totalBytes >
          MAX_TOTAL_TEXT_BYTES
        ) {
          return {
            success: false,

            error:
              "Repository source is too large for a VibeCode playground.",
          };
        }

        insertFileIntoTree(
          root,
          relativePath,
          content,
        );

        importedFiles++;

        if (
          relativePath ===
          "package.json"
        ) {
          packageJson =
            content;
        }
      }

      if (!packageJson) {
        return {
          success: false,

          error:
            "A root package.json was not found. Only JavaScript/TypeScript web projects are supported right now.",
        };
      }

      const analysis =
        analyzePackageJson(
          packageJson,
        );

      if (
        "error" in
        analysis
      ) {
        return {
          success: false,

          error:
            analysis.error,
        };
      }

      if (
        importedFiles ===
        0
      ) {
        return {
          success: false,

          error:
            "No supported source files were found in this repository.",
        };
      }

      /*
       * Create the playground and its
       * saved file tree together.
       *
       * Existing project loading already
       * prioritizes TemplateFile content,
       * so no runtime architecture change
       * is required.
       */
      const playground =
        await db.playground.create({
          data: {
            title:
              repo,

            description:
              `Imported from https://github.com/${owner}/${repo}`,

            template:
              analysis.template,

            userId:
              user.id,

            templateFiles: {
              create: {
                /*
                 * Keep exactly the same
                 * serialized format used by
                 * SaveUpdatedCode.
                 */
                content:
                  JSON.stringify(
                    root,
                  ),
              },
            },
          },
        });

      revalidatePath(
        "/dashboard",
      );

      return {
        success: true,

        playgroundId:
          playground.id,
      };
    } catch (error) {
      console.error(
        "GitHub repository import failed:",
        error,
      );

      return {
        success: false,

        error:
          "Repository import failed. No project was created.",
      };
    }
  };