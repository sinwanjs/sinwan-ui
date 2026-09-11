import {
  cc,
  inject,
  provide,
  Show,
  type InjectionKey,
  type SinwanComponent,
  type SinwanNode,
} from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";

import { cn, jsxClass } from "../../lib/utils";

type AvatarApi = {
  loaded: Signal<boolean>;
  failed: Signal<boolean>;
};

const AvatarKey: InjectionKey<AvatarApi> = Symbol("sinwan-ui.avatar");

export type AvatarProps = JSX.IntrinsicElements["div"] & {
  size?: "default" | "sm" | "lg";
  children?: SinwanNode;
};

const Avatar: SinwanComponent<AvatarProps> = cc(
  ({ class: className, size = "default", children, ...props }) => {
    provide(AvatarKey, {
      loaded: signal(false),
      failed: signal(false),
    });

    return (
      <div
        data-slot="avatar"
        data-size={size}
        class={cn(
          "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

export type AvatarImageProps = JSX.IntrinsicElements["img"];

const AvatarImage: SinwanComponent<AvatarImageProps> = cc(
  ({ class: className, onerror, onload, ...props }) => {
    const api = inject(AvatarKey)!;

    return (
      <Show when={() => !api.failed.value}>
        <img
          data-slot="avatar-image"
          class={jsxClass(() =>
            cn(
              "aspect-square size-full rounded-full object-cover",
              className,
              api.loaded.value ? undefined : "opacity-0",
            ),
          )}
          onload={(event) => {
            api.loaded.value = true;
            api.failed.value = false;
            if (typeof onload === "function") {
              onload(event);
            }
          }}
          onerror={(event) => {
            api.failed.value = true;
            api.loaded.value = false;
            if (typeof onerror === "function") {
              onerror(event);
            }
          }}
          {...props}
        />
      </Show>
    );
  },
);

export type AvatarFallbackProps = JSX.IntrinsicElements["span"] & {
  children?: SinwanNode;
};

const AvatarFallback: SinwanComponent<AvatarFallbackProps> = cc(
  ({ class: className, children, ...props }) => {
    const api = inject(AvatarKey)!;

    return (
      <Show when={() => api.failed.value || !api.loaded.value}>
        <span
          data-slot="avatar-fallback"
          class={cn(
            "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
            className,
          )}
          {...props}
        >
          {children}
        </span>
      </Show>
    );
  },
);

export type AvatarBadgeProps = JSX.IntrinsicElements["span"];

function AvatarBadge({
  class: className,
  ...props
}: AvatarBadgeProps) {
  return (
    <span
      data-slot="avatar-badge"
      class={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

export type AvatarGroupProps = JSX.IntrinsicElements["div"];

function AvatarGroup({
  class: className,
  ...props
}: AvatarGroupProps) {
  return (
    <div
      data-slot="avatar-group"
      class={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

export type AvatarGroupCountProps = JSX.IntrinsicElements["div"];

function AvatarGroupCount({
  class: className,
  ...props
}: AvatarGroupCountProps) {
  return (
    <div
      data-slot="avatar-group-count"
      class={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
