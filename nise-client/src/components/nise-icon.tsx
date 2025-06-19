import { useEffect, useRef } from "react";

export function NiseIcon() {
	const iconRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		function rotateElement(event: MouseEvent, element: HTMLImageElement) {
			const windowWidth = window.innerWidth;
			const windowHeight = window.innerHeight;

			const x = event.clientX;
			const y = event.clientY;

			const rect = element.getBoundingClientRect();
			const middleX = rect.left + rect.width / 2;
			const middleY = rect.top + rect.height / 2;

			const offsetX = ((x - middleX) / windowWidth) * 30;
			const offsetY = ((y - middleY) / windowHeight) * 30;

			element.style.setProperty("--rotateX", `${offsetX}deg`);
			element.style.setProperty("--rotateY", `${-1 * offsetY}deg`);
		}

		function handleMouseMove(event: MouseEvent) {
			if (iconRef.current) {
				rotateElement(event, iconRef.current);
			}
		}

		// Add event listener for mouse movement
		window.addEventListener("mousemove", handleMouseMove);

		return () => {
			// Cleanup event listener on unmount
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, []);

	return (
		<div>
			<img
				ref={iconRef}
				style={{
					transformStyle: "preserve-3d",
					transform:
						"perspective(5000px) rotateY(var(--rotateX)) rotateX(var(--rotateY))",
				}}
				className="hover:scale-110 transition-scale"
				src="/nise-icon.svg"
				alt="Nise chat logo"
			/>
		</div>
	);
}
