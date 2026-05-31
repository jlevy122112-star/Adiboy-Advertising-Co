// Job queue — manages background task scheduling
// Uses a simple in-memory queue for Phase 1.
// Replace with BullMQ + Redis for production.

type Job = {
  id: string;
  type: string;
  payload: unknown;
  scheduledAt: Date;
};

const queue: Job[] = [];

export const jobQueue = {
  add(type: string, payload: unknown, scheduledAt: Date = new Date()): void {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    queue.push({ id, type, payload, scheduledAt });
  },

  getPending(): Job[] {
    const now = new Date();
    return queue.filter((j) => j.scheduledAt <= now);
  },

  remove(id: string): void {
    const index = queue.findIndex((j) => j.id === id);
    if (index > -1) queue.splice(index, 1);
  },

  size(): number {
    return queue.length;
  },
};
