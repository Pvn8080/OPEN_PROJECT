import { it, expect, vi } from "vitest";
import { createQuitCoordinator } from "../../desktop/lifecycle";
it("keeps the service running when unload is cancelled and closes it only after the window closes", async () => {
  let hasWindow = true;
  const closeWindow = vi.fn(),
    closeService = vi.fn(async () => {}),
    quit = vi.fn(),
    preventDefault = vi.fn();
  const coordinator = createQuitCoordinator({
    hasWindow: () => hasWindow,
    closeWindow,
    closeService,
    quit,
  });
  coordinator.beforeQuit({ preventDefault });
  expect(closeWindow).toHaveBeenCalledTimes(1);
  expect(closeService).not.toHaveBeenCalled();
  coordinator.unloadCancelled();
  coordinator.windowClosed();
  expect(quit).not.toHaveBeenCalled();
  expect(closeService).not.toHaveBeenCalled();
  coordinator.beforeQuit({ preventDefault });
  hasWindow = false;
  coordinator.windowClosed();
  expect(quit).toHaveBeenCalledTimes(1);
  coordinator.beforeQuit({ preventDefault });
  coordinator.beforeQuit({ preventDefault });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(closeService).toHaveBeenCalledTimes(1);
  expect(quit).toHaveBeenCalledTimes(2);
  const committed = vi.fn();
  coordinator.beforeQuit({ preventDefault: committed });
  expect(committed).not.toHaveBeenCalled();
});
