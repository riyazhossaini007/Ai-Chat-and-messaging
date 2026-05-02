"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiThreadQueue = void 0;
const ai_thread_worker_1 = require("./ai-thread.worker");
class InProcessAiQueue {
    constructor() {
        this.queue = [];
        this.running = false;
    }
    enqueue(jobId) {
        this.queue.push({ jobId });
        this.pump();
    }
    pump() {
        if (this.running)
            return;
        this.running = true;
        void (async () => {
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                if (!item)
                    continue;
                await (0, ai_thread_worker_1.processAiJob)(item.jobId);
            }
            this.running = false;
        })();
    }
}
const queue = new InProcessAiQueue();
exports.aiThreadQueue = {
    enqueue(jobId) {
        queue.enqueue(jobId);
    },
};
