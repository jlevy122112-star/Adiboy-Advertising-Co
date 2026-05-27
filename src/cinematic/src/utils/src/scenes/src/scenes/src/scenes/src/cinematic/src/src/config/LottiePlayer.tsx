import React, { useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";

interface LottiePlayerProps {
  src: string;              // path to JSON
  autoplay?: boolean;
  loop?: boolean;
  onComplete?: () => void;
  className?: string;
}

export const LottiePlayer: React.FC<LottiePlayerProps> = ({
  src,
  autoplay = true,
  loop = false,
  onComplete,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay,
      path: src,
    });

    animRef.current = anim;

    if (onComplete) {
      anim.addEventListener("complete", onComplete);
    }

    return () => {
      if (onComplete) {
        anim.removeEventListener("complete", onComplete);
      }
      anim.destroy();
    };
  }, [src, autoplay, loop, onComplete]);

  return <div className={className} ref={containerRef} />;
};
