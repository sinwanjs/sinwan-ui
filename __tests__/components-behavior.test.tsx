import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Button } from "../src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../src/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "../src/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "../src/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../src/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { Checkbox } from "../src/components/ui/checkbox";
import { Switch } from "../src/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../src/components/ui/radio-group";
import { Toggle } from "../src/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "../src/components/ui/toggle-group";
import { signal } from "sinwan/reactivity";
import { Calendar } from "../src/components/ui/calendar";
import { Progress } from "../src/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import {
  ChartBar,
  ChartContainer,
  ChartLine,
  ChartArea,
  ChartPie,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "../src/components/ui/chart";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../src/components/ui/input-otp";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "../src/components/ui/carousel";
import { toast, Toaster } from "../src/components/ui/sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  useSidebar,
} from "../src/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../src/components/ui/resizable";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../src/components/ui/command";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "../src/components/ui/combobox";
import {
  asVNode,
  lastResizeObserver,
  mountUi,
  setupDom,
  teardownDom,
  withSetup,
} from "./helpers";

beforeEach(() => {
  setupDom();
  localStorage.clear();
});
afterEach(() => teardownDom());

describe("Button behavior", () => {
  test("variants loading disabled and asChild", () => {
    const variants = [
      "default",
      "outline",
      "secondary",
      "ghost",
      "destructive",
      "link",
      "gradient",
    ] as const;
    const { root, unmount } = mountUi(() => (
      <>
        {variants.map((variant) => (
          <Button variant={variant}>{variant}</Button>
        ))}
        <Button isLoading>Save</Button>
        <Button disabled>Nope</Button>
        <Button asChild disabled>
          <a href="#">Link</a>
        </Button>
      </>
    ));
    expect(root.querySelectorAll('[data-slot="button"]').length).toBeGreaterThan(5);
    expect(root.querySelector("[aria-busy]")).toBeTruthy();
    expect(root.querySelector("a[aria-disabled]")).toBeTruthy();
    const disabledChild = root.querySelector("a[aria-disabled]") as HTMLElement;
    disabledChild.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();

    withSetup(() => {
      const disabled = asVNode(Button({ disabled: true, children: "x" }));
      const evt = new Event("click");
      let prevented = false;
      Object.defineProperty(evt, "preventDefault", {
        value: () => {
          prevented = true;
        },
      });
      Object.defineProperty(evt, "stopPropagation", { value: () => { } });
      (disabled.props.onclick as (e: Event) => void)(evt);
      expect(prevented).toBe(true);

      const loading = asVNode(Button({ isLoading: true, children: "y" }));
      const busy = loading.props["aria-busy"];
      expect(typeof busy === "function" ? (busy as () => unknown)() : busy).toBe(
        true,
      );
      (loading.props.onclick as (e: Event) => void)(evt);
    });
  });

  test("isLoading getter does not disable before the signal is true", async () => {
    const loading = signal(false);
    let clicks = 0;
    const { query, unmount } = mountUi(() => (
      <Button
        // @ts-expect-error uncompiled live getter
        isLoading={() => loading.value}
        onclick={() => {
          clicks += 1;
          loading.value = true;
        }}
      >
        {() => (loading.value ? "Saving…" : "Save")}
      </Button>
    ));
    const btn = query("[data-slot=button]") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-busy")).toBeNull();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(clicks).toBe(1);
    expect(btn.disabled).toBe(true);
    expect(btn.hasAttribute("aria-busy")).toBe(true);
    expect(btn.textContent).toContain("Saving");
    unmount();
  });

  test("variant getter updates class without remounting", async () => {
    const theme = signal("light");
    const { query, unmount } = mountUi(() => (
      <Button
        // @ts-expect-error uncompiled live getter
        variant={() => (theme.value === "dark" ? "default" : "outline")}
        // @ts-expect-error uncompiled live getter
        size={() => (theme.value === "dark" ? "lg" : "sm")}
      >
        Dark
      </Button>
    ));
    const btn = query("[data-slot=button]") as HTMLButtonElement;
    expect(btn.getAttribute("data-variant")).toBe("outline");
    expect(btn.getAttribute("data-size")).toBe("sm");
    theme.value = "dark";
    await Promise.resolve();
    await Promise.resolve();
    expect(btn.getAttribute("data-variant")).toBe("default");
    expect(btn.getAttribute("data-size")).toBe("lg");
    unmount();
  });

  test("disabled getter and idle click without onclick stay enabled", async () => {
    const off = signal(false);
    const { query, unmount } = mountUi(() => (
      // @ts-expect-error uncompiled live getter
      <Button disabled={() => off.value}>Idle</Button>
    ));
    const btn = query("[data-slot=button]") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    off.value = true;
    await Promise.resolve();
    await Promise.resolve();
    expect(btn.disabled).toBe(true);
    unmount();
  });

  test("asChild getter variant and enabled click", async () => {
    const theme = signal("light");
    let clicks = 0;
    const { query, unmount } = mountUi(() => (
      <Button
        asChild
        // @ts-expect-error uncompiled live getter
        variant={() => (theme.value === "dark" ? "default" : "outline")}
        onclick={() => {
          clicks += 1;
        }}
      >
        <a href="#open" class="child-link">
          Open
        </a>
      </Button>
    ));
    const link = query("[data-slot=button]") as HTMLAnchorElement;
    expect(link.getAttribute("data-variant")).toBe("outline");
    expect(link.className).toContain("child-link");
    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicks).toBe(1);
    theme.value = "dark";
    await Promise.resolve();
    await Promise.resolve();
    expect(link.getAttribute("data-variant")).toBe("default");
    unmount();
  });
});

