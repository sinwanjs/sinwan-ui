import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../src/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../src/components/ui/popover";
import { Button } from "../src/components/ui/button";
import { mountUi, setupDom, teardownDom } from "./helpers";

beforeEach(() => {
  setupDom();
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      x: 10, y: 10, width: 80, height: 32, top: 10, left: 10, bottom: 42, right: 90,
      toJSON() { return this; },
    } as DOMRect;
  };
});
afterEach(() => teardownDom());

const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));

describe("floating open/close cycles", () => {
  test("dialog close removes overlay and can reopen", async () => {
    let open = false;
    const ui = mountUi(() => (
      <Dialog onOpenChange={(v) => { open = v; }}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>
    ));
    for (let i = 0; i < 4; i++) {
      ui.click('[data-slot="dialog-trigger"]');
      await wait();
      expect(open).toBe(true);
      expect(ui.query('[data-slot="dialog-overlay"]')).toBeTruthy();
      ui.click('[data-slot="dialog-close"]');
      await wait(350);
      expect(open).toBe(false);
      expect(ui.query('[data-slot="dialog-overlay"]')).toBeNull();
      expect(ui.query('[data-slot="dialog-content"]')).toBeNull();
    }
    ui.unmount();
  });

  test("popover asChild open/close/open", async () => {
    let open = false;
    const ui = mountUi(() => (
      <Popover onOpenChange={(v) => { open = v; }}>
        <PopoverTrigger asChild>
          <Button>Open</Button>
        </PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));
    for (let i = 0; i < 5; i++) {
      const trig = ui.query("button");
      expect(trig).toBeTruthy();
      trig!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await wait();
      expect(open).toBe(true);
      expect(ui.query('[data-slot="popover-content"]')).toBeTruthy();
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      await wait(300);
      expect(open).toBe(false);
    }
    ui.unmount();
  });

  test("trigger click closes popover without reopen race", async () => {
    let open = false;
    let changes = 0;
    const ui = mountUi(() => (
      <Popover onOpenChange={(v) => { open = v; changes++; }}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));
    const trig = ui.query('[data-slot="popover-trigger"]') as HTMLElement;
    trig.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait();
    expect(open).toBe(true);
    const before = changes;
    // Real browser order: pointerdown then click on trigger
    trig.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    trig.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait();
    expect(open).toBe(false);
    expect(changes).toBe(before + 1);
    ui.unmount();
  });
});
