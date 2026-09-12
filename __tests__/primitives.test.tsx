import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogClose,
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "../src/primitives/overlay";
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  CheckboxRoot,
  SwitchRoot,
  RadioGroupRoot,
  RadioGroupItem,
  ToggleRoot,
  ToggleGroupRoot,
  ToggleGroupItem,
} from "../src/primitives/controls";
import { Presence } from "../src/primitives/core";
import { signal } from "sinwan/reactivity";
import { mountUi, setupDom, teardownDom, withSetup } from "./helpers";

beforeEach(() => setupDom());
afterEach(() => teardownDom());

describe("primitives overlays", () => {
  test("dialog tree renders", () => {
    const { root, click, unmount } = mountUi(() => (
      <DialogRoot defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogClose>X</DialogClose>
          Body
        </DialogContent>
      </DialogRoot>
    ));
    expect(root.querySelector('[data-slot="dialog-trigger"]')).toBeTruthy();
    click('[data-slot="dialog-close"]');
    unmount();
  });

  test("collapsible toggles", () => {
    const { root, click, unmount } = mountUi(() => (
      <CollapsibleRoot defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden</CollapsibleContent>
      </CollapsibleRoot>
    ));
    expect(root.querySelector('[data-slot="collapsible-trigger"]')).toBeTruthy();
    click('[data-slot="collapsible-trigger"]');
    unmount();
  });

  test("popover and tooltip roots", () => {
    const { unmount } = mountUi(() => (
      <>
        <PopoverRoot>
          <PopoverTrigger>P</PopoverTrigger>
          <PopoverContent>C</PopoverContent>
        </PopoverRoot>
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger>T</TooltipTrigger>
            <TooltipContent>tip</TooltipContent>
          </TooltipRoot>
        </TooltipProvider>
      </>
    ));
    unmount();
  });

  test("popover positions beside trigger when opened", async () => {
    HTMLElement.prototype.getBoundingClientRect = function getRect() {
      if ((this as HTMLElement).getAttribute("data-slot") === "popover-trigger") {
        return {
          x: 200,
          y: 150,
          width: 80,
          height: 32,
          top: 150,
          left: 200,
          bottom: 182,
          right: 280,
          toJSON() {
            return this;
          },
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        top: 0,
        left: 0,
        bottom: 80,
        right: 120,
        toJSON() {
          return this;
        },
      } as DOMRect;
    };

    const { click, unmount } = mountUi(() => (
      <PopoverRoot>
        <PopoverTrigger>P</PopoverTrigger>
        <PopoverContent>C</PopoverContent>
      </PopoverRoot>
    ));

    click('[data-slot="popover-trigger"]');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const content = document.querySelector(
      '[data-slot="popover-content"]',
    ) as HTMLElement | null;
    expect(content).toBeTruthy();
    expect(content!.style.top).not.toBe("0px");
    expect(Number.parseFloat(content!.style.top)).toBeGreaterThan(150);
    expect(Number.parseFloat(content!.style.left)).toBeGreaterThan(8);
    unmount();
  });

  test("popover content forwards hover keep-alive handlers", async () => {
    let entered = 0;
    let left = 0;
    const { click, unmount } = mountUi(() => (
      <PopoverRoot defaultOpen>
        <PopoverTrigger>P</PopoverTrigger>
        <PopoverContent
          onmouseenter={() => {
            entered += 1;
          }}
          onmouseleave={() => {
            left += 1;
          }}
        >
          C
        </PopoverContent>
      </PopoverRoot>
    ));
    await new Promise((r) => setTimeout(r, 40));
    const content = document.querySelector(
      '[data-slot="popover-content"]',
    ) as HTMLElement | null;
    expect(content).toBeTruthy();
    content!.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    content!.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(entered).toBe(1);
    expect(left).toBe(1);
    click('[data-slot="popover-trigger"]');
    unmount();
  });
});

describe("primitives controls", () => {
  test("tabs accordion checkbox switch radio toggle", () => {
    let tab = "a";
    let checked = false;
    let pressed = false;
    const { click, unmount } = mountUi(() => (
      <>
        <TabsRoot
          defaultValue="a"
          onValueChange={(v) => {
            tab = v;
          }}
        >
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">A panel</TabsContent>
        </TabsRoot>
        <AccordionRoot defaultValue="1">
          <AccordionItem value="1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>Body</AccordionContent>
          </AccordionItem>
        </AccordionRoot>
        <CheckboxRoot
          defaultChecked={false}
          onCheckedChange={(v) => {
            checked = v;
          }}
        >
          ✓
        </CheckboxRoot>
        <SwitchRoot defaultChecked={false} />
        <RadioGroupRoot defaultValue="x">
          <RadioGroupItem value="x">X</RadioGroupItem>
          <RadioGroupItem value="y">Y</RadioGroupItem>
        </RadioGroupRoot>
        <ToggleRoot
          defaultPressed={false}
          onPressedChange={(v) => {
            pressed = v;
          }}
        >
          Bold
        </ToggleRoot>
        <ToggleGroupRoot type="multiple" defaultValue={["a"]}>
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroupRoot>
        {Presence({ present: true, children: "yes" })}
        {Presence({ present: false, children: "no" })}
      </>
    ));
    click('[data-slot="tabs-trigger"][data-state="inactive"]');
    expect(tab).toBe("b");
    click('[data-slot="checkbox"]');
    expect(checked).toBe(true);
    click('[data-slot="toggle"]');
    expect(pressed).toBe(true);
    click('[data-slot="switch"]');
    click('[data-slot="radio-group-item"][data-state="unchecked"]');
    unmount();
  });
});

describe("primitives presence via withSetup", () => {
  test("Presence branches", () => {
    withSetup(() => {
      expect(Presence({ present: true, children: "yes" })).toBeTruthy();
      expect(Presence({ present: false, children: "no" })).toBeTruthy();
    });
  });
});

describe("primitive controlled getter props", () => {
  test("checkbox toggle and toggle-group stay live via getters", async () => {
    const checked = signal(false);
    const pressed = signal(false);
    const group = signal<string | string[]>("");
    const { root, unmount } = mountUi(() => (
      <>
        <CheckboxRoot
          // @ts-expect-error uncompiled live getter
          checked={() => checked.value}
        />
        <CheckboxRoot checked={true} />
        <ToggleRoot
          // @ts-expect-error uncompiled live getter
          pressed={() => pressed.value}
        />
        <ToggleRoot pressed={true} />
        <ToggleGroupRoot
          // @ts-expect-error uncompiled live getter
          value={() => group.value}
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
        </ToggleGroupRoot>
        <ToggleGroupRoot type="multiple" value={["a"]}>
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroupRoot>
        <ToggleGroupRoot />
      </>
    ));

    const flush = async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    };

    const checkboxes = root.querySelectorAll('[data-slot="checkbox"]');
    expect(checkboxes[0]?.getAttribute("data-state")).toBe("unchecked");
    expect(checkboxes[1]?.getAttribute("data-state")).toBe("checked");
    checked.value = false;
    await flush();
    expect(checkboxes[0]?.getAttribute("data-state")).toBe("unchecked");
    checked.value = true;
    await flush();
    expect(checkboxes[0]?.getAttribute("data-state")).toBe("checked");

    const toggles = root.querySelectorAll('[data-slot="toggle"]');
    expect(toggles[0]?.getAttribute("data-state")).toBe("off");
    expect(toggles[1]?.getAttribute("data-state")).toBe("on");
    pressed.value = true;
    await flush();
    expect(toggles[0]?.getAttribute("data-state")).toBe("on");

    const groups = root.querySelectorAll('[data-slot="toggle-group"]');
    const emptyItems = groups[0]!.querySelectorAll(
      '[data-slot="toggle-group-item"]',
    );
    expect(emptyItems[0]?.getAttribute("data-state")).toBe("off");
    group.value = "a";
    await flush();
    expect(emptyItems[0]?.getAttribute("data-state")).toBe("on");
    group.value = ["b"];
    await flush();
    expect(emptyItems[0]?.getAttribute("data-state")).toBe("off");
    expect(emptyItems[1]?.getAttribute("data-state")).toBe("on");
    group.value = ["a", "b"];
    await flush();
    expect(emptyItems[0]?.getAttribute("data-state")).toBe("on");
    expect(emptyItems[1]?.getAttribute("data-state")).toBe("on");

    expect(
      groups[1]
        ?.querySelector('[data-slot="toggle-group-item"]')
        ?.getAttribute("data-state"),
    ).toBe("on");

    unmount();
  });

  test("checkbox indeterminate is mixed and click selects", async () => {
    let nextValue = false;
    const mixed = signal(true);
    const { root, click, unmount } = mountUi(() => (
      <>
        <CheckboxRoot
          checked={false}
          // @ts-expect-error uncompiled live getter
          indeterminate={() => mixed.value}
          onCheckedChange={(value) => {
            nextValue = value;
          }}
        />
        <CheckboxRoot checked={false} indeterminate={true} />
        <CheckboxRoot checked={false} indeterminate={false} disabled />
      </>
    ));
    const boxes = root.querySelectorAll('[data-slot="checkbox"]');
    expect(boxes[0]?.getAttribute("data-state")).toBe("indeterminate");
    expect(boxes[0]?.getAttribute("aria-checked")).toBe("mixed");
    expect(boxes[1]?.getAttribute("data-state")).toBe("indeterminate");
    click('[data-slot="checkbox"]');
    expect(nextValue).toBe(true);
    mixed.value = false;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    boxes[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();
  });
});

describe("controlled control roots", () => {
  test("tabs switch radio accordion and single toggle-group stay live", () => {
    const tab = signal("a");
    const plan = signal("x");
    const enabled = signal(false);
    const openItem = signal("1");
    const align = signal("a");
    const { click, root, unmount } = mountUi(() => (
      <>
        <TabsRoot
          // @ts-expect-error uncompiled live getter
          value={() => tab.value}
          onValueChange={(v) => {
            tab.value = v;
          }}
        >
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsRoot>
        <SwitchRoot
          // @ts-expect-error uncompiled live getter
          checked={() => enabled.value}
          onCheckedChange={(v) => {
            enabled.value = v;
          }}
        />
        <SwitchRoot checked={false} disabled />
        <RadioGroupRoot
          // @ts-expect-error uncompiled live getter
          value={() => plan.value}
          onValueChange={(v) => {
            plan.value = v;
          }}
        >
          <RadioGroupItem value="x">X</RadioGroupItem>
          <RadioGroupItem value="y">Y</RadioGroupItem>
        </RadioGroupRoot>
        <AccordionRoot
          // @ts-expect-error uncompiled live getter
          value={() => openItem.value}
          onValueChange={(v) => {
            if (typeof v === "string") openItem.value = v;
          }}
        >
          <AccordionItem value="1">
            <AccordionTrigger>One</AccordionTrigger>
          </AccordionItem>
        </AccordionRoot>
        <ToggleGroupRoot
          type="single"
          // @ts-expect-error uncompiled live getter
          value={() => align.value}
          onValueChange={(v) => {
            if (typeof v === "string") align.value = v;
          }}
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
          <ToggleGroupItem value="c" disabled>
            C
          </ToggleGroupItem>
        </ToggleGroupRoot>
        <ToggleGroupRoot value="" />
      </>
    ));
    click('[data-slot="tabs-trigger"][data-state="inactive"]');
    expect(tab.value).toBe("b");
    click('[data-slot="switch"]');
    expect(enabled.value).toBe(true);
    root
      .querySelectorAll('[data-slot="switch"]')[1]
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    click('[data-slot="radio-group-item"][data-state="unchecked"]');
    expect(plan.value).toBe("y");
    click('[data-slot="toggle-group-item"][data-state="off"]');
    expect(align.value).toBe("b");
    root
      .querySelector('[data-slot="toggle-group-item"][disabled]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();
  });
});
