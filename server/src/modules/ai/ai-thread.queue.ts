import { processAiJob } from "./ai-thread.worker";

type QueueItem = { jobId: string };

class InProcessAiQueue {
  private readonly queue: QueueItem[] = [];
  private running = false;

  enqueue(jobId: string) {
    this.queue.push({ jobId });
    this.pump();
  }

  private pump() {
    if (this.running) return;
    this.running = true;
    void (async () => {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) continue;
        await processAiJob(item.jobId);
      }
      this.running = false;
    })();
  }
}

const queue = new InProcessAiQueue();

export const aiThreadQueue = {
  enqueue(jobId: string) {
    queue.enqueue(jobId);
  },
};

