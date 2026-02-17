import { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';

export interface CanvasSize {
  width: number;
  height: number;
  label: string;
}

export function useCanvas(canvasId: string, initialSize: CanvasSize) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    const el = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!el) return;

    const canvas = new fabric.Canvas(el, {
      width: initialSize.width,
      height: initialSize.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

    canvasRef.current = canvas;
    setCanvasReady(true);

    // Save initial state
    const json = JSON.stringify(canvas.toJSON());
    setHistory([json]);
    setHistoryIdx(0);

    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIdx + 1);
      newHistory.push(json);
      return newHistory;
    });
    setHistoryIdx((prev) => prev + 1);
  }, [historyIdx]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    canvas.loadFromJSON(history[newIdx]).then(() => {
      canvas.renderAll();
      setHistoryIdx(newIdx);
    });
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    canvas.loadFromJSON(history[newIdx]).then(() => {
      canvas.renderAll();
      setHistoryIdx(newIdx);
    });
  }, [history, historyIdx]);

  const addText = useCallback((text = 'Edit me', options: Partial<fabric.FabricText> = {}) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const textObj = new fabric.IText(text, {
      left: 100,
      top: 100,
      fontFamily: 'Inter',
      fontSize: 32,
      fill: '#111827',
      ...options,
    } as any);
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const addShape = useCallback((type: 'rect' | 'circle' | 'line') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let shape: fabric.FabricObject;
    switch (type) {
      case 'rect':
        shape = new fabric.Rect({ left: 100, top: 100, width: 200, height: 150, fill: '#2563EB', rx: 8, ry: 8 });
        break;
      case 'circle':
        shape = new fabric.Circle({ left: 100, top: 100, radius: 75, fill: '#10B981' });
        break;
      case 'line':
        shape = new fabric.Line([100, 100, 300, 100], { stroke: '#6B7280', strokeWidth: 3 });
        break;
    }
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const addImage = useCallback((url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
      const scale = Math.min(
        (canvas.width! * 0.5) / (img.width || 1),
        (canvas.height! * 0.5) / (img.height || 1),
      );
      img.scale(scale);
      img.set({ left: 50, top: 50 });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveState();
    });
  }, [saveState]);

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const resizeCanvas = useCallback((size: CanvasSize) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: size.width, height: size.height });
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const setBackground = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.backgroundColor = color;
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const exportImage = useCallback((format: 'png' | 'jpeg' = 'png', quality = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL({ format, quality, multiplier: 2 });
  }, []);

  const loadJSON = useCallback((json: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.loadFromJSON(json).then(() => {
      canvas.renderAll();
      saveState();
    });
  }, [saveState]);

  const toJSON = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return JSON.stringify(canvas.toJSON());
  }, []);

  const bringForward = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.bringObjectForward(obj); canvas.renderAll(); saveState(); }
  }, [saveState]);

  const sendBackward = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.sendObjectBackwards(obj); canvas.renderAll(); saveState(); }
  }, [saveState]);

  return {
    canvas: canvasRef,
    canvasReady,
    addText,
    addShape,
    addImage,
    deleteSelected,
    resizeCanvas,
    setBackground,
    exportImage,
    loadJSON,
    toJSON,
    undo,
    redo,
    bringForward,
    sendBackward,
    canUndo: historyIdx > 0,
    canRedo: historyIdx < history.length - 1,
  };
}
