// Leaving a page of Settings: while a page holds changes not saved, a press that would leave it —
// the section's close, the way back, another row of the list — goes to the page first, which asks
// and then goes on or stays. A reload or a closed tab gets the browser's own question. The
// browser's Back is not held: a change of the hash has already happened when the page hears of it.
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

/** What a page that holds the way out does with a press that would leave it: `go` goes on. */
type Hold = (go: () => void) => void;

const Holder = createContext<RefObject<Hold | undefined> | undefined>(undefined);

/** The section's one place for the page that holds the way out. */
export function LeaveProvider({ children }: { readonly children: ReactNode }) {
  const hold = useRef<Hold | undefined>(undefined);
  return <Holder.Provider value={hold}>{children}</Holder.Provider>;
}

/** Goes on by `go`, or, while a page holds the way out, gives it `go` to ask first. */
export function useLeave(): (go: () => void) => void {
  const hold = useContext(Holder);
  return useCallback(
    (go: () => void) => {
      const held = hold?.current;
      if (held === undefined) go();
      else held(go);
    },
    [hold],
  );
}

/** Holds the way out of the section while `held`: a press that would leave goes to `ask`. */
export function useHold(held: boolean, ask: Hold): void {
  const hold = useContext(Holder);
  const latest = useRef(ask);
  latest.current = ask;
  useEffect(() => {
    if (!held) return;
    const mine: Hold = (go) => latest.current(go);
    if (hold !== undefined) hold.current = mine;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      if (hold !== undefined && hold.current === mine) hold.current = undefined;
    };
  }, [hold, held]);
}
