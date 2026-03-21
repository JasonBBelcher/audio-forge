import { describe, it, expect, vi, beforeEach } from 'vitest';
import { historyStore, type Command } from '../historyStore';

function makeCommand(name = 'cmd'): Command & { executeCalls: number; undoCalls: number } {
  const cmd = {
    name,
    executeCalls: 0,
    undoCalls: 0,
    execute() { this.executeCalls++; },
    undo() { this.undoCalls++; },
  };
  return cmd;
}

describe('historyStore', () => {
  beforeEach(() => {
    historyStore.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts with empty undo stack', () => {
    expect(historyStore.canUndo()).toBe(false);
  });

  it('starts with empty redo stack', () => {
    expect(historyStore.canRedo()).toBe(false);
  });

  // ── push ───────────────────────────────────────────────────────────────────

  it('push executes the command', () => {
    const cmd = makeCommand();
    historyStore.push(cmd);
    expect(cmd.executeCalls).toBe(1);
  });

  it('push enables canUndo', () => {
    historyStore.push(makeCommand());
    expect(historyStore.canUndo()).toBe(true);
  });

  it('push does not enable canRedo', () => {
    historyStore.push(makeCommand());
    expect(historyStore.canRedo()).toBe(false);
  });

  it('push clears the redo stack', () => {
    const a = makeCommand('a');
    const b = makeCommand('b');
    const c = makeCommand('c');
    historyStore.push(a);
    historyStore.push(b);
    historyStore.undo();        // redo stack now has b
    historyStore.push(c);       // should clear redo
    expect(historyStore.canRedo()).toBe(false);
  });

  // ── undo ───────────────────────────────────────────────────────────────────

  it('undo calls undo on the last command', () => {
    const cmd = makeCommand();
    historyStore.push(cmd);
    historyStore.undo();
    expect(cmd.undoCalls).toBe(1);
  });

  it('undo enables canRedo', () => {
    historyStore.push(makeCommand());
    historyStore.undo();
    expect(historyStore.canRedo()).toBe(true);
  });

  it('undo disables canUndo when stack empties', () => {
    historyStore.push(makeCommand());
    historyStore.undo();
    expect(historyStore.canUndo()).toBe(false);
  });

  it('undo is a no-op when stack is empty', () => {
    expect(() => historyStore.undo()).not.toThrow();
  });

  it('undo undoes in LIFO order', () => {
    const order: string[] = [];
    const a = { name: 'a', execute: vi.fn(), undo: () => order.push('a') };
    const b = { name: 'b', execute: vi.fn(), undo: () => order.push('b') };
    historyStore.push(a);
    historyStore.push(b);
    historyStore.undo();
    historyStore.undo();
    expect(order).toEqual(['b', 'a']);
  });

  // ── redo ───────────────────────────────────────────────────────────────────

  it('redo re-executes the undone command', () => {
    const cmd = makeCommand();
    historyStore.push(cmd);
    historyStore.undo();
    historyStore.redo();
    expect(cmd.executeCalls).toBe(2);
  });

  it('redo re-enables canUndo', () => {
    historyStore.push(makeCommand());
    historyStore.undo();
    historyStore.redo();
    expect(historyStore.canUndo()).toBe(true);
  });

  it('redo disables canRedo when redo stack empties', () => {
    historyStore.push(makeCommand());
    historyStore.undo();
    historyStore.redo();
    expect(historyStore.canRedo()).toBe(false);
  });

  it('redo is a no-op when redo stack is empty', () => {
    expect(() => historyStore.redo()).not.toThrow();
  });

  it('multiple undo/redo cycles work correctly', () => {
    const order: string[] = [];
    const a = {
      name: 'a',
      execute: () => order.push('exec-a'),
      undo: () => order.push('undo-a'),
    };
    historyStore.push(a);   // exec-a
    historyStore.undo();    // undo-a
    historyStore.redo();    // exec-a
    historyStore.undo();    // undo-a
    expect(order).toEqual(['exec-a', 'undo-a', 'exec-a', 'undo-a']);
  });

  // ── stack size limit ───────────────────────────────────────────────────────

  it('caps undo stack at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      historyStore.push(makeCommand(`cmd-${i}`));
    }
    // undo 51 times — the 51st should be a no-op
    let undoCount = 0;
    while (historyStore.canUndo()) {
      historyStore.undo();
      undoCount++;
    }
    expect(undoCount).toBe(50);
  });

  // ── reactive store ─────────────────────────────────────────────────────────

  it('exposes a subscribe method for reactivity', () => {
    expect(typeof historyStore.subscribe).toBe('function');
  });

  it('notifies subscribers on push', () => {
    const states: boolean[] = [];
    const unsub = historyStore.subscribe(s => states.push(s.canUndo));
    historyStore.push(makeCommand());
    unsub();
    expect(states).toContain(true);
  });

  it('notifies subscribers on undo', () => {
    historyStore.push(makeCommand());
    const states: boolean[] = [];
    const unsub = historyStore.subscribe(s => states.push(s.canRedo));
    historyStore.undo();
    unsub();
    expect(states).toContain(true);
  });
});
