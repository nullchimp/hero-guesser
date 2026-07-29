import { createServer } from "node:http";

export const APP_URL = "http://localhost:8080/";
export const HEALTH_URL = new URL("/api/models", APP_URL).href;
export const BOOTSTRAP_URL = "http://127.0.0.1:3000/api/auth/canvas/bootstrap";

const DEFAULT_TIMEOUT_MS = 3_000;
const BOOTSTRAP_TIMEOUT_MS = 8_000;
const GATEWAY_FAILURE_STATUSES = new Set([502, 503, 504]);

export async function probeHeroGuesser({
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(HEALTH_URL, {
            headers: {
                Accept: "application/json",
            },
            redirect: "manual",
            signal: controller.signal,
        });

        if (GATEWAY_FAILURE_STATUSES.has(response.status)) {
            return {
                available: false,
                reason: `The web proxy returned HTTP ${response.status} while waiting for the API.`,
                status: response.status,
            };
        }

        return {
            available: true,
            reason: response.status === 401
                ? "The Hero Guesser stack is ready and waiting for login."
                : `The Hero Guesser stack responded with HTTP ${response.status}.`,
            status: response.status,
        };
    } catch (error) {
        const timedOut = error instanceof Error && error.name === "AbortError";

        return {
            available: false,
            reason: timedOut
                ? "The Hero Guesser stack did not respond before the connection check timed out."
                : "The Hero Guesser stack is not reachable at http://localhost:8080.",
            status: null,
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function prepareCanvasLaunch({
    bootstrapTimeoutMs = BOOTSTRAP_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
    const status = await probeHeroGuesser({
        fetchImpl,
        timeoutMs,
    });

    if (!status.available) {
        return {
            ...status,
            retryable: true,
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), bootstrapTimeoutMs);

    try {
        const response = await fetchImpl(BOOTSTRAP_URL, {
            headers: {
                Accept: "application/json",
            },
            method: "POST",
            redirect: "manual",
            signal: controller.signal,
        });
        const body = await readJson(response);

        if (!response.ok) {
            return {
                available: false,
                reason: readErrorMessage(body, response.status),
                retryable: readRetryable(body, response.status),
                status: response.status,
            };
        }

        if (!isBootstrapResponse(body)) {
            return {
                available: false,
                reason: "The Hero Guesser API returned an invalid Canvas sign-in response.",
                retryable: false,
                status: response.status,
            };
        }

        return {
            appUrl: createCanvasAppUrl(body.code),
            available: true,
            reason: "Hero Guesser is ready.",
            retryable: false,
            status: response.status,
        };
    } catch (error) {
        const timedOut = error instanceof Error && error.name === "AbortError";

        return {
            available: false,
            reason: timedOut
                ? "Canvas sign-in did not respond in time. Retrying automatically."
                : "Canvas sign-in is not reachable. Retrying automatically.",
            retryable: true,
            status: null,
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function startSetupServer(prepare = prepareCanvasLaunch) {
    const server = createServer(async (request, response) => {
        setSecurityHeaders(response);

        if (request.method === "GET" && request.url === "/") {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(renderSetupPage());
            return;
        }

        if (request.method === "GET" && request.url === "/status") {
            const status = await prepare();
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(status));
            return;
        }

        response.statusCode = 404;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("Not found");
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });

    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    return {
        server,
        url: `http://127.0.0.1:${port}/`,
    };
}

export async function closeServer(server) {
    if (!server.listening) {
        return;
    }

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

export function renderSetupPage() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hero Guesser setup</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: var(--font-sans, system-ui, sans-serif);
        background: var(--background-color-default, #f4ead0);
        color: var(--text-color-default, #0a0a0a);
      }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 1px 1px, color-mix(in srgb, currentColor 18%, transparent) 1px, transparent 1.4px),
          var(--background-color-default, #f4ead0);
        background-size: 18px 18px;
      }
      main {
        width: min(680px, 100%);
        padding: 28px;
        background: var(--background-color-default, #fffaf0);
        border: 3px solid var(--border-color-default, #0a0a0a);
        border-radius: 8px;
        box-shadow: 6px 6px 0 var(--text-color-default, #0a0a0a);
      }
      .eyebrow {
        margin: 0 0 8px;
        color: var(--true-color-red, #b21e2b);
        font-weight: var(--font-weight-semibold, 600);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: var(--text-title-large, 26px);
        line-height: var(--leading-title-large, 32px);
      }
      p, li {
        line-height: var(--leading-body-medium, 1.5);
      }
      ol {
        padding-left: 24px;
      }
      code {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-code-inline, 12px);
      }
      pre {
        overflow-x: auto;
        padding: 14px;
        background: var(--n-0, #111);
        color: var(--color-white, #fff);
        border-radius: 6px;
      }
      #status {
        min-height: 24px;
        color: var(--text-color-muted, #5b5b5b);
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Preparing Canvas</p>
      <h1>Hero Guesser is getting ready</h1>
      <p>The Canvas is checking the local Docker stack and signing in with your configured GitHub account automatically.</p>
      <ol>
        <li>Clone <code>github.com/nullchimp/hero-guesser</code>.</li>
        <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
        <li>Set <code>COPILOT_GITHUB_TOKEN</code> in <code>.env</code>.</li>
        <li>Start the stack from the repository root:</li>
      </ol>
      <pre><code>docker compose up --build</code></pre>
      <p id="status" role="status">Waiting for http://localhost:8080...</p>
    </main>
    <script>
      const statusLine = document.querySelector("#status");
      let checking = false;

      async function checkConnection() {
        if (checking) return;
        checking = true;
        statusLine.textContent = "Checking the local stack and GitHub identity...";

        try {
          const response = await fetch("/status", { cache: "no-store" });
          const result = await response.json();

          if (result.available && typeof result.appUrl === "string") {
            statusLine.textContent = "Hero Guesser is ready. Opening the game...";
            window.location.replace(result.appUrl);
            return;
          }

          statusLine.textContent = result.reason;
        } catch {
          statusLine.textContent = "The canvas could not check the local stack. Try again.";
        } finally {
          checking = false;
        }
      }

      checkConnection();
      setInterval(checkConnection, 4000);
    </script>
  </body>
</html>`;
}

function createCanvasAppUrl(code) {
    const url = new URL(APP_URL);
    url.searchParams.set("canvas", "1");
    url.hash = `code=${code}`;
    return url.href;
}

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function isBootstrapResponse(value) {
    return typeof value === "object" &&
        value !== null &&
        typeof value.code === "string" &&
        /^[A-Za-z0-9_-]{43}$/.test(value.code);
}

function readErrorMessage(body, status) {
    if (
        typeof body === "object" &&
        body !== null &&
        typeof body.message === "string"
    ) {
        return body.message;
    }

    return `Canvas sign-in returned HTTP ${status}.`;
}

function readRetryable(body, status) {
    if (
        typeof body === "object" &&
        body !== null &&
        typeof body.retryable === "boolean"
    ) {
        return body.retryable;
    }

    return status === 429 || status >= 500;
}

function setSecurityHeaders(response) {
    response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    );
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
}
