import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function sliderValues(
	value: SliderPrimitive.Root.Props["value"],
	defaultValue: SliderPrimitive.Root.Props["defaultValue"],
	min: number,
	max: number
) {
	if (Array.isArray(value)) {
		return value;
	}
	if (Array.isArray(defaultValue)) {
		return defaultValue;
	}
	return [min, max];
}

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: SliderPrimitive.Root.Props) {
	const values = sliderValues(value, defaultValue, min, max);

	return (
		<SliderPrimitive.Root
			className={cn("data-horizontal:w-full data-vertical:h-full", className)}
			data-slot="slider"
			defaultValue={defaultValue}
			max={max}
			min={min}
			thumbAlignment="edge"
			value={value}
			{...props}
		>
			<SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
				<SliderPrimitive.Track
					className="bg-muted relative grow overflow-hidden rounded-full select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
					data-slot="slider-track"
				>
					<SliderPrimitive.Indicator
						className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
						data-slot="slider-range"
					/>
				</SliderPrimitive.Track>
				{Array.from({ length: values.length }, (_, index) => (
					<SliderPrimitive.Thumb
						className="border-ring ring-ring/50 relative block size-3 shrink-0 rounded-full border bg-white transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
						data-slot="slider-thumb"
						// biome-ignore lint/suspicious/noArrayIndexKey: Slider thumbs are positional controls, not reordered list items.
						key={index}
					/>
				))}
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
}

export { Slider };
