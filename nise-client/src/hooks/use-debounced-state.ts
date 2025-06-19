import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";

type DebouncedStateReturn<T> = {
	state: T;
	setState: Dispatch<SetStateAction<T>>;
	setStateImmediately: Dispatch<SetStateAction<T>>;
	cancelSetState: () => void;
};

export function useDebouncedState<T>(
	initialState: T | (() => T),
	delay: number,
): DebouncedStateReturn<T> {
	const [debouncedState, setDebouncedState] = useState<T>(initialState);
	const timerRef = useRef<number>(-1);

	const setState: Dispatch<SetStateAction<T>> = (value) => {
		window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => {
			setDebouncedState(value);
		}, delay);
	};

	const setStateImmediately: Dispatch<SetStateAction<T>> = (value) => {
		window.clearTimeout(timerRef.current);
		setDebouncedState(value);
	};

	const cancelSetState = () => {
		window.clearTimeout(timerRef.current);
	};

	useEffect(() => {
		return () => {
			window.clearTimeout(timerRef.current);
		};
	}, []);

	return {
		state: debouncedState,
		setState,
		setStateImmediately,
		cancelSetState,
	};
}
