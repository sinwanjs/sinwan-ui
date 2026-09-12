import { cc, inject, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Minus } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";

export type OtpSlotState = {
  char: string;
  hasFakeCaret: boolean;
  isActive: boolean;
};

export type OtpApi = {
  value: Signal<string>;
  maxLength: number;
  slots: () => OtpSlotState[];
  focus: () => void;
};

export const OTPInputContext: InjectionKey<OtpApi> = Symbol("sinwan-ui.input-otp");

export type InputOTPProps = {
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  class?: string;
  containerClass?: string;
  disabled?: boolean;
  children?: SinwanNode;
  pattern?: string;
  inputMode?: JSX.IntrinsicElements["input"]["inputMode"];
  autocomplete?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

function sanitize(value: string, maxLength: number, pattern?: string): string {
  let next = value;
  if (!pattern) {
    next = value.replace(/\s/g, "");
    return next.slice(0, maxLength);
  }
  try {
    const re = new RegExp(pattern, "g");
    next = (next.match(re) ?? []).join("");
  } catch {
    next = value.replace(/\s/g, "");
  }
  return next.slice(0, maxLength);
}

export const InputOTP = cc<InputOTPProps>(
  ({
    maxLength = 6,
    value: valueProp,
    onChange,
    onComplete,
    class: className,
    containerClass,
    disabled,
    children,
    pattern,
    inputMode = "numeric",
    autocomplete = "one-time-code",
    "aria-invalid": ariaInvalid,
  }) => {
    const value = signal(valueProp ?? "");
    if (valueProp !== undefined) value.value = valueProp;

    let inputEl: HTMLInputElement | null = null;
    const focused = signal(false);

    const setValue = (next: string) => {
      const cleaned = sanitize(next, maxLength, pattern);
      value.value = cleaned;
      onChange?.(cleaned);
      if (cleaned.length >= maxLength) onComplete?.(cleaned);
    };

    const slots = (): OtpSlotState[] => {
      const current = value.value;
      const activeIndex = Math.min(current.length, maxLength - 1);
      return Array.from({ length: maxLength }, (_, index) => ({
        char: current[index] ?? "",
        isActive: focused.value && index === activeIndex,
        hasFakeCaret:
          focused.value && index === activeIndex && current.length < maxLength
            ? index === current.length
            : focused.value &&
              index === activeIndex &&
              current.length === maxLength &&
              index === maxLength - 1,
      }));
    };

    provide(OTPInputContext, {
      value,
      maxLength,
      slots,
      focus: () => inputEl?.focus(),
    });

    return (
      <div
        data-slot="input-otp"
        class={cn(
          "cn-input-otp relative flex items-center has-disabled:opacity-50",
          containerClass,
        )}
        aria-invalid={ariaInvalid}
      >
        <input
          ref={(el: HTMLInputElement | null) => {
            inputEl = el;
          }}
          data-slot="input-otp-hidden"
          class={cn(
            "absolute inset-0 h-full w-full cursor-default opacity-0 disabled:cursor-not-allowed",
            className,
          )}
          value={() => value.value}
          maxLength={maxLength}
          disabled={disabled}
          inputMode={inputMode}
          autocomplete={autocomplete}
          spellcheck={false}
          aria-invalid={ariaInvalid}
          onfocus={() => {
            focused.value = true;
          }}
          onblur={() => {
            focused.value = false;
          }}
          oninput={(event: Event) => {
            const target = event.target as HTMLInputElement;
            setValue(target.value);
          }}
          onpaste={(event: ClipboardEvent) => {
            event.preventDefault();
            const text = event.clipboardData?.getData("text") ?? "";
            setValue(text);
          }}
        />
        <div
          class="flex items-center"
          onclick={() => {
            if (!disabled) inputEl?.focus();
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

export function InputOTPGroup({
  class: className,
  ...props
}: JSX.IntrinsicElements["div"]) {
  return (
    <div
      data-slot="input-otp-group"
      class={cn(
        "flex items-center rounded-lg has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export type InputOTPSlotProps = JSX.IntrinsicElements["div"] & {
  index: number;
};

export const InputOTPSlot = cc<InputOTPSlotProps>(
  ({ index, class: className, ...props }) => {
    const api = inject(OTPInputContext);
    if (!api) {
      throw new Error("InputOTPSlot must be used within InputOTP");
    }

    return (
      <div
        data-slot="input-otp-slot"
        data-active={() =>
          api.slots()[index]?.isActive ? "true" : undefined
        }
        class={cn(
          "relative flex size-8 items-center justify-center border-y border-r border-input text-sm transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      >
        {() => api.slots()[index]?.char ?? ""}
        <Show when={() => Boolean(api.slots()[index]?.hasFakeCaret)}>
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div class="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
          </div>
        </Show>
      </div>
    );
  },
);

export function InputOTPSeparator(props: JSX.IntrinsicElements["div"]) {
  return (
    <div
      data-slot="input-otp-separator"
      class="flex items-center [&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...props}
    >
      <Icon icon={Minus} />
    </div>
  );
}
