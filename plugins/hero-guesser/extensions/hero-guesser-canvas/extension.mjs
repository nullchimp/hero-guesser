import { createCanvas, joinSession } from "@github/copilot-sdk/extension";
import {
    APP_URL,
    closeServer,
    probeHeroGuesser,
    startSetupServer,
} from "./canvas-server.mjs";

const servers = new Map();

async function closeInstance(instanceId) {
    const entry = servers.get(instanceId);

    if (!entry) {
        return;
    }

    servers.delete(instanceId);
    await closeServer(entry.server);
}

async function closeAllInstances() {
    const openServers = [...servers.values()];
    servers.clear();
    await Promise.allSettled(openServers.map((entry) => closeServer(entry.server)));
}

function terminate() {
    void closeAllInstances().finally(() => {
        process.exit(0);
    });
}

process.once("SIGINT", terminate);
process.once("SIGTERM", terminate);

await joinSession({
    canvases: [
        createCanvas({
            id: "hero-guesser",
            displayName: "Hero Guesser",
            description: "Play the local Hero Guesser web game in a Copilot canvas.",
            actions: [
                {
                    name: "check_connection",
                    description: "Check whether the local Hero Guesser Docker stack is reachable.",
                    handler: async () => {
                        const status = await probeHeroGuesser();

                        return {
                            ...status,
                            appUrl: APP_URL,
                        };
                    },
                },
            ],
            open: async (ctx) => {
                const status = await probeHeroGuesser();

                if (status.available) {
                    await closeInstance(ctx.instanceId);
                    return {
                        status: "Ready",
                        title: "Hero Guesser",
                        url: APP_URL,
                    };
                }

                let entry = servers.get(ctx.instanceId);

                if (!entry) {
                    entry = await startSetupServer();
                    servers.set(ctx.instanceId, entry);
                }

                return {
                    status: "Local Docker stack unavailable",
                    title: "Hero Guesser setup",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                await closeInstance(ctx.instanceId);
            },
        }),
    ],
});
