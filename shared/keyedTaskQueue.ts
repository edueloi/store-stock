/** Mantém a ordem de um mesmo chat; clientes diferentes continuam independentes. */
export class KeyedTaskQueue {
  private pending = new Map<string, Promise<unknown>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.pending.set(key, current);
    try { return await current; }
    finally { if (this.pending.get(key) === current) this.pending.delete(key); }
  }
}
