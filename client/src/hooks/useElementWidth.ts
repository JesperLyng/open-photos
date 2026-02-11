import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function useElementWidth(ref: RefObject<HTMLElement>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const update = () => setWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return width;
}
