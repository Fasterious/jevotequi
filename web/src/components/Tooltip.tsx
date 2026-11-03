import React from "react";

interface Tip {
  x: number;
  y: number;
  content: React.ReactNode;
}
interface Api {
  show: (x: number, y: number, content: React.ReactNode) => void;
  hide: () => void;
}
const Ctx = React.createContext<Api>({ show: () => {}, hide: () => {} });

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = React.useState<Tip | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const api = React.useMemo<Api>(
    () => ({
      show: (x, y, content) => setTip({ x, y, content }),
      hide: () => setTip(null),
    }),
    [],
  );
  React.useLayoutEffect(() => {
    if (!tip || !ref.current) {
      setPos(null);
      return;
    }
    const r = ref.current.getBoundingClientRect();
    const pad = 14;
    let left = tip.x + pad;
    let top = tip.y + pad;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, tip.x - r.width - pad);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, tip.y - r.height - pad);
    setPos({ left, top });
  }, [tip]);
  React.useEffect(() => {
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("hashchange", hide);
    return () => {
      window.removeEventListener("scroll", hide);
      window.removeEventListener("hashchange", hide);
    };
  }, []);
  return (
    <Ctx.Provider value={api}>
      {children}
      {tip && (
        <div
          ref={ref}
          className="tooltip"
          role="tooltip"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
        >
          {tip.content}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useTooltip() {
  return React.useContext(Ctx);
}

/** Props prêtes à l'emploi : survol à la souris et focus clavier. */
export function useTipHandlers() {
  const tt = useTooltip();
  return React.useCallback(
    (content: () => React.ReactNode) => ({
      onPointerMove: (e: React.PointerEvent) => {
        if (e.pointerType === "touch") return;
        tt.show(e.clientX, e.clientY, content());
      },
      onPointerLeave: () => tt.hide(),
      onFocus: (e: React.FocusEvent) => {
        const r = (e.currentTarget as Element).getBoundingClientRect();
        tt.show(r.left + r.width / 2, r.bottom, content());
      },
      onBlur: () => tt.hide(),
    }),
    [tt],
  );
}
