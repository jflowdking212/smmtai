import { useEffect, useState } from 'react';
import type { TemplateData } from '@/lib/templates';

interface TemplatePreviewProps {
  template: TemplateData;
  className?: string;
  alt?: string;
}

const previewCache = new Map<string, string>();

function getCacheKey(template: TemplateData): string {
  return `${template.id}:${template.width}x${template.height}:${template.json.length}`;
}

export function TemplatePreview({ template, className, alt }: TemplatePreviewProps) {
  const cacheKey = getCacheKey(template);
  const [previewSrc, setPreviewSrc] = useState<string | null>(() => previewCache.get(cacheKey) || null);

  useEffect(() => {
    const cached = previewCache.get(cacheKey);
    if (cached) {
      setPreviewSrc(cached);
      return;
    }

    setPreviewSrc(null);
    let disposed = false;
    let canvas: { dispose: () => void } | null = null;
    const disposeCanvas = () => {
      if (disposed) return;
      disposed = true;
      canvas?.dispose();
      canvas = null;
    };

    void import('fabric')
      .then((fabric) => {
        if (disposed) return;
        const canvasElement = document.createElement('canvas');
        const staticCanvas = new fabric.StaticCanvas(canvasElement, {
          width: template.width,
          height: template.height,
          backgroundColor: '#ffffff',
          renderOnAddRemove: false,
        });
        canvas = staticCanvas;

        return staticCanvas.loadFromJSON(template.json)
          .then(() => {
            if (disposed) return;
            staticCanvas.renderAll();
            const targetEdge = 360;
            const multiplier = Math.max(1, targetEdge / Math.min(template.width, template.height));
            const dataUrl = staticCanvas.toDataURL({ format: 'png', multiplier });
            previewCache.set(cacheKey, dataUrl);
            setPreviewSrc(dataUrl);
          })
          .finally(() => {
            disposeCanvas();
          });
      })
      .catch(() => {
        disposeCanvas();
      });

    return () => {
      disposeCanvas();
    };
  }, [cacheKey, template.height, template.json, template.width]);

  if (!previewSrc) {
    return <div className={className} style={{ background: template.thumbnail }} aria-label={alt || template.name} />;
  }

  return <img src={previewSrc} alt={alt || template.name} className={className} loading="lazy" />;
}
