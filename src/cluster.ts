/**
 * cluster.ts — Multi-core parallelism via Bun Workers
 *
 * Spawns one worker per CPU core. Each worker runs a full HTTP server
 * on a shared port (SO_REUSEPORT). The OS kernel load-balances incoming
 * connections across all workers — true parallelism, not just concurrency.
 */

import os from "os";

const NUM_WORKERS = parseInt(process.env.WORKERS || String(os.cpus().length));

console.log(`[Cluster] Spawning ${NUM_WORKERS} workers on ${os.cpus()[0].model}`);

const workers: Worker[] = [];

for (let i = 0; i < NUM_WORKERS; i++) {
  const worker = new Worker(new URL("./server.ts", import.meta.url));

  worker.addEventListener("message", (e) => {
    console.log(`[Worker ${i}]`, e.data);
  });

  worker.addEventListener("error", (err) => {
    console.error(`[Worker ${i}] Error:`, err.message);
    // Restart crashed worker after 1 second
    setTimeout(() => {
      console.log(`[Cluster] Restarting worker ${i}...`);
      workers[i] = new Worker(new URL("./server.ts", import.meta.url));
    }, 1000);
  });

  workers.push(worker);
  console.log(`[Cluster] Worker ${i} started`);
}

// Propagate shutdown signal to all workers
process.on("SIGINT", () => {
  console.log("[Cluster] Shutting down all workers...");
  workers.forEach((w) => w.terminate());
  process.exit(0);
});

process.on("SIGTERM", () => {
  workers.forEach((w) => w.terminate());
  process.exit(0);
});
