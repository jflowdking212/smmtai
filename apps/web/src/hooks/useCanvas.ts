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
  const clipboardRef = useRef<fabric.FabricObject | null>(null);

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

    const json = JSON.stringify(canvas.toJSON());
    setHistory([json]);
    setHistoryIdx(0);

    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
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

  const addShape = useCallback((type: 'rect' | 'circle' | 'line' | 'arrow') => {
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
      case 'arrow': {
        const line = new fabric.Line([100, 150, 300, 150], { stroke: '#6B7280', strokeWidth: 3 });
        const head = new fabric.Triangle({
          left: 300, top: 150, width: 20, height: 20,
          fill: '#6B7280', angle: 90, originX: 'center', originY: 'center',
        });
        const group = new fabric.Group([line, head], { left: 100, top: 130 });
        shape = group;
        break;
      }
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

  // ---- Copy / Paste ----
  const copySelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    active.clone().then((cloned: fabric.FabricObject) => {
      clipboardRef.current = cloned;
    });
  }, []);

  const pasteClipboard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clipboardRef.current) return;
    clipboardRef.current.clone().then((cloned: fabric.FabricObject) => {
      canvas.discardActiveObject();
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20, evented: true });
      if ((cloned as any).type === 'activeselection') {
        (cloned as any).canvas = canvas;
        (cloned as any).forEachObject((obj: fabric.FabricObject) => canvas.add(obj));
        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }
      // Update clipboard offset for subsequent pastes
      clipboardRef.current!.set({ left: (clipboardRef.current!.left || 0) + 20, top: (clipboardRef.current!.top || 0) + 20 });
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      saveState();
    });
  }, [saveState]);

  // ---- Group / Ungroup ----
  const groupSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || (active as any).type !== 'activeselection') return;
    const objects = (active as fabric.ActiveSelection).getObjects();
    canvas.discardActiveObject();
    objects.forEach((obj) => canvas.remove(obj));
    const group = new fabric.Group(objects);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  const ungroupSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || (active as any).type !== 'group') return;
    const items = (active as fabric.Group).getObjects();
    const groupLeft = active.left || 0;
    const groupTop = active.top || 0;
    canvas.remove(active);
    items.forEach((obj) => {
      obj.set({ left: (obj.left || 0) + groupLeft, top: (obj.top || 0) + groupTop });
      obj.setCoords();
      canvas.add(obj);
    });
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  // ---- Image Filters ----
  const applyImageFilter = useCallback((filterType: string, value?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || !(active instanceof fabric.FabricImage)) return;

    if (!active.filters) active.filters = [];
    // Remove existing filter of same type
    active.filters = active.filters.filter((f: any) => {
      const t = f?.type || f?.constructor?.name || '';
      return t.toLowerCase() !== filterType.toLowerCase();
    });

    switch (filterType.toLowerCase()) {
      case 'brightness':
        if (value !== undefined && value !== 0)
          active.filters.push(new fabric.filters.Brightness({ brightness: value }));
        break;
      case 'contrast':
        if (value !== undefined && value !== 0)
          active.filters.push(new fabric.filters.Contrast({ contrast: value }));
        break;
      case 'saturation':
        if (value !== undefined && value !== 0)
          active.filters.push(new fabric.filters.Saturation({ saturation: value }));
        break;
      case 'grayscale':
        active.filters.push(new fabric.filters.Grayscale());
        break;
      case 'sepia':
        active.filters.push(new fabric.filters.Sepia());
        break;
      case 'blur':
        if (value !== undefined && value > 0)
          active.filters.push(new fabric.filters.Blur({ blur: value }));
        break;
    }

    active.applyFilters();
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  const clearImageFilters = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || !(active instanceof fabric.FabricImage)) return;
    active.filters = [];
    active.applyFilters();
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  // ---- Image Crop / Rotate ----
  const cropActiveImageToAspect = useCallback((aspectRatio: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
    const active = canvas.getActiveObject();
    if (!active || !(active instanceof fabric.FabricImage)) return;

    const element = active.getElement() as HTMLImageElement | HTMLCanvasElement | null;
    const sourceWidth = Number((element as any)?.naturalWidth || active.width || 0);
    const sourceHeight = Number((element as any)?.naturalHeight || active.height || 0);
    if (!sourceWidth || !sourceHeight) return;

    const displayWidth = active.getScaledWidth();
    const displayHeight = active.getScaledHeight();

    const sourceAspect = sourceWidth / sourceHeight;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    let cropX = 0;
    let cropY = 0;

    if (sourceAspect > aspectRatio) {
      cropWidth = sourceHeight * aspectRatio;
      cropX = (sourceWidth - cropWidth) / 2;
    } else if (sourceAspect < aspectRatio) {
      cropHeight = sourceWidth / aspectRatio;
      cropY = (sourceHeight - cropHeight) / 2;
    }

    active.set({
      cropX,
      cropY,
      width: cropWidth,
      height: cropHeight,
      scaleX: displayWidth / cropWidth,
      scaleY: displayHeight / cropHeight,
    });
    active.setCoords();
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  const resetActiveImageCrop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || !(active instanceof fabric.FabricImage)) return;

    const element = active.getElement() as HTMLImageElement | HTMLCanvasElement | null;
    const sourceWidth = Number((element as any)?.naturalWidth || active.width || 0);
    const sourceHeight = Number((element as any)?.naturalHeight || active.height || 0);
    if (!sourceWidth || !sourceHeight) return;

    const displayWidth = active.getScaledWidth();
    const displayHeight = active.getScaledHeight();

    active.set({
      cropX: 0,
      cropY: 0,
      width: sourceWidth,
      height: sourceHeight,
      scaleX: displayWidth / sourceWidth,
      scaleY: displayHeight / sourceHeight,
    });
    active.setCoords();
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  const rotateSelected = useCallback((deltaDegrees: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !Number.isFinite(deltaDegrees)) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    active.rotate((active.angle || 0) + deltaDegrees);
    active.setCoords();
    canvas.requestRenderAll();
    saveState();
  }, [saveState]);

  // ---- Layer Management ----
  const getObjects = useCallback((): fabric.FabricObject[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    return canvas.getObjects();
  }, []);

  const getActiveType = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    if (!obj) return null;
    if (obj instanceof fabric.FabricImage) return 'image';
    if (obj instanceof fabric.IText || obj instanceof fabric.FabricText) return 'text';
    if (obj instanceof fabric.Group) return 'group';
    if ((obj as any).type === 'activeselection') return 'selection';
    return 'shape';
  }, []);

  const selectObject = useCallback((obj: fabric.FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
  }, []);

  const bringToFront = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.bringObjectToFront(obj); canvas.requestRenderAll(); saveState(); }
  }, [saveState]);

  const sendToBack = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.sendObjectToBack(obj); canvas.requestRenderAll(); saveState(); }
  }, [saveState]);

  const toggleObjectVisibility = useCallback((obj: fabric.FabricObject) => {
    obj.set('visible', !obj.visible);
    const canvas = canvasRef.current;
    if (canvas) { canvas.requestRenderAll(); saveState(); }
  }, [saveState]);

  const toggleObjectLock = useCallback((obj: fabric.FabricObject) => {
    const locked = !obj.lockMovementX;
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      selectable: !locked,
      hasControls: !locked,
    });
    const canvas = canvasRef.current;
    if (canvas) canvas.requestRenderAll();
  }, []);

  // ---- SVG insertion for icons/frames ----
  const addSvgString = useCallback((svgString: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fabric.loadSVGFromString(svgString).then((result) => {
      const group = fabric.util.groupSVGElements(result.objects.filter(Boolean) as fabric.FabricObject[], result.options);
      group.set({ left: 100, top: 100 });
      const scale = Math.min(200 / (group.width || 200), 200 / (group.height || 200));
      group.scale(scale);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      saveState();
    });
  }, [saveState]);

  const resizeCanvas = useCallback((size: CanvasSize) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const oldW = canvas.width!;
    const oldH = canvas.height!;
    const scaleX = size.width / oldW;
    const scaleY = size.height / oldH;
    canvas.getObjects().forEach((obj) => {
      obj.set({
        left: (obj.left || 0) * scaleX,
        top: (obj.top || 0) * scaleY,
        scaleX: (obj.scaleX || 1) * scaleX,
        scaleY: (obj.scaleY || 1) * scaleY,
      });
      obj.setCoords();
    });
    canvas.setDimensions({ width: size.width, height: size.height });
    canvas.renderAll();
    saveState();
  }, [saveState]);

  const setBackground = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gradMatch = color.match(/^linear\((.+),\s*(.+)\)$/);
    if (gradMatch) {
      const grad = new fabric.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: canvas.width!, y2: canvas.height! },
        colorStops: [
          { offset: 0, color: gradMatch[1].trim() },
          { offset: 1, color: gradMatch[2].trim() },
        ],
      });
      canvas.backgroundImage = undefined;
      (canvas as any).backgroundColor = grad;
    } else {
      canvas.backgroundImage = undefined;
      canvas.backgroundColor = color;
    }
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
    // New capabilities
    copySelected,
    pasteClipboard,
    groupSelected,
    ungroupSelected,
    applyImageFilter,
    clearImageFilters,
    cropActiveImageToAspect,
    resetActiveImageCrop,
    rotateSelected,
    getObjects,
    getActiveType,
    selectObject,
    bringToFront,
    sendToBack,
    toggleObjectVisibility,
    toggleObjectLock,
    addSvgString,
  };
}
