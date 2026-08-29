"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function DocumentPreviewFrame({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ scale: 1, height: 0 });

  const measure = useCallback(() => {
    const host = hostRef.current;
    const page = pageRef.current;
    if (!host || !page) return;

    const naturalWidth = page.offsetWidth;
    const naturalHeight = page.scrollHeight;
    if (!naturalWidth || !naturalHeight) return;

    const availableWidth = host.clientWidth;
    const scale = Math.min(1, availableWidth / naturalWidth);
    setMetrics({ scale, height: Math.ceil(naturalHeight * scale) });
  }, []);

  useLayoutEffect(() => {
    measure();
    const host = hostRef.current;
    const page = pageRef.current;
    if (!host || !page) return;

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(page);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const images = Array.from(page.querySelectorAll("img"));
    images.forEach((image) => image.addEventListener("load", measure));
    return () => images.forEach((image) => image.removeEventListener("load", measure));
  }, [measure]);

  return (
    <div className="document-preview-stage">
      <div ref={hostRef} className="a4-preview-host" style={{ height: metrics.height || undefined }}>
        <div
          className="a4-preview-scaled"
          style={{ transform: `scale(${metrics.scale})` }}
        >
          <div ref={pageRef} className="a4-preview-page">{children}</div>
        </div>
      </div>
    </div>
  );
}
