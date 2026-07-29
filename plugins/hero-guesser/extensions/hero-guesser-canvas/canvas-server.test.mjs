import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    APP_URL,
    BOOTSTRAP_URL,
    HEALTH_URL,
    closeServer,
    prepareCanvasLaunch,
    probeHeroGuesser,
    renderSetupPage,
    startSetupServer,
} from "./canvas-server.mjs";

test("uses the documented localhost app origin and proxied API health endpoint", () => {
    assert.equal(APP_URL, "http://localhost:8080/");
    assert.equal(HEALTH_URL, "http://localhost:8080/api/models");
    assert.equal(BOOTSTRAP_URL, "http://127.0.0.1:3000/api/auth/canvas/bootstrap");
});

test("treats an unauthenticated API response as an available stack", async () => {
    const result = await probeHeroGuesser({
        fetchImpl: async () => new Response(null, { status: 401 }),
    });

    assert.deepEqual(result, {
        available: true,
        reason: "The Hero Guesser stack is ready and waiting for login.",
        status: 401,
    });
});

test("treats gateway failures as an unavailable API", async () => {
    const result = await probeHeroGuesser({
        fetchImpl: async () => new Response(null, { status: 502 }),
    });

    assert.deepEqual(result, {
        available: false,
        reason: "The web proxy returned HTTP 502 while waiting for the API.",
        status: 502,
    });
});

test("treats connection failures as unavailable without exposing error details", async () => {
    const result = await probeHeroGuesser({
        fetchImpl: async () => {
            throw new Error("private network details");
        },
    });

    assert.deepEqual(result, {
        available: false,
        reason: "The Hero Guesser stack is not reachable at http://localhost:8080.",
        status: null,
    });
});

test("aborts a health check that exceeds its timeout", async () => {
    const result = await probeHeroGuesser({
        fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
            });
        }),
        timeoutMs: 5,
    });

    assert.equal(result.available, false);
    assert.match(result.reason, /timed out/);
});

test("prepares an automatic Canvas login URL after the stack is healthy", async () => {
    const code = "a".repeat(43);
    const result = await prepareCanvasLaunch({
        fetchImpl: async (url, options) => {
            if (url === HEALTH_URL) {
                return new Response(null, { status: 401 });
            }

            assert.equal(url, BOOTSTRAP_URL);
            assert.equal(options.method, "POST");
            assert.equal(options.redirect, "manual");
            return new Response(JSON.stringify({
                code,
                expiresAt: "2026-07-29T00:01:00.000Z",
            }), {
                headers: {
                    "Content-Type": "application/json",
                },
                status: 200,
            });
        },
    });
    const appUrl = new URL(result.appUrl);

    assert.equal(result.available, true);
    assert.equal(appUrl.origin, "http://localhost:8080");
    assert.equal(appUrl.searchParams.get("canvas"), "1");
    assert.equal(
        new URL(`http://localhost/?${appUrl.hash.slice(1)}`).searchParams.get("code"),
        code,
    );
});

test("preserves bootstrap error retryability without exposing credentials", async () => {
    const result = await prepareCanvasLaunch({
        fetchImpl: async (url) => {
            if (url === HEALTH_URL) {
                return new Response(null, { status: 401 });
            }

            return new Response(JSON.stringify({
                message: "COPILOT_GITHUB_TOKEN is invalid or expired.",
                retryable: false,
            }), {
                headers: {
                    "Content-Type": "application/json",
                },
                status: 401,
            });
        },
    });

    assert.deepEqual(result, {
        available: false,
        reason: "COPILOT_GITHUB_TOKEN is invalid or expired.",
        retryable: false,
        status: 401,
    });
});

test("renders actionable setup instructions without credentials", () => {
    const html = renderSetupPage();

    assert.match(html, /COPILOT_GITHUB_TOKEN/);
    assert.match(html, /docker compose up --build/);
    assert.match(html, /window\.location\.replace\(result\.appUrl\)/);
    assert.match(html, /checkConnection\(\)/);
    assert.doesNotMatch(html, /Check again/);
    assert.doesNotMatch(html, /github_pat_|ghp_/);
});

