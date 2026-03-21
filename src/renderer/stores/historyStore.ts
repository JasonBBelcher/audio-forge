import { writable } from 'svelte/store';

export interface Command {
  name: string;
  execute(): void;
  undo(): void;
}

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY = 50;

function createHistoryStore() {
  const undoStack: Command[] = [];
  const redoStack: Command[] = [];

  const { subscribe, set } = writable<HistoryState>({ canUndo: false, canRedo: false });

  function notify() {
    set({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  }

  return {
    subscribe,

    push(cmd: Command) {
      cmd.execute();
      undoStack.push(cmd);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack.length = 0;
      notify();
    },

    undo() {
      const cmd = undoStack.pop();
      if (!cmd) return;
      cmd.undo();
      redoStack.push(cmd);
      notify();
    },

    redo() {
      const cmd = redoStack.pop();
      if (!cmd) return;
      cmd.execute();
      undoStack.push(cmd);
      notify();
    },

    canUndo() {
      return undoStack.length > 0;
    },

    canRedo() {
      return redoStack.length > 0;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
    },
  };
}

export const historyStore = createHistoryStore();
