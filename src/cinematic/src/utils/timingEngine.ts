type TimerId = ReturnType<typeof setTimeout>;

class TimingEngine {
  private timers: TimerId[] = [];

  schedule(callback: () => void, delayMs: number) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      callback();
    }, delayMs);
    this.timers.push(id);
    return id;
  }

  clearAll() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

export const timingEngine = new TimingEngine();
