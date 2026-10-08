"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Monitor,
  Play,
  RotateCw,
  Smartphone,
  Square,
  Tablet,
  Terminal,
  TriangleAlert,
} from "lucide-react";

import type { WebContainer } from "@webcontainer/api";

import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";

import { transformToWebContainerFormat } from "../hooks/transformer";
import {
  getRuntime,
  type RuntimeState,
} from "../lib/runtime";

import type { TerminalRef } from "./terminal";

/*
 * xterm uses browser-only APIs.
 * So load Terminal only in browser.
 */
const TerminalComponent = dynamic(
  () => import("./terminal"),
  {
    ssr: false,
  },
);

const idle: RuntimeState = {
  stage: "idle",
  url: "",
  command: "",
  error: null,
  timings: {},
};

const noopSubscribe = () => () => {};
const idleSnapshot = () => idle;

type DeviceMode =
  | "desktop"
  | "tablet"
  | "mobile";

interface Props {
  templateData: TemplateFolder;
  instance: WebContainer | null;
  isLoading: boolean;
  error: string | null;
  serverUrl?: string | null;

  writeFileSync?: (
    path: string,
    content: string,
  ) => Promise<void>;

  forceResetup?: boolean;
}

export default function WebContainerPreview({
  templateData,
  instance,
  isLoading,
  error,
}: Props) {
  const runtime = instance
    ? getRuntime(instance)
    : null;

  const state = useSyncExternalStore(
    runtime?.subscribe ?? noopSubscribe,
    runtime?.getSnapshot ?? idleSnapshot,
    idleSnapshot,
  );

  const terminal =
    useRef<TerminalRef>(null);

  const [device, setDevice] =
    useState<DeviceMode>("desktop");

  /*
   * Changing revision changes iframe key.
   * React then recreates the iframe.
   *
   * IMPORTANT:
   * We still use state.url directly.
   */
  const [revision, setRevision] =
    useState(0);

  const [panel, setPanel] =
    useState<
      "terminal" | "output"
    >("terminal");

  /*
   * Keep terminal closed initially
   * so Preview gets more space.
   */
  const [expanded, setExpanded] =
    useState(false);

  const [output, setOutput] =
    useState("");

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [
    previewError,
    setPreviewError,
  ] = useState(false);

  const failed =
    error || state.error;

  const stage = failed
    ? "error"
    : isLoading
      ? "booting"
      : state.stage;

  const busy = [
    "booting",
    "mounting",
    "installing",
    "starting",
  ].includes(stage);

  /*
   * Send runtime logs to:
   *
   * 1. XTerm
   * 2. OUTPUT tab
   */
  useEffect(() => {
    if (!runtime) return;

    const unsubscribe =
      runtime.subscribeOutput(
        (chunk) => {
          terminal.current?.writeToTerminal(
            chunk,
          );

          setOutput((previous) =>
            (
              previous + chunk
            ).slice(-100000),
          );
        },
      );

    return unsubscribe;
  }, [runtime]);

  /*
   * Ctrl / Cmd + J
   * toggles terminal.
   */
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "j"
      ) {
        event.preventDefault();

        setExpanded(
          (value) => !value,
        );
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  /*
   * Whenever WebContainer gives us
   * a new server URL, wait until the
   * iframe finishes loading.
   */
  useEffect(() => {
    if (!state.url) return;

    setPreviewLoading(true);
    setPreviewError(false);
  }, [state.url]);

  const run = () => {
    if (!runtime) return;

    setPreviewError(false);
    setPreviewLoading(true);

    void runtime.sync(
      transformToWebContainerFormat(
        templateData,
      ),
      true,
    );
  };

  /*
   * Do NOT append ?v=1, ?v=2 etc.
   *
   * We only change the React key.
   * That remounts the iframe using
   * the original WebContainer URL.
   */
  const refreshPreview = () => {
    if (!state.url) return;

    setPreviewLoading(true);
    setPreviewError(false);

    setRevision(
      (value) => value + 1,
    );
  };

  const deviceWidth =
    device === "desktop"
      ? "100%"
      : device === "tablet"
        ? "768px"
        : "390px";

  const statusDot =
    stage === "ready"
      ? `
        bg-emerald-400
        shadow-[0_0_10px_rgba(52,211,153,0.65)]
      `
      : stage === "error"
        ? "bg-red-500"
        : busy
          ? `
            animate-pulse
            bg-amber-400
          `
          : "bg-zinc-600";

  return (
    <section
      className="
        flex
        h-full
        min-h-0
        min-w-0
        flex-col
        overflow-hidden
        bg-[#090a0d]
        text-zinc-200
      "
      aria-label="Live preview"
    >
      {/* =========================
          TOP PREVIEW TOOLBAR
      ========================== */}

      <div
        className="
          flex
          h-10
          shrink-0
          items-center
          gap-1
          border-b
          border-white/[0.06]
          bg-[#0d0f13]
          px-2
          text-xs
        "
      >
        {/* STATUS */}

        <div
          className="
            mr-auto
            flex
            items-center
            gap-2
            font-medium
          "
        >
          <span
            className={`
              h-2
              w-2
              rounded-full
              ${statusDot}
            `}
          />

          <span
            className={
              stage === "ready"
                ? "text-zinc-200"
                : stage === "error"
                  ? "text-red-400"
                  : "text-zinc-400"
            }
          >
            {stage.toUpperCase()}
          </span>
        </div>

        {/* RUN */}

        <button
          title="Run / Restart server"
          aria-label="Run or restart server"
          disabled={
            !runtime || busy
          }
          onClick={run}
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-md
            text-zinc-500
            transition-all
            duration-150

            hover:bg-white/[0.06]
            hover:text-zinc-100

            active:scale-90

            disabled:pointer-events-none
            disabled:opacity-30
          "
        >
          <Play size={14} />
        </button>

        {/* STOP */}

        <button
          title="Stop server"
          aria-label="Stop server"
          disabled={
            !runtime ||
            (!busy &&
              stage !== "ready")
          }
          onClick={() =>
            runtime?.stop()
          }
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-md
            text-zinc-500
            transition-all
            duration-150

            hover:bg-white/[0.06]
            hover:text-zinc-100

            active:scale-90

            disabled:pointer-events-none
            disabled:opacity-30
          "
        >
          <Square size={13} />
        </button>

        {/* REFRESH */}

        <button
          title="Refresh Preview"
          aria-label="Refresh preview"
          disabled={!state.url}
          onClick={refreshPreview}
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-md
            text-zinc-500
            transition-all
            duration-150

            hover:bg-white/[0.06]
            hover:text-zinc-100

            active:rotate-90
            active:scale-90

            disabled:pointer-events-none
            disabled:opacity-30
          "
        >
          <RotateCw
            size={14}
          />
        </button>

        <span
          className="
            mx-1
            h-4
            w-px
            bg-white/[0.07]
          "
        />

        {/* DEVICE PREVIEW */}

        {(
          [
            [
              "desktop",
              Monitor,
            ],
            [
              "tablet",
              Tablet,
            ],
            [
              "mobile",
              Smartphone,
            ],
          ] as const
        ).map(
          ([name, Icon]) => (
            <button
              key={name}
              title={`${name} preview`}
              aria-label={`${name} preview`}
              aria-pressed={
                device === name
              }
              onClick={() =>
                setDevice(name)
              }
              className={`
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-md
                border
                transition-all
                duration-200
                active:scale-90

                ${
                  device === name
                    ? `
                      border-rose-500/30
                      bg-rose-500/10
                      text-rose-400
                      shadow-[0_0_15px_rgba(244,63,94,0.08)]
                    `
                    : `
                      border-transparent
                      text-zinc-500
                      hover:bg-white/[0.06]
                      hover:text-zinc-200
                    `
                }
              `}
            >
              <Icon size={14} />
            </button>
          ),
        )}

        <span
          className="
            mx-1
            h-4
            w-px
            bg-white/[0.07]
          "
        />

        {/* OPEN NEW TAB */}

        <button
          title="Open in new tab"
          aria-label="Open preview in new tab"
          disabled={!state.url}
          onClick={() =>
            window.open(
              state.url,
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-md
            text-zinc-500
            transition-all
            duration-150

            hover:bg-white/[0.06]
            hover:text-zinc-100

            active:scale-90

            disabled:pointer-events-none
            disabled:opacity-30
          "
        >
          <ExternalLink
            size={14}
          />
        </button>
      </div>

      {/* =========================
          URL BAR
      ========================== */}

      <div
        className="
          flex
          h-8
          shrink-0
          items-center
          gap-2
          border-b
          border-white/[0.06]
          bg-[#090a0d]
          px-3
          font-mono
          text-[10px]
          text-zinc-500
        "
      >
        <span
          className={`
            h-1.5
            w-1.5
            shrink-0
            rounded-full

            ${
              state.url
                ? "bg-emerald-400"
                : "bg-zinc-700"
            }
          `}
        />

        <span
          className="
            min-w-0
            flex-1
            truncate
          "
        >
          {state.url ||
            state.command ||
            "Browser runtime"}
        </span>
      </div>

      {/* =========================
          MAIN PREVIEW AREA
      ========================== */}

      <div
        className="
          relative
          flex
          min-h-0
          flex-1
          items-stretch
          justify-center
          overflow-hidden
          bg-[#08090c]
          p-2
        "
      >
        {/* GRID BACKGROUND */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            opacity-[0.18]

            [background-image:
            linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),
            linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]

            [background-size:32px_32px]
          "
        />

        {/* SOFT GLOW */}

        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[-180px]
            h-[320px]
            w-[500px]
            -translate-x-1/2
            rounded-full
            bg-rose-500/[0.07]
            blur-[100px]
          "
        />

        {state.url &&
        !failed ? (
          /*
           * IMPORTANT FIX:
           *
           * Use state.url DIRECTLY.
           * Do not append ?v=revision.
           */
          <div
            className="
              relative
              z-10
              flex
              h-full
              w-full
              justify-center
            "
          >
            <div
              className={`
                relative
                h-full
                max-w-full
                overflow-hidden
                border
                border-white/[0.1]
                bg-white

                shadow-[0_20px_70px_rgba(0,0,0,0.45)]

                transition-all
                duration-500
                ease-out

                ${
                  device ===
                  "desktop"
                    ? "rounded-lg"
                    : device ===
                        "tablet"
                      ? "rounded-xl"
                      : "rounded-[22px]"
                }
              `}
              style={{
                width:
                  deviceWidth,
              }}
            >
              {/* MOBILE / TABLET TOP DETAIL */}

              {device !==
                "desktop" && (
                <div
                  className="
                    pointer-events-none
                    absolute
                    left-1/2
                    top-1.5
                    z-20
                    h-1
                    w-12
                    -translate-x-1/2
                    rounded-full
                    bg-black/20
                  "
                />
              )}

              {/* LOADING OVERLAY */}

              {previewLoading && (
                <div
                  className="
                    absolute
                    inset-0
                    z-30
                    flex
                    items-center
                    justify-center
                    bg-[#090a0d]/90
                    backdrop-blur-sm
                  "
                >
                  {/* glow */}

                  <div
                    className="
                      absolute
                      h-48
                      w-48
                      animate-pulse
                      rounded-full
                      bg-rose-500/[0.12]
                      blur-[65px]
                    "
                  />

                  <div
                    className="
                      relative
                      flex
                      items-center
                      gap-3
                      rounded-lg
                      border
                      border-white/[0.08]
                      bg-white/[0.04]
                      px-4
                      py-3
                      text-xs
                      text-zinc-300
                      shadow-2xl
                    "
                  >
                    <LoaderCircle
                      size={16}
                      className="
                        animate-spin
                        text-rose-400
                      "
                    />

                    Loading Preview...
                  </div>
                </div>
              )}

              {/* ERROR OVERLAY */}

              {previewError && (
                <div
                  className="
                    absolute
                    inset-0
                    z-40
                    flex
                    flex-col
                    items-center
                    justify-center
                    bg-[#090a0d]
                    p-8
                    text-center
                  "
                >
                  <div
                    className="
                      mb-4
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-red-500/20
                      bg-red-500/10
                      text-red-400
                    "
                  >
                    <TriangleAlert
                      size={18}
                    />
                  </div>

                  <h3
                    className="
                      text-sm
                      font-semibold
                      text-zinc-200
                    "
                  >
                    Preview failed
                    to load
                  </h3>

                  <p
                    className="
                      mt-2
                      max-w-xs
                      text-xs
                      leading-5
                      text-zinc-500
                    "
                  >
                    The development
                    server started,
                    but the browser
                    preview could not
                    load.
                  </p>

                  <button
                    onClick={
                      refreshPreview
                    }
                    className="
                      mt-5
                      flex
                      items-center
                      gap-2
                      rounded-md
                      border
                      border-white/[0.08]
                      bg-white/[0.04]
                      px-3
                      py-2
                      text-xs
                      text-zinc-300
                      transition-all
                      duration-150

                      hover:border-rose-500/30
                      hover:bg-rose-500/10
                      hover:text-white

                      active:scale-95
                    "
                  >
                    <RotateCw
                      size={13}
                    />

                    Try Again
                  </button>
                </div>
              )}

              {/* =========================
                  ACTUAL WEB APP

                  THIS IS THE IMPORTANT FIX
              ========================== */}

            <iframe
              key={`${state.url}-${revision}`}
              src={state.url}
              title="Project preview"
              allow="cross-origin-isolated"
              onLoad={() => {
                setPreviewLoading(false);
                setPreviewError(false);
              }}
              onError={() => {
                setPreviewLoading(false);
                setPreviewError(true);
              }}
              className="
                block
                h-full
                w-full
                border-0
                bg-white
                transition-opacity
                duration-300
              "
            />
            </div>
          </div>
        ) : (
          /* =========================
              ENVIRONMENT STATE
          ========================== */

          <div
            className="
              relative
              z-10
              w-full
              max-w-md
              self-center
              rounded-xl
              border
              border-white/[0.08]
              bg-[#101217]/95
              p-5
              text-sm
              shadow-2xl
              backdrop-blur-xl
            "
          >
            {failed ? (
              <>
                <div
                  className="
                    mb-4
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-red-500/20
                    bg-red-500/10
                    text-red-400
                  "
                >
                  <TriangleAlert
                    size={17}
                  />
                </div>

                <h2
                  className="
                    font-semibold
                    text-zinc-100
                  "
                >
                  Environment needs
                  attention
                </h2>

                <p
                  className="
                    mt-2
                    break-words
                    text-xs
                    leading-5
                    text-red-400
                  "
                >
                  {failed}
                </p>

                <button
                  onClick={
                    runtime
                      ? run
                      : () =>
                          window.location.reload()
                  }
                  className="
                    mt-5
                    flex
                    items-center
                    gap-2
                    rounded-md
                    border
                    border-white/[0.08]
                    bg-white/[0.04]
                    px-3
                    py-2
                    text-xs
                    text-zinc-300
                    transition-all
                    duration-150

                    hover:bg-white/[0.08]

                    active:scale-95
                  "
                >
                  <RotateCw
                    size={13}
                  />

                  Retry
                </button>
              </>
            ) : (
              <>
                <div
                  className="
                    mb-5
                    flex
                    items-center
                    justify-between
                  "
                >
                  <div>
                    <h2
                      className="
                        font-semibold
                        text-zinc-100
                      "
                    >
                      Environment
                    </h2>

                    <p
                      className="
                        mt-1
                        text-[11px]
                        text-zinc-500
                      "
                    >
                      Preparing browser
                      runtime
                    </p>
                  </div>

                  {busy && (
                    <LoaderCircle
                      size={17}
                      className="
                        animate-spin
                        text-rose-400
                      "
                    />
                  )}
                </div>

                {[
                  {
                    id: "booting",
                    label:
                      "Initializing runtime",
                  },
                  {
                    id: "mounting",
                    label:
                      "Mounting files",
                  },
                  {
                    id: "installing",
                    label:
                      "Installing dependencies",
                  },
                  {
                    id: "starting",
                    label:
                      "Starting server",
                  },
                ].map(
                  ({
                    id,
                    label,
                  }) => (
                    <div
                      key={id}
                      className="
                        flex
                        min-h-10
                        items-center
                        justify-between
                        border-b
                        border-white/[0.04]
                        text-xs
                      "
                    >
                      <span
                        className={
                          stage === id
                            ? "text-zinc-100"
                            : "text-zinc-500"
                        }
                      >
                        {label}
                      </span>

                      <span
                        className="
                          font-mono
                          text-[10px]
                          text-zinc-600
                        "
                      >
                        {state.timings[
                          id
                        ] !==
                        undefined
                          ? `${(
                              state
                                .timings[
                                id
                              ] /
                              1000
                            ).toFixed(
                              1,
                            )}s`
                          : stage ===
                              id
                            ? "Running"
                            : "-"}
                      </span>
                    </div>
                  ),
                )}

                {stage ===
                  "stopped" && (
                  <button
                    onClick={run}
                    className="
                      mt-4
                      flex
                      items-center
                      gap-2
                      rounded-md
                      border
                      border-white/[0.08]
                      bg-white/[0.04]
                      px-3
                      py-2
                      text-xs
                      text-zinc-300
                    "
                  >
                    <Play
                      size={13}
                    />

                    Start Server
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* =========================
          TERMINAL NAVBAR
      ========================== */}

      <div
        className="
          flex
          h-9
          shrink-0
          items-center
          gap-4
          border-t
          border-white/[0.06]
          bg-[#0d0f13]
          px-3
          text-[10px]
        "
      >
        <button
          onClick={() => {
            setPanel("terminal");
            setExpanded(true);
          }}
          className={`
            flex
            h-full
            items-center
            gap-1.5
            border-b-2
            transition-colors

            ${
              panel ===
              "terminal"
                ? `
                  border-rose-500
                  text-zinc-200
                `
                : `
                  border-transparent
                  text-zinc-500
                  hover:text-zinc-300
                `
            }
          `}
        >
          <Terminal size={12} />

          TERMINAL
        </button>

        <button
          onClick={() => {
            setPanel("output");
            setExpanded(true);
          }}
          className={`
            h-full
            border-b-2
            transition-colors

            ${
              panel === "output"
                ? `
                  border-rose-500
                  text-zinc-200
                `
                : `
                  border-transparent
                  text-zinc-500
                  hover:text-zinc-300
                `
            }
          `}
        >
          OUTPUT
        </button>

        <span
          className="
            ml-auto
            max-w-[45%]
            truncate
            font-mono
            text-[9px]
            text-zinc-600
          "
        >
          {state.command}
        </span>

        <button
          title="Toggle Terminal (Ctrl + J)"
          aria-label="Toggle terminal"
          aria-expanded={
            expanded
          }
          onClick={() =>
            setExpanded(
              (value) => !value,
            )
          }
          className="
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-md
            text-zinc-500
            transition-all

            hover:bg-white/[0.06]
            hover:text-zinc-200
          "
        >
          <ChevronDown
            size={14}
            className={`
              transition-transform
              duration-200

              ${
                expanded
                  ? "rotate-180"
                  : ""
              }
            `}
          />
        </button>
      </div>

      {/* =========================
          TERMINAL / OUTPUT AREA
      ========================== */}

      <div
        className={`
          shrink-0
          overflow-hidden
          border-t
          border-white/[0.04]
          bg-[#090a0d]

          transition-[height]
          duration-300
          ease-out

          ${
            expanded
              ? "h-56 min-h-24"
              : "h-0"
          }
        `}
      >
        <div
          className={
            panel ===
            "terminal"
              ? "h-full"
              : "hidden"
          }
        >
          <TerminalComponent
            ref={terminal}
            webContainerInstance={
              instance
            }
            theme="dark"
            className="h-full"
          />
        </div>

        {panel ===
          "output" && (
          <pre
            className="
              h-full
              overflow-auto
              whitespace-pre-wrap
              break-all
              p-3
              font-mono
              text-[11px]
              leading-5
              text-zinc-400
            "
          >
            {output.replace(
              /\x1b\[[0-9;]*[a-zA-Z]/g,
              "",
            ) ||
              "No runtime output yet."}
          </pre>
        )}
      </div>
    </section>
  );
}
