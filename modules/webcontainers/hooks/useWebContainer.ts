import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { WebContainer } from "@webcontainer/api";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import { getRuntime } from "../lib/runtime";
import { transformToWebContainerFormat } from "./transformer";

type WorkspaceEntry = {
  workspaceId: string;
  promise: Promise<WebContainer>;
};

let currentWorkspace: WorkspaceEntry | null = null;
let owners = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

async function teardownEntry(entry: WorkspaceEntry) {
  try {
    const instance = await entry.promise;
    getRuntime(instance).dispose();
    await instance.teardown();
  } catch {
    // Container may already be gone.
  }
}

function acquire(workspaceId: string): Promise<WebContainer> {
  clearTimeout(releaseTimer);
  owners++;

  if (
    currentWorkspace &&
    currentWorkspace.workspaceId === workspaceId
  ) {
    return currentWorkspace.promise;
  }

  const previous = currentWorkspace;

  const promise = (async () => {
    if (previous) {
      await teardownEntry(previous);
    }

    return WebContainer.boot();
  })();

  const entry: WorkspaceEntry = {
    workspaceId,
    promise,
  };

  currentWorkspace = entry;

  void promise.catch(() => {
    if (currentWorkspace === entry) {
      currentWorkspace = null;
    }
  });

  return promise;
}

function release(workspaceId: string) {
  owners = Math.max(0, owners - 1);
  clearTimeout(releaseTimer);

  releaseTimer = setTimeout(() => {
    if (owners !== 0) return;

    const entry = currentWorkspace;

    if (!entry || entry.workspaceId !== workspaceId) {
      return;
    }

    currentWorkspace = null;
    void teardownEntry(entry);
  }, 150);
}

export const useWebContainer = ({
  templateData,
  workspaceId,
}: {
  templateData: TemplateFolder | null;
  workspaceId: string;
}) => {
  const [instance, setInstance] =
    useState<WebContainer | null>(null);

  const [serverUrl, setServerUrl] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setInstance(null);
    setServerUrl(null);
    setError(null);
    setIsLoading(true);

    const timer = setTimeout(() => {
      if (!active) return;

      setError(
        "Browser runtime initialization timed out. Reload the workspace and check browser isolation/network access.",
      );

      setIsLoading(false);
    }, 45000);

    void acquire(workspaceId)
      .then((container) => {
        if (!active) return;
        setInstance(container);
        setError(null);
        setIsLoading(false);
      })
      .catch((reason) => {
        if (!active) return;

        setError(
          reason instanceof Error
            ? reason.message
            : "Browser runtime unavailable.",
        );

        setIsLoading(false);
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      active = false;
      clearTimeout(timer);
      release(workspaceId);
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!instance) {
      setServerUrl(null);
      return;
    }

    const runtime = getRuntime(instance);

    const syncUrl = () => {
      setServerUrl(runtime.getSnapshot().url || null);
    };

    syncUrl();
    return runtime.subscribe(syncUrl);
  }, [instance]);

  useEffect(() => {
    if (!instance || !templateData) return;

    void getRuntime(instance).sync(
      transformToWebContainerFormat(templateData),
    );
  }, [instance, templateData]);

  const writeFileSync = useCallback(
    async (filePath: string, content: string) => {
      if (!instance) return;

      if (filePath.includes("/")) {
        await instance.fs.mkdir(
          filePath.slice(0, filePath.lastIndexOf("/")),
          { recursive: true },
        );
      }

      await instance.fs.writeFile(filePath, content);
    },
    [instance],
  );

  const destroy = useCallback(() => {
    if (!instance) return;
    getRuntime(instance).stop();
  }, [instance]);

  return {
    serverUrl,
    isLoading,
    error,
    instance,
    writeFileSync,
    destroy,
  };
};
