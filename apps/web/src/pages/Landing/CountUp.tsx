import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export default function CountUp({
  end,
  start = 0,
  duration = 2000,
  suffix = "",
  prefix = "",
  decimals = 0,
}: CountUpProps) {
  const [count, setCount] = useState(start);
  const rafRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    startTimeRef.current = undefined;
    const range = end - start;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + range * eased;

      setCount(parseFloat(current.toFixed(decimals)));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, start, duration, decimals]);

  return (
    <span>
      {prefix}
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString()}
      {suffix}
    </span>
  );
}
