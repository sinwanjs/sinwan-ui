import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  Show,
  type InjectionKey,
  type SinwanComponent,
  type SinwanNode,
} from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { ArrowDown } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "./button";

type MessageScrollerApi = {
  stickToBottom: Signal<boolean>;
  atBottom: Signal<boolean>;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  viewportEl: Signal<HTMLElement | null>;
  contentEl: Signal<HTMLElement | null>;
};

const MessageScrollerKey: InjectionKey<MessageScrollerApi> = Symbol(
  "sinwan-ui.message-scroller",
);

export function useMessageScroller(): MessageScrollerApi {
  const api = inject(MessageScrollerKey);
  if (!api) {
    throw new Error(
      "useMessageScroller must be used within MessageScrollerProvider",
    );
  }
  return api;
}

export function useMessageScrollerScrollable(): () => boolean {
  const api = useMessageScroller();
  return () => {
    const el = api.viewportEl.value;
    if (!el) return false;
    return el.scrollHeight > el.clientHeight + 1;
  };
}

export function useMessageScrollerVisibility(): () => boolean {
  const api = useMessageScroller();
  return () => !api.atBottom.value;
}

export type MessageScrollerProviderProps = {
  children?: SinwanNode;
  initialStickToBottom?: boolean;
};

export const MessageScrollerProvider: SinwanComponent<MessageScrollerProviderProps> =
  cc(({ children, initialStickToBottom = true }) => {
    const stickToBottom = signal(initialStickToBottom);
    const atBottom = signal(true);
    const viewportEl = signal<HTMLElement | null>(null);
    const contentEl = signal<HTMLElement | null>(null);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
      const el = viewportEl.value;
      if (!el) return;
      stickToBottom.value = true;
      el.scrollTo({ top: el.scrollHeight, behavior });
    };

    provide(MessageScrollerKey, {
      stickToBottom,
      atBottom,
      scrollToBottom,
      viewportEl,
      contentEl,
    });

    return <>{children}</>;
  });

export type MessageScrollerProps = JSX.IntrinsicElements["div"];

export function MessageScroller({
  class: className,
  ...props
}: MessageScrollerProps) {
  return (
    <div
      data-slot="message-scroller"
      class={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export type MessageScrollerViewportProps = JSX.IntrinsicElements["div"];

export const MessageScrollerViewport: SinwanComponent<MessageScrollerViewportProps> =
  cc(({ class: className, onscroll, children, ...props }) => {
    const api = useMessageScroller();
    let sentinel: HTMLElement | null = null;

    onMounted(() => {
      const viewport = api.viewportEl.value;
      if (!viewport || typeof IntersectionObserver === "undefined") return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          api.atBottom.value = entry.isIntersecting;
          if (entry.isIntersecting) {
            api.stickToBottom.value = true;
          }
        },
        { root: viewport, threshold: 0.1 },
      );

      if (sentinel) observer.observe(sentinel);
      onUnmounted(() => observer.disconnect());
    });

    return (
      <div
        data-slot="message-scroller-viewport"
        class={cn(
          "size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-none",
          className,
        )}
        ref={(el: HTMLElement | null) => {
          api.viewportEl.value = el;
        }}
        onscroll={(event) => {
          const el = event.currentTarget as HTMLElement;
          const distance =
            el.scrollHeight - el.scrollTop - el.clientHeight;
          const nearBottom = distance < 48;
          api.atBottom.value = nearBottom;
          if (!nearBottom) api.stickToBottom.value = false;
          if (typeof onscroll === "function") {
            (
              onscroll as (event: Event) => void
            )(event);
          }
        }}
        {...props}
      >
        {children as SinwanNode}
        <div
          data-slot="message-scroller-sentinel"
          class="h-px w-full shrink-0"
          ref={(el: HTMLElement | null) => {
            sentinel = el;
          }}
        />
      </div>
    );
  });

export type MessageScrollerContentProps = JSX.IntrinsicElements["div"];

export const MessageScrollerContent: SinwanComponent<MessageScrollerContentProps> =
  cc(({ class: className, children, ...props }) => {
    const api = useMessageScroller();

    onMounted(() => {
      const content = api.contentEl.value;
      if (!content || typeof MutationObserver === "undefined") return;
      const observer = new MutationObserver(() => {
        if (api.stickToBottom.value) {
          api.scrollToBottom("auto");
        }
      });
      observer.observe(content, { childList: true, subtree: true });
      onUnmounted(() => observer.disconnect());
    });

    return (
      <div
        data-slot="message-scroller-content"
        class={cn("flex h-max min-h-full flex-col gap-6", className)}
        ref={(el: HTMLElement | null) => {
          api.contentEl.value = el;
        }}
        {...props}
      >
        {children}
      </div>
    );
  });

export type MessageScrollerItemProps = JSX.IntrinsicElements["div"] & {
  scrollAnchor?: boolean;
};

export function MessageScrollerItem({
  class: className,
  scrollAnchor = false,
  ...props
}: MessageScrollerItemProps) {
  return (
    <div
      data-slot="message-scroller-item"
      data-scroll-anchor={scrollAnchor ? "" : undefined}
      class={cn(
        "min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        className,
      )}
      {...props}
    />
  );
}

export type MessageScrollerButtonProps = ButtonProps & {
  direction?: "start" | "end";
};

export const MessageScrollerButton: SinwanComponent<MessageScrollerButtonProps> =
  cc(({
    direction = "end",
    class: className,
    children,
    variant = "secondary",
    size = "icon-sm",
    ...props
  }) => {
    const api = useMessageScroller();

    return (
      <Show when={() => !api.atBottom.value || direction === "start"}>
        <Button
          data-slot="message-scroller-button"
          data-direction={direction}
          data-variant={variant}
          data-size={size}
          data-active="true"
          variant={variant}
          size={size}
          class={cn(
            "absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180",
            className,
          )}
          onclick={() => {
            if (direction === "end") {
              api.scrollToBottom("smooth");
            } else {
              api.viewportEl.value?.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          {...props}
        >
          {children ?? (
            <>
              <Icon icon={ArrowDown} />
              <span class="sr-only">
                {direction === "end" ? "Scroll to end" : "Scroll to start"}
              </span>
            </>
          )}
        </Button>
      </Show>
    );
  });