test("serves setup and same-origin status endpoints", async () => {
    const entry = await startSetupServer(async () => ({
        appUrl: "http://localhost:8080/?canvas=1#code=bootstrap",
        available: true,
        reason: "Ready.",
        retryable: false,
        status: 200,
    }));

    try {
        const pageResponse = await fetch(entry.url);
        const page = await pageResponse.text();
        const statusResponse = await fetch(new URL("/status", entry.url));
        const status = await statusResponse.json();

        assert.equal(pageResponse.status, 200);
        assert.match(page, /Hero Guesser is getting ready/);
        assert.match(pageResponse.headers.get("content-security-policy") ?? "", /connect-src 'self'/);
        assert.equal(statusResponse.headers.get("cache-control"), "no-store");
        assert.deepEqual(status, {
            appUrl: "http://localhost:8080/?canvas=1#code=bootstrap",
            available: true,
            reason: "Ready.",
            retryable: false,
            status: 200,
        });
    } finally {
        await closeServer(entry.server);
    }
});

test("plugin and marketplace manifests register one direct canvas extension", async () => {
    const [plugin, marketplace, extension, preview] = await Promise.all([
        readJson(new URL("../../.github/plugin/plugin.json", import.meta.url)),
        readJson(new URL("../../../../.github/plugin/marketplace.json", import.meta.url)),
        readJson(new URL("./copilot-extension.json", import.meta.url)),
        readFile(new URL("../../assets/preview.png", import.meta.url)),
    ]);

    assert.equal(plugin.name, "hero-guesser");
    assert.equal(plugin.version, "0.1.1");
    assert.equal(plugin.extensions, "extensions");
    assert.equal(plugin.logo, "assets/preview.png");
    assert.ok(plugin.keywords.includes("copilot-canvas"));
    assert.ok(plugin.keywords.includes("interactive-canvas"));
    assert.equal(marketplace.name, "hero-guesser");
    assert.equal(marketplace.metadata.version, plugin.version);
    assert.equal(marketplace.plugins.length, 1);
    assert.equal(marketplace.plugins[0].name, "hero-guesser");
    assert.equal(marketplace.plugins[0].version, plugin.version);
    assert.equal(marketplace.plugins[0].source, "plugins/hero-guesser");
    assert.deepEqual(marketplace.plugins[0].keywords, plugin.keywords);
    assert.deepEqual([...preview.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(preview.readUInt32BE(16), 1200);
    assert.equal(preview.readUInt32BE(20), 675);
    assert.deepEqual(extension, {
        name: "hero-guesser-canvas",
        version: 1,
    });
});

test("Docker and nginx expose bootstrap only on the loopback API port", async () => {
    const [compose, nginx] = await Promise.all([
        readFile(new URL("../../../../docker-compose.yml", import.meta.url), "utf8"),
        readFile(new URL("../../../../apps/web/nginx.conf", import.meta.url), "utf8"),
    ]);

    assert.match(compose, /127\.0\.0\.1:3000:3000/);
    assert.match(nginx, /location \^~ \/api\/auth\/canvas\/bootstrap/);
    assert.match(nginx, /return 404/);
});

test("README provides encoded app links and CLI installation fallbacks", async () => {
    const readme = await readFile(new URL("../../../../README.md", import.meta.url), "utf8");
    const addMarketplaceLink = "https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fplugins%2Fmarketplace%2Fadd%3Fsource%3Dnullchimp%252Fhero-guesser";
    const installPluginLink = "https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fplugins%2Finstall%3Fsource%3Dhero-guesser%2540hero-guesser";

    assert.ok(readme.includes(addMarketplaceLink));
    assert.ok(readme.includes(installPluginLink));
    assert.match(readme, /copilot plugin marketplace add nullchimp\/hero-guesser/);
    assert.match(readme, /copilot plugin install hero-guesser@hero-guesser/);
    assert.equal(
        new URL(addMarketplaceLink).searchParams.get("open"),
        "ghapp://plugins/marketplace/add?source=nullchimp%2Fhero-guesser",
    );
    assert.equal(
        new URL(installPluginLink).searchParams.get("open"),
        "ghapp://plugins/install?source=hero-guesser%40hero-guesser",
    );
});

async function readJson(url) {
    return JSON.parse(await readFile(url, "utf8"));
}
