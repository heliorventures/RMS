class RequestCoordinator {
  constructor() {
    this.active = new Map();
  }

  async run(key, operation) {
    this.cancel(key);
    const controller = new AbortController();
    this.active.set(key, controller);

    try {
      const result = await operation({
        signal: controller.signal,
        isCurrent: () => this.active.get(key) === controller
      });
      return this.active.get(key) === controller ? result : undefined;
    } catch (error) {
      if (controller.signal.aborted) return undefined;
      throw error;
    } finally {
      if (this.active.get(key) === controller) this.active.delete(key);
    }
  }

  cancel(key) {
    this.active.get(key)?.abort();
  }

  cancelAll() {
    this.active.forEach(controller => controller.abort());
    this.active.clear();
  }
}

window.RMS.requests = new RequestCoordinator();
