type Actions = {
  hasWindow: () => boolean;
  closeWindow: () => void;
  closeService: () => Promise<void>;
  quit: () => void;
};
export function createQuitCoordinator(actions: Actions) {
  let requested = false,
    shuttingDown = false,
    committed = false;
  return {
    beforeQuit(event: { preventDefault(): void }) {
      if (committed) return;
      event.preventDefault();
      if (actions.hasWindow()) {
        requested = true;
        actions.closeWindow();
        return;
      }
      if (shuttingDown) return;
      shuttingDown = true;
      void actions.closeService().finally(() => {
        committed = true;
        actions.quit();
      });
    },
    unloadCancelled() {
      requested = false;
    },
    windowClosed() {
      if (requested) actions.quit();
    },
  };
}
