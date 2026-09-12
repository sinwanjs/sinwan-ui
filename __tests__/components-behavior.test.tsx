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
  SelectItem,
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
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "../src/components/ui/combobox";
import { asVNode, mountUi, setupDom, teardownDom, withSetup } from "./helpers";

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
      Object.defineProperty(evt, "stopPropagation", { value: () => {} });
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
          selected = d;
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

  test("command filter", () => {
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
    const input = root.querySelector(
      '[data-slot="command-input"]',
    ) as HTMLInputElement;
    input.value = "cal";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "zzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    unmount();
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
});
