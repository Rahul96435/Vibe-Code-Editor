import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";
import type { TemplateFolder } from "../lib/path-to-json";
import {
  getPlaygroundById,
  SaveUpdatedCode,
} from "../actions";

interface PlaygroundData {
  id?: string;
  title?: string;
  [key: string]: any;
}

interface UsePlaygroundReturn {
  playgroundData: PlaygroundData | null;
  templateData: TemplateFolder | null;
  isLoading: boolean;
  error: string | null;
  loadPlayground: () => Promise<void>;
  saveTemplateData: (data: TemplateFolder) => Promise<void>;
}

export const usePlayground = (
  id: string,
): UsePlaygroundReturn => {
  const [playgroundData, setPlaygroundData] =
    useState<PlaygroundData | null>(null);

  const [templateData, setTemplateData] =
    useState<TemplateFolder | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const loadPlayground = useCallback(async () => {
    if (!id) return;

    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    const isCurrentRequest = () => loadRequestRef.current === requestId;

    try {
      setIsLoading(true);
      setError(null);
      setTemplateData(null);
      setPlaygroundData(null);

      const data = await getPlaygroundById(id);

      if (!isCurrentRequest()) {
        return;
      }

      if (!data) {
        throw new Error(
          "Playground not found. It may have been deleted.",
        );
      }

      setPlaygroundData(data);

      const rawContent = data?.templateFiles?.[0]?.content;

      if (rawContent) {
        const parsedContent =
          typeof rawContent === "string"
            ? JSON.parse(rawContent)
            : rawContent;

        setTemplateData(parsedContent as TemplateFolder);
        toast.success("Playground loaded successfully");
        return;
      }

      const response = await fetch(
        `/api/template/${id}`,
        { cache: "no-store" },
      );

      if (!isCurrentRequest()) {
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.error ||
            `Failed to load template: ${response.status}`,
        );
      }

      const templateResponse = await response.json();

      if (!isCurrentRequest()) {
        return;
      }

      const nextTemplate: TemplateFolder =
        Array.isArray(templateResponse.templateJson)
          ? {
              folderName: "Root",
              items: templateResponse.templateJson,
            }
          : templateResponse.templateJson || {
              folderName: "Root",
              items: [],
            };

      setTemplateData(nextTemplate);
      toast.success("Template loaded successfully");
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Failed to load playground data";

      console.error("Error loading playground:", reason);
      if (!isCurrentRequest()) {
        return;
      }

      setError(message);
      toast.error(message);
    } finally {
      if (isCurrentRequest()) {
        setIsLoading(false);
      }
    }
  }, [id]);

  const saveTemplateData = useCallback(
    async (data: TemplateFolder) => {
      try {
        const saved = await SaveUpdatedCode(id, data);

        if (!saved) {
          throw new Error("Project could not be saved.");
        }

        setTemplateData(data);
        toast.success("Changes saved successfully");
      } catch (reason) {
        console.error("Error saving template data:", reason);
        toast.error("Failed to save changes");
        throw reason;
      }
    },
    [id],
  );

  useEffect(() => {
    void loadPlayground();
  }, [loadPlayground]);

  return {
    playgroundData,
    templateData,
    isLoading,
    error,
    loadPlayground,
    saveTemplateData,
  };
};