describe("Dialog Sheet AlertDialog", () => {
  test("open and close via triggers", () => {
    let dialogOpen = true;
    const d = mountUi(() => (
      <Dialog
        defaultOpen
        onOpenChange={(v) => {
          dialogOpen = v;
        }}
      >
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>
    ));
    const close =
      d.query('[data-slot="dialog-close"]') ??
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Close"),
      );
    expect(close).toBeTruthy();
    close!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialogOpen).toBe(false);
    d.unmount();

    let sheetOpen = true;
    const s = mountUi(() => (
      <Sheet
        defaultOpen
        onOpenChange={(v) => {
          sheetOpen = v;
        }}
      >
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent showCloseButton={false}>
          <SheetTitle>Sheet</SheetTitle>
          <SheetClose>Close</SheetClose>
        </SheetContent>
      </Sheet>
    ));
    const sheetClose = s.query('[data-slot="dialog-close"]');
    expect(sheetClose).toBeTruthy();
    sheetClose!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(sheetOpen).toBe(false);
    s.unmount();

    let alertOpen = true;
    const a = mountUi(() => (
      <AlertDialog
        defaultOpen
        onOpenChange={(v) => {
          alertOpen = v;
        }}
      >
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Sure?</AlertDialogTitle>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    ));
    const cancel = a.query('[data-slot="alert-dialog-cancel"]');
    expect(cancel).toBeTruthy();
    cancel!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(alertOpen).toBe(false);
    a.unmount();

    let opened = false;
    const o = mountUi(() => (
      <Dialog
        defaultOpen={false}
        onOpenChange={(v) => {
          opened = v;
        }}
      >
        <DialogTrigger>Open</DialogTrigger>
      </Dialog>
    ));
    o.click('[data-slot="dialog-trigger"]');
    expect(opened).toBe(true);
    o.unmount();
  });
});

describe("Drawer inset", () => {
  test("content is inset from the viewport with all corners rounded", () => {
    const bottom = mountUi(() => (
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerTitle>Bottom</DrawerTitle>
        </DrawerContent>
      </Drawer>
    ));
    const bottomPanel = bottom.query(
      '[data-slot="drawer-content"]',
    ) as HTMLElement;
    expect(bottomPanel.className).toContain("rounded-xl");
    expect(bottomPanel.className).toContain("inset-x-4");
    expect(bottomPanel.className).toContain("bottom-4");
    expect(bottomPanel.className).not.toContain("inset-x-0");
    expect(bottomPanel.className).not.toContain("rounded-t-xl");
    bottom.unmount();

    const side = mountUi(() => (
      <Drawer defaultOpen>
        <DrawerContent direction="left">
          <DrawerTitle>Left</DrawerTitle>
        </DrawerContent>
      </Drawer>
    ));
    const sidePanel = side.query(
      '[data-slot="drawer-content"]',
    ) as HTMLElement;
    expect(sidePanel.getAttribute("data-vaul-drawer-direction")).toBe("left");
    expect(sidePanel.className).toContain("rounded-xl");
    expect(sidePanel.className).toContain("inset-y-4");
    expect(sidePanel.className).toContain("left-4");
    expect(sidePanel.className).not.toContain("inset-y-0");
    expect(sidePanel.className).not.toContain("rounded-r-xl");
    side.unmount();
  });
});

