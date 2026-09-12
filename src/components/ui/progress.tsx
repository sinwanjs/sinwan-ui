import { cc } from "sinwan/component";

import { cn } from "../../lib/utils";

type ProgressProps = Omit<JSX.IntrinsicElements["div"], "value"> & {
  value?: number | null;
};

const Progress = cc<ProgressProps>((props) => {
  const { class: className, value: _value, ...rest } = props;
  const percent = () => props.value ?? 0;
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={() => percent()}
      class={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className,
      )}
      {...rest}
    >
      <div
        data-slot="progress-indicator"
        class="size-full flex-1 bg-primary transition-all"
        style={() => `width: ${percent()}%`}
      />
    </div>
  );
});

export { Progress };
export type { ProgressProps };