describe("Select Tabs Checkbox Switch Toggle", () => {
  test("select open and pick item", () => {
    let picked = "";
    const { click, unmount } = mountUi(() => (
      <Select
        defaultOpen
        onValueChange={(v) => {
          picked = v;
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="pear">Pear</SelectItem>
        </SelectContent>
      </Select>
    ));
    const items = document.querySelectorAll('[data-slot="select-item"]');
    expect(items.length).toBeGreaterThan(0);
    (items[1] as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(picked).toBe("pear");
    void click;
    unmount();
  });

  test("select mapped item value is a string, not a compiler getter", () => {
    const options = [
      { value: "est", label: "Eastern" },
      { value: "pst", label: "Pacific" },
    ];
    let picked: unknown = "";
    const { unmount } = mountUi(() => (
      <Select
        defaultOpen
        onValueChange={(v) => {
          picked = v;
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem
              // @ts-expect-error uncompiled live getter
              value={() => item.value}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ));
    const items = document.querySelectorAll('[data-slot="select-item"]');
    expect(items.length).toBe(2);
    (items[1] as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(picked).toBe("pst");
    expect(typeof picked).toBe("string");
    unmount();
  });

  test("hides scroll chevrons when the list fits", () => {
    const { unmount } = mountUi(() => (
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>
    ));
    expect(
      document
        .querySelector('[data-slot="select-scroll-up-button"]')
        ?.getAttribute("data-state"),
    ).toBe("hidden");
    expect(
      document
        .querySelector('[data-slot="select-scroll-down-button"]')
        ?.getAttribute("data-state"),
    ).toBe("hidden");
    unmount();
  });

  test("pins overflow chevrons and auto-scrolls while held", async () => {
    const { unmount } = mountUi(() => (
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent class="w-48" position="item-aligned" align="start">
          <SelectGroup class="tz-group">
            <SelectLabel class="tz-label">Group</SelectLabel>
            <SelectItem value="a">A</SelectItem>
            <SelectItem value="b">B</SelectItem>
            <SelectItem value="c">C</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    ));
    const content = document.querySelector(
      '[data-slot="select-content"]',
    ) as HTMLElement;
    const viewport = document.querySelector(
      '[data-slot="select-viewport"]',
    ) as HTMLElement;
    expect(content.getAttribute("data-align-trigger")).toBe("");
    Object.defineProperty(viewport, "clientHeight", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(viewport, "scrollHeight", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(viewport, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    });
    lastResizeObserver?.trigger([]);
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const upBtn = document.querySelector(
      '[data-slot="select-scroll-up-button"]',
    ) as HTMLElement;
    const downBtn = document.querySelector(
      '[data-slot="select-scroll-down-button"]',
    ) as HTMLElement;
    expect(downBtn.getAttribute("data-state")).toBe("visible");
    expect(upBtn.getAttribute("data-state")).toBe("hidden");
    expect(viewport.parentElement).toBe(content);
    expect(downBtn.parentElement).toBe(content);
    upBtn.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(viewport.scrollTop).toBe(0);

    viewport.scrollTop = 80;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(upBtn.getAttribute("data-state")).toBe("visible");
    expect(downBtn.getAttribute("data-state")).toBe("visible");

    viewport.scrollTop = 300;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(upBtn.getAttribute("data-state")).toBe("visible");
    expect(downBtn.getAttribute("data-state")).toBe("hidden");
    downBtn.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(viewport.scrollTop).toBe(300);

    viewport.scrollTop = 80;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    downBtn.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(viewport.scrollTop).toBeGreaterThan(80);
    window.dispatchEvent(new Event("pointerup"));
    const stopped = viewport.scrollTop;
    await new Promise((r) => setTimeout(r, 0));
    expect(viewport.scrollTop).toBe(stopped);

    upBtn.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
    window.dispatchEvent(new Event("pointercancel"));

    downBtn.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
    const trigger = document.querySelector(
      '[data-slot="select-trigger"]',
    ) as HTMLElement;
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    unmount();
  });

  test("empty select content still mounts a viewport", async () => {
    const { unmount } = mountUi(() => (
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent />
      </Select>
    ));
    expect(document.querySelector('[data-slot="select-viewport"]')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
    unmount();
  });

  test("tabs switch values", () => {
    let value = "a";
    const { click, unmount } = mountUi(() => (
      <Tabs
        defaultValue="a"
        onValueChange={(v) => {
          value = v;
        }}
      >
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A panel</TabsContent>
        <TabsContent value="b">B panel</TabsContent>
      </Tabs>
    ));
    click('[data-slot="tabs-trigger"][data-state="inactive"]');
    expect(value).toBe("b");
    unmount();
  });

  test("tabs line variant and vertical orientation attrs", () => {
    const line = mountUi(() => (
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">metrics</TabsContent>
      </Tabs>
    ));
    const lineRoot = line.root.querySelector('[data-slot="tabs"]');
    expect(lineRoot?.getAttribute("data-orientation")).toBe("horizontal");
    expect(lineRoot?.hasAttribute("data-horizontal")).toBe(true);
    expect(lineRoot?.hasAttribute("data-vertical")).toBe(false);
    const lineList = line.root.querySelector('[data-slot="tabs-list"]');
    expect(lineList?.getAttribute("data-variant")).toBe("line");
    expect(lineList?.className).toContain("bg-transparent");
    const lineTrigger = line.root.querySelector(
      '[data-slot="tabs-trigger"][data-state="active"]',
    );
    expect(lineTrigger?.className).toContain("after:content-['']");
    expect(lineTrigger?.className).toContain(
      "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
    );
    line.unmount();

    const vertical = mountUi(() => (
      <Tabs defaultValue="general" orientation="vertical">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="general">workspace</TabsContent>
      </Tabs>
    ));
    const verticalRoot = vertical.root.querySelector('[data-slot="tabs"]');
    expect(verticalRoot?.getAttribute("data-orientation")).toBe("vertical");
    expect(verticalRoot?.hasAttribute("data-vertical")).toBe(true);
    expect(verticalRoot?.hasAttribute("data-horizontal")).toBe(false);
    expect(verticalRoot?.className.split(/\s+/)).toContain("flex-row");
    const verticalList = vertical.root.querySelector('[data-slot="tabs-list"]');
    expect(verticalList?.className).toContain("group-data-vertical/tabs:flex-col");
    vertical.unmount();
  });

  test("checkbox switch toggle click", async () => {
    let checked = false;
    let on = false;
    let pressed = false;
    let plan = "a";
    const { click, root, unmount } = mountUi(() => (
      <>
        <Checkbox
          defaultChecked={false}
          onCheckedChange={(v) => {
            checked = v;
          }}
        />
        <Switch
          defaultChecked={false}
          onCheckedChange={(v) => {
            on = v;
          }}
        />
        <Toggle
          defaultPressed={false}
          onPressedChange={(v) => {
            pressed = v;
          }}
        >
          Bold
        </Toggle>
        <RadioGroup
          defaultValue="a"
          onValueChange={(v) => {
            plan = v;
          }}
        >
          <RadioGroupItem value="a" id="rg-a" />
          <RadioGroupItem value="b" id="rg-b" />
        </RadioGroup>
      </>
    ));
    const sw = root.querySelector('[data-slot="switch"]') as HTMLElement;
    expect(sw.className).toContain("border-input");
    expect(sw.getAttribute("data-state")).toBe("unchecked");
    const indicator = root.querySelector('[data-slot="checkbox-indicator"]');
    expect(indicator?.className).toContain("[&_svg]:size-3.5");
    expect(indicator?.className).toContain("[[data-state=unchecked]_&]:hidden");
    expect(indicator?.className).not.toContain("[&>svg]:size-3.5");
    click('[data-slot="checkbox"]');
    expect(checked).toBe(true);
    click('[data-slot="switch"]');
    expect(on).toBe(true);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.getAttribute("data-state")).toBe("checked");
    click('[data-slot="toggle"]');
    expect(pressed).toBe(true);
    const radioA = root.querySelector("#rg-a") as HTMLElement;
    const radioB = root.querySelector("#rg-b") as HTMLElement;
    expect(radioA.getAttribute("data-state")).toBe("checked");
    expect(radioB.getAttribute("data-state")).toBe("unchecked");
    click("#rg-b");
    expect(plan).toBe("b");
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(radioB.getAttribute("data-state")).toBe("checked");
    unmount();
  });

  test("checkbox toggle and toggle-group stay live via getters", async () => {
    const checked = signal(false);
    const pressed = signal(false);
    const group = signal<string | string[]>("a");
    const { root, unmount } = mountUi(() => (
      <>
        <Checkbox
          // @ts-expect-error uncompiled live getter
          checked={() => checked.value}
        />
        <Toggle
          // @ts-expect-error uncompiled live getter
          pressed={() => pressed.value}
        >
          Bold
        </Toggle>
        <ToggleGroup
          type="single"
          // @ts-expect-error uncompiled live getter
          value={() => group.value}
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
        </ToggleGroup>
      </>
    ));
    expect(
      root.querySelector('[data-slot="checkbox"]')?.getAttribute("data-state"),
    ).toBe("unchecked");
    expect(
      root.querySelector('[data-slot="toggle"]')?.getAttribute("data-state"),
    ).toBe("off");
    const items = root.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items[0]?.getAttribute("data-state")).toBe("on");
    expect(items[1]?.getAttribute("data-state")).toBe("off");
    checked.value = true;
    pressed.value = true;
    group.value = "b";
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(
      root.querySelector('[data-slot="checkbox"]')?.getAttribute("data-state"),
    ).toBe("checked");
    expect(
      root.querySelector('[data-slot="toggle"]')?.getAttribute("data-state"),
    ).toBe("on");
    expect(items[0]?.getAttribute("data-state")).toBe("off");
    expect(items[1]?.getAttribute("data-state")).toBe("on");
    unmount();
  });

  test("checkbox indeterminate shows mixed indicator", async () => {
    const mixed = signal(true);
    const { root, click, unmount } = mountUi(() => (
      // @ts-expect-error uncompiled live getter
      <Checkbox aria-label="Mixed" checked={false} indeterminate={() => mixed.value} />
    ));
    const box = root.querySelector('[data-slot="checkbox"]');
    expect(box?.getAttribute("data-state")).toBe("indeterminate");
    const indicator = box?.querySelector('[data-slot="checkbox-indicator"]');
    expect(indicator?.className).toContain("[&_svg]:size-3.5");
    const mixedIcon = indicator?.querySelector(":scope > span.hidden");
    expect(mixedIcon).toBeTruthy();
    expect(mixedIcon?.querySelector("svg")).toBeTruthy();
    click('[data-slot="checkbox"]');
    mixed.value = false;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    unmount();
  });
});

describe("Calendar Chart InputOTP Carousel", () => {
  test("calendar month and day click", () => {
    let selected: Date | undefined;
    let month: Date | undefined;
    const { root, click, unmount } = mountUi(() => (
      <Calendar
        month={new Date(2024, 0, 1)}
        showOutsideDays
        locale={{ code: "en-US" }}
        onSelect={(d) => {
          selected = d instanceof Date ? d : undefined;
        }}
        onMonthChange={(m) => {
          month = m;
        }}
        disabled={(d) => d.getDate() === 1}
      />
    ));
    click('[aria-label="Previous month"]');
    expect(month?.getMonth()).toBe(11);
    click('[aria-label="Next month"]');
    click('[aria-label="Next month"]');
    expect(month?.getMonth()).toBe(1);
    const day = Array.from(root.querySelectorAll("button")).find(
      (b) => b.textContent === "15" && !(b as HTMLButtonElement).disabled,
    );
    day?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(selected?.getDate()).toBe(15);
    unmount();

    const hidden = mountUi(() => (
      <Calendar month={new Date(2024, 0, 1)} showOutsideDays={false} disabled />
    ));
    hidden.unmount();
  });

  test("calendar range multiple weeks dropdown timezone and modifiers", () => {
    let range: Date | Date[] | { from?: Date; to?: Date } | undefined;
    const booked = [new Date(2024, 5, 12), new Date(2024, 5, 13)];
    const { root, click, unmount } = mountUi(() => (
      <Calendar
        mode="range"
        month={new Date(2024, 5, 1)}
        numberOfMonths={2}
        showWeekNumber
        captionLayout="dropdown"
        weekStartsOn={1}
        fromYear={2023}
        toYear={2025}
        timeZone="UTC"
        dir="rtl"
        locale="en-GB"
        disabled={booked}
        modifiers={{ booked }}
        modifiersClassNames={{ booked: "line-through" }}
        renderDay={(ctx) => (ctx.disabled ? <span>x</span> : null)}
        onSelect={(value) => {
          range = value;
        }}
      />
    ));
    expect(root.querySelector('[data-slot="calendar"]')?.getAttribute("dir")).toBe(
      "rtl",
    );
    expect(root.querySelector('[aria-label="Month"]')).toBeTruthy();
    const enabled = Array.from(root.querySelectorAll("button")).filter(
      (button) =>
        /^\d+$/.test(button.textContent ?? "") &&
        !(button as HTMLButtonElement).disabled,
    );
    enabled[4]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    enabled[10]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(range && "from" in range && range.from).toBeTruthy();
    expect(range && "to" in range && range.to).toBeTruthy();
    const monthSelect = root.querySelector(
      '[aria-label="Month"]',
    ) as HTMLSelectElement;
    monthSelect.value = "0";
    monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
    const yearSelect = root.querySelector(
      '[aria-label="Year"]',
    ) as HTMLSelectElement;
    yearSelect.value = "2025";
    yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
    void click;
    unmount();

    let many: Date | Date[] | { from?: Date; to?: Date } | undefined = [];
    const multi = mountUi(() => (
      <Calendar
        mode="multiple"
        month={new Date(2024, 0, 1)}
        onSelect={(value) => {
          many = value;
        }}
      />
    ));
    const multiDays = Array.from(multi.root.querySelectorAll("button")).filter(
      (button) =>
        /^\d+$/.test(button.textContent ?? "") &&
        !(button as HTMLButtonElement).disabled,
    );
    multiDays[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    multiDays[3]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    multiDays[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(Array.isArray(many)).toBe(true);
    multi.unmount();

    let single: Date | Date[] | { from?: Date; to?: Date } | undefined;
    const one = mountUi(() => (
      <Calendar
        month={new Date(2024, 0, 1)}
        selected={new Date(2024, 0, 15)}
        disabled={(date) => date.getDate() === 2}
        onSelect={(value) => {
          single = value;
        }}
      />
    ));
    const day15 = Array.from(one.root.querySelectorAll("button")).find(
      (button) => button.textContent === "15",
    );
    day15?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(single).toBeUndefined();
    const day2 = Array.from(one.root.querySelectorAll("button")).find(
      (button) => button.textContent === "2",
    );
    day2?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const day16 = Array.from(one.root.querySelectorAll("button")).find(
      (button) => button.textContent === "16",
    );
    day16?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(single instanceof Date).toBe(true);
    one.unmount();

    let reverse: Date | Date[] | { from?: Date; to?: Date } | undefined;
    const swap = mountUi(() => (
      <Calendar
        mode="range"
        month={new Date(2024, 0, 1)}
        locale="en-US"
        modifiers={{
          weekend: (date) => date.getDay() === 0 || date.getDay() === 6,
        }}
        modifiersClassNames={{
          weekend: "opacity-80",
          unused: "hidden",
        }}
        onSelect={(value) => {
          reverse = value;
        }}
      />
    ));
    const jan20 = swap.root.querySelector(
      `[data-day="${new Date(2024, 0, 20).toLocaleDateString("en-US")}"]`,
    );
    jan20?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const jan25 = swap.root.querySelector(
      `[data-day="${new Date(2024, 0, 25).toLocaleDateString("en-US")}"]`,
    );
    jan25?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(reverse && "to" in reverse && reverse.to?.getDate()).toBe(25);
    jan20?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const jan5 = swap.root.querySelector(
      `[data-day="${new Date(2024, 0, 5).toLocaleDateString("en-US")}"]`,
    );
    jan5?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(reverse && "from" in reverse && reverse.from?.getDate()).toBe(5);
    expect(reverse && "to" in reverse && reverse.to?.getDate()).toBe(20);
    swap.unmount();

    const extras = mountUi(() => (
      <Calendar
        mode="multiple"
        numberOfMonths={0}
        captionLayout="dropdown"
        buttonVariant="outline"
        locale={{}}
        selected={[new Date(2024, 0, 8)]}
        disabled={false}
      />
    ));
    expect(extras.root.querySelector('[aria-label="Month"]')).toBeTruthy();
    extras.unmount();

    const ranged = mountUi(() => (
      <Calendar
        mode="range"
        month={new Date(2024, 0, 1)}
        selected={{ from: new Date(2024, 0, 10), to: new Date(2024, 0, 18) }}
      />
    ));
    expect(
      ranged.root.querySelector('[data-range-middle="true"]'),
    ).toBeTruthy();
    ranged.unmount();

    const hijri = mountUi(() => (
      <Calendar
        locale="ar-SA"
        calendar="islamic-umalqura"
        dir="rtl"
        weekStartsOn={6}
        month={new Date(2026, 8, 13)}
        captionLayout="dropdown"
        onMonthChange={() => { }}
      />
    ));
    expect(hijri.root.querySelector('[data-calendar="islamic-umalqura"]')).toBeTruthy();
    const hijriDays = Array.from(hijri.root.querySelectorAll("[data-day]"));
    expect(hijriDays.some((button) => /[٠-٩]/.test(button.textContent ?? ""))).toBe(
      true,
    );
    hijri.click('[aria-label="Previous month"]');
    hijri.click('[aria-label="Next month"]');
    const hijriMonth = hijri.root.querySelector(
      '[aria-label="Month"]',
    ) as HTMLSelectElement;
    hijriMonth.value = "1";
    hijriMonth.dispatchEvent(new Event("change", { bubbles: true }));
    const hijriYear = hijri.root.querySelector(
      '[aria-label="Year"]',
    ) as HTMLSelectElement;
    const otherYear = Array.from(hijriYear.options).find(
      (option) => option.value !== hijriYear.value,
    );
    if (otherYear) {
      hijriYear.value = otherYear.value;
      hijriYear.dispatchEvent(new Event("change", { bubbles: true }));
    }
    hijri.unmount();

    const arabicGregory = mountUi(() => (
      <Calendar
        locale="ar-SA"
        calendar="gregory"
        month={new Date(2026, 8, 13)}
      />
    ));
    expect(arabicGregory.root.textContent).toContain("١٣");
    arabicGregory.unmount();

    const jalali = mountUi(() => (
      <Calendar
        locale="fa-IR"
        calendar="persian"
        month={new Date(2026, 8, 13)}
        captionLayout="dropdown"
      />
    ));
    const jalaliMonth = jalali.root.querySelector(
      '[aria-label="Month"]',
    ) as HTMLSelectElement;
    jalaliMonth.value = "7";
    jalaliMonth.dispatchEvent(new Event("change", { bubbles: true }));
    jalali.unmount();

    const isoCal = mountUi(() => (
      <Calendar calendar="iso8601" month={new Date(2024, 0, 1)} />
    ));
    isoCal.unmount();
  });

  test("chart container with series", () => {
    const config = {
      sales: { label: "Sales", color: "#3366ff" },
      revenue: {
        label: "Revenue",
        theme: { light: "#111", dark: "#fff" },
        icon: () => <span>i</span>,
      },
    };
    const { root, unmount } = mountUi(() => (
      <ChartContainer
        config={config}
        id="demo"
        initialDimension={{ width: 240, height: 120 }}
      >
        <ChartBar
          data={[
            { m: "a", sales: 10 },
            { m: "b", sales: 0 },
            { m: "c", sales: 30 },
          ]}
          dataKey="sales"
          gap={4}
        />
        <ChartLine data={[{ m: "a", sales: 1 }]} dataKey="sales" strokeWidth={2} />
        <ChartLine data={[]} dataKey="sales" />
        <ChartArea
          data={[
            { m: "a", sales: 5 },
            { m: "b", sales: 15 },
          ]}
          dataKey="sales"
          fill
        />
        <ChartPie
          data={[
            { key: "a", value: 40 },
            { key: "b", value: 60 },
          ]}
        />
        <ChartTooltip active>
          <ChartTooltipContent
            active
            indicator="line"
            label="sales"
            labelFormatter={(v) => String(v)}
            formatter={(v, name) => `${name}:${v}`}
            payload={[
              { name: "sales", dataKey: "sales", value: 10, type: "none" },
              {
                name: "revenue",
                dataKey: "revenue",
                value: 20,
                color: "#0f0",
                payload: { fill: "#abc" },
              },
            ]}
          />
        </ChartTooltip>
        <ChartTooltipContent
          active
          indicator="dashed"
          hideLabel
          payload={[{ name: "sales", dataKey: "sales", value: 3 }]}
        />
        <ChartLegend>
          <ChartLegendContent
            payload={[
              { value: "sales", dataKey: "sales", color: "#00f" },
              { value: "revenue", dataKey: "revenue", color: "#0f0" },
            ]}
          />
        </ChartLegend>
      </ChartContainer>
    ));
    expect(root.querySelector('[data-slot="chart"]')).toBeTruthy();
    expect(root.querySelector('[data-slot="chart-bar"]')).toBeTruthy();
    unmount();
  });

  test("input otp type chars", () => {
    let value = "";
    let complete = "";
    const { root, unmount } = mountUi(() => (
      <InputOTP
        maxLength={4}
        pattern="[0-9]"
        onChange={(v) => {
          value = v;
        }}
        onComplete={(v) => {
          complete = v;
        }}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    ));
    const input = root.querySelector(
      '[data-slot="input-otp-hidden"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "12ab34";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(value).toBe("1234");
    expect(complete).toBe("1234");
    input.focus();
    input.blur();
    root
      .querySelector('[data-slot="input-otp"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();
  });

  test("carousel next prev", () => {
    let api: CarouselApi | undefined;
    const { root, click, unmount } = mountUi(() => (
      <Carousel
        opts={{ startIndex: 0, loop: true }}
        setApi={(a) => {
          api = a;
        }}
      >
        <CarouselContent>
          <CarouselItem>1</CarouselItem>
          <CarouselItem>2</CarouselItem>
          <CarouselItem>3</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    ));
    expect(api).toBeDefined();
    expect(api!.index.value).toBe(0);
    api!.scrollNext();
    expect(api!.index.value).toBe(1);
    api!.scrollPrev();
    expect(api!.index.value).toBe(0);
    click('[data-slot="carousel-next"]');
    root
      .querySelector('[data-slot="carousel"]')
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    root
      .querySelector('[data-slot="carousel"]')
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    unmount();
  });

  test("progress indicator width follows value", async () => {
    const n = signal(35);
    const { root, unmount } = mountUi(() => (
      <Progress
        // @ts-expect-error uncompiled live getter
        value={() => n.value}
      />
    ));
    const track = root.querySelector('[data-slot="progress"]') as HTMLElement;
    const bar = root.querySelector(
      '[data-slot="progress-indicator"]',
    ) as HTMLElement;
    expect(track.getAttribute("aria-valuenow")).toBe("35");
    expect(bar.getAttribute("style")).toContain("35%");
    expect(bar.className.includes("size-full")).toBe(false);
    expect(bar.className.includes("flex-1")).toBe(false);
    n.value = 50;
    await Promise.resolve();
    await Promise.resolve();
    expect(track.getAttribute("aria-valuenow")).toBe("50");
    expect(bar.getAttribute("style")).toContain("50%");
    unmount();

    const zero = mountUi(() => <Progress value={0} />);
    expect(
      zero.root.querySelector('[data-slot="progress"]')?.getAttribute("aria-valuenow"),
    ).toBe("0");
    expect(
      (
        zero.root.querySelector(
          '[data-slot="progress-indicator"]',
        ) as HTMLElement
      ).getAttribute("style"),
    ).toContain("0%");
    zero.unmount();

    const empty = mountUi(() => <Progress />);
    expect(
      empty.root
        .querySelector('[data-slot="progress"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");
    empty.unmount();

    const clamped = mountUi(() => (
      <>
        <Progress value={-10} />
        <Progress value={150} />
        <Progress value={Number.NaN} />
        <Progress value={"x" as unknown as number} />
      </>
    ));
    const nows = Array.from(
      clamped.root.querySelectorAll('[data-slot="progress"]'),
    ).map((el) => el.getAttribute("aria-valuenow"));
    expect(nows).toEqual(["0", "100", "0", "0"]);
    clamped.unmount();
  });
});

describe("Dropdown menu checkbox radio submenu", () => {
  test("checkbox toggles live checked and stays open", async () => {
    const checked = signal(true);
    const { unmount } = mountUi(() => (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem
            // @ts-expect-error uncompiled live getter
            checked={() => checked.value}
            onCheckedChange={(v) => {
              checked.value = v;
            }}
            inset
          >
            Status
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem disabled checked>
            Locked
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ));
    await new Promise((r) => setTimeout(r, 10));
    const items = document.querySelectorAll(
      '[data-slot="dropdown-menu-checkbox-item"]',
    );
    const item = items[0] as HTMLElement;
    expect(item.getAttribute("aria-checked")).toBe("true");
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(checked.value).toBe(false);
    expect(item.getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBeTruthy();
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(checked.value).toBe(true);
    expect(item.getAttribute("aria-checked")).toBe("true");
    (items[1] as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    unmount();
  });

  test("radio selection updates without remounting the menu", async () => {
    const position = signal("bottom");
    const { unmount } = mountUi(() => (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Position</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup
            // @ts-expect-error uncompiled live getter
            value={() => position.value}
            onValueChange={(v) => {
              position.value = v;
            }}
          >
            <DropdownMenuRadioItem value="top" inset>
              Top
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="right" disabled>
              Right
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ));
    await new Promise((r) => setTimeout(r, 10));
    const content = document.querySelector(
      '[data-slot="dropdown-menu-content"]',
    );
    const radios = document.querySelectorAll(
      '[data-slot="dropdown-menu-radio-item"]',
    );
    expect((radios[1] as HTMLElement).getAttribute("aria-checked")).toBe(
      "true",
    );
    (radios[0] as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(position.value).toBe("top");
    expect((radios[0] as HTMLElement).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBe(
      content,
    );
    (radios[2] as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(position.value).toBe("top");
    unmount();
  });

  test("submenu opens beside the trigger and is not clipped by the parent", async () => {
    const subOpen = signal(false);
    const { unmount } = mountUi(() => (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>More</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>New tab</DropdownMenuItem>
          <DropdownMenuSub
            // @ts-expect-error uncompiled live getter
            open={() => subOpen.value}
            onOpenChange={(next) => {
              subOpen.value = next;
            }}
          >
            <DropdownMenuSubTrigger inset>Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Email</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    ));
    await new Promise((r) => setTimeout(r, 10));
    const parent = document.querySelector(
      '[data-slot="dropdown-menu-content"]',
    ) as HTMLElement;
    const trigger = document.querySelector(
      '[data-slot="dropdown-menu-sub-trigger"]',
    ) as HTMLElement;
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    const sub = document.querySelector(
      '[data-slot="dropdown-menu-sub-content"]',
    ) as HTMLElement;
    expect(sub).toBeTruthy();
    expect(parent.contains(sub)).toBe(false);
    expect(sub.style.position).toBe("fixed");
    const email = sub.querySelector(
      '[data-slot="dropdown-menu-item"]',
    ) as HTMLElement;
    email.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    email.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBe(
      parent,
    );
    expect(document.querySelector('[data-slot="dropdown-menu-sub-content"]')).toBe(
      sub,
    );
    sub.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('[data-slot="dropdown-menu-sub-content"]')).toBe(
      sub,
    );
    sub.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    expect(
      document.querySelector('[data-slot="dropdown-menu-sub-content"]'),
    ).toBeNull();
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(
      document.querySelector('[data-slot="dropdown-menu-sub-content"]'),
    ).toBeTruthy();
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(
      document.querySelector('[data-slot="dropdown-menu-sub-content"]'),
    ).toBeNull();
    unmount();
  });
});

describe("Toast Sidebar Resizable Command Combobox", () => {
  test("toast via sonner re-exports", () => {
    toast("hello");
    toast.success({ title: "ok", description: "done" });
    toast.error("bad");
    toast.info("info");
    toast.warning("warn");
    const id = toast.loading("load");
    toast.dismiss(id);
    toast("again");
    const { query, click, unmount } = mountUi(() => (
      <Toaster position="top-center" />
    ));
    expect(query('[data-slot="toaster"]')).toBeTruthy();
    expect(query('[data-slot="toast"]')).toBeTruthy();
    click('[aria-label="Dismiss"]');
    toast.dismiss();
    unmount();
  });

  test("sidebar provider and trigger", () => {
    let toggled = false;
    const Probe = () => {
      const api = useSidebar();
      return (
        <button
          type="button"
          data-slot="probe-toggle"
          onclick={() => {
            api.toggleSidebar();
            toggled = true;
          }}
        >
          probe
        </button>
      );
    };
    const { click, unmount } = mountUi(() => (
      <SidebarProvider
        defaultOpen
        onOpenChange={() => {
          toggled = true;
        }}
      >
        <Sidebar collapsible="offcanvas">nav</Sidebar>
        <SidebarTrigger />
        <Probe />
      </SidebarProvider>
    ));
    click('[data-slot="sidebar-trigger"]');
    click('[data-slot="probe-toggle"]');
    expect(toggled).toBe(true);
    unmount();

    const none = mountUi(() => (
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="none">x</Sidebar>
      </SidebarProvider>
    ));
    none.unmount();
  });

  test("resizable panels handle drag", () => {
    const { root, unmount } = mountUi(() => (
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={30} minSize={10}>
          A
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>B</ResizablePanel>
      </ResizablePanelGroup>
    ));
    const handle = root.querySelector(
      '[data-slot="resizable-handle"]',
    ) as HTMLElement;
    expect(handle).toBeTruthy();
    const group = handle.parentElement!;
    group.getBoundingClientRect = () =>
      ({
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;

    handle.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 0,
      }),
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 120, clientY: 0 }),
    );
    window.dispatchEvent(new MouseEvent("pointerup"));
    unmount();

    expect(() =>
      withSetup(() => {
        ResizablePanel({ children: "x" });
      }),
    ).toThrow(/ResizablePanelGroup/);
    expect(() =>
      withSetup(() => {
        ResizableHandle({});
      }),
    ).toThrow(/ResizablePanelGroup/);

    const vert = mountUi(() => (
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={50}>A</ResizablePanel>
        <ResizableHandle disabled />
        <ResizablePanel defaultSize={50}>B</ResizablePanel>
      </ResizablePanelGroup>
    ));
    vert.unmount();
  });

  test("command empty hides when items match and shows when none do", async () => {
    const { root, unmount } = mountUi(() => (
      <Command>
        <CommandInput placeholder="Filter" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandItem value="calendar" keywords={["date"]}>
            Calendar
          </CommandItem>
          <CommandItem value="emoji">Emoji</CommandItem>
        </CommandList>
      </Command>
    ));
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector('[data-slot="command-empty"]')).toBeNull();
    expect(root.querySelectorAll('[data-slot="command-item"]').length).toBe(2);

    const input = root.querySelector(
      '[data-slot="command-input"]',
    ) as HTMLInputElement;
    input.value = "cal";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector('[data-slot="command-empty"]')).toBeNull();
    expect(root.querySelector('[data-slot="command-item"]')?.textContent).toContain(
      "Calendar",
    );

    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector('[data-slot="command-empty"]')?.textContent).toBe(
      "No results",
    );
    expect(root.querySelector('[data-slot="command-item"]')).toBeNull();

    input.value = "zz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector('[data-slot="command-empty"]')).toBeTruthy();
    unmount();

    const none = mountUi(() => (
      <Command>
        <CommandInput />
        <CommandList>
          <CommandEmpty />
        </CommandList>
      </Command>
    ));
    await Promise.resolve();
    await Promise.resolve();
    expect(none.root.querySelector('[data-slot="command-empty"]')?.textContent).toBe(
      "No results found.",
    );
    none.unmount();
  });

  test("combobox basics", () => {
    let value = "";
    const { root, click, unmount } = mountUi(() => (
      <Combobox
        defaultOpen
        onValueChange={(v) => {
          value = v;
        }}
      >
        <ComboboxTrigger>
          <ComboboxValue placeholder="Pick" />
        </ComboboxTrigger>
        <ComboboxInput showClear placeholder="Search" />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxItem value="alpha">Alpha</ComboboxItem>
            <ComboboxItem value="beta">Beta</ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    ));
    click('[data-slot="combobox-trigger"]');
    const item = document.querySelector(
      '[data-slot="combobox-item"]',
    ) as HTMLElement | null;
    expect(item).toBeTruthy();
    item!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(value).toBe("alpha");
    const clear = document.querySelector('[data-slot="combobox-clear"]');
    clear?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    unmount();

    const multi = mountUi(() => (
      <Combobox multiple defaultOpen>
        <ComboboxContent>
          <ComboboxList>
            <ComboboxItem value="x">X</ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    ));
    document
      .querySelector('[data-slot="combobox-item"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    multi.unmount();
    void root;
  });

  test("combobox input can clear the last character of a selected value", async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
      origError.apply(console, args);
    };
    let current = "";
    const { root, unmount } = mountUi(() => (
      <Combobox
        defaultOpen
        onValueChange={(v) => {
          current = v;
        }}
      >
        <ComboboxInput placeholder="Search" />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxItem
              // @ts-expect-error uncompiled live getter
              value={() => "alpha"}
            >
              Alpha
            </ComboboxItem>
            <ComboboxItem value="beta">Beta</ComboboxItem>
            <ComboboxItem value={1 as unknown as string}>One</ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    ));
    const input = root.querySelector("input") as HTMLInputElement;
    input.value = "al";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const item = document.querySelector(
      '[data-slot="combobox-item"]',
    ) as HTMLElement;
    expect(item).toBeTruthy();
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(current).toBe("alpha");
    await Promise.resolve();
    await Promise.resolve();
    expect(input.value).toBe("Alpha");

    input.value = "Alph";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(input.value).toBe("Alph");

    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(input.value).toBe("");
    expect(current).toBe("");
    expect(errors.some((e) => e.includes("toLowerCase"))).toBe(false);
    console.error = origError;
    unmount();
  });

  test("combobox empty hides when items match and shows when none do", async () => {
    const { root, unmount } = mountUi(() => (
      <Combobox defaultOpen>
        <ComboboxInput placeholder="Search" />
        <ComboboxContent>
          <ComboboxEmpty>No framework found.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxItem value="sinwan">Sinwan</ComboboxItem>
            <ComboboxItem value="react">React</ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    ));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="combobox-empty"]')).toBeNull();
    expect(document.querySelectorAll('[data-slot="combobox-item"]').length).toBe(
      2,
    );

    const input = root.querySelector("input") as HTMLInputElement;
    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(
      document.querySelector('[data-slot="combobox-empty"]')?.textContent,
    ).toContain("No framework found");
    expect(document.querySelector('[data-slot="combobox-item"]')).toBeNull();

    input.value = "zz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="combobox-empty"]')).toBeTruthy();

    input.value = "sin";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="combobox-empty"]')).toBeNull();
    expect(
      document.querySelector('[data-slot="combobox-item"]')?.textContent,
    ).toContain("Sinwan");
    unmount();

    const none = mountUi(() => (
      <Combobox defaultOpen>
        <ComboboxInput />
        <ComboboxContent>
          <ComboboxEmpty />
          <ComboboxList />
        </ComboboxContent>
      </Combobox>
    ));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="combobox-empty"]')?.textContent).toBe(
      "No results.",
    );
    none.unmount();
  });
});
