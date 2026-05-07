import { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';

export interface CanvasSize {
  width: number;
  height: number;
  label: string;
}

export type PhotoFrameType = 'rect' | 'rounded' | 'circle' | 'diamond' | 'hex' | 'arch' | 'ticket' | 'capsule';

export function useCanvas(canvasId: string, initialSize: CanvasSize) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
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
    historyRef.current = [json];
    historyIdxRef.current = 0;
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
    const currentHistory = historyRef.current;
    const currentIdx = historyIdxRef.current;
    const nextHistory = currentHistory.slice(0, currentIdx + 1);
    if (nextHistory[nextHistory.length - 1] === json) return;
    nextHistory.push(json);
    historyRef.current = nextHistory;
    historyIdxRef.current = nextHistory.length - 1;
    setHistory(nextHistory);
    setHistoryIdx(nextHistory.length - 1);
  }, []);

  const isTextObject = useCallback((obj: fabric.FabricObject | null | undefined) => {
    const type = ((obj as any)?.type || '').toString().toLowerCase();
    return type === 'i-text' || type === 'text' || type === 'textbox';
  }, []);

  const convertLegacyTextObject = useCallback((obj: fabric.FabricObject): fabric.FabricObject => {
    if (!isTextObject(obj)) return obj;
    const canvas = canvasRef.current;
    if (!canvas) return obj;

    const type = ((obj as any).type || '').toString().toLowerCase();
    if (type === 'textbox') return obj;

    const source = obj as any;
    const canvasWidth = canvas.getWidth() || initialSize.width || 1080;
    const maxWidth = Math.max(canvasWidth - 8, 40);
    const preferredWidth = Math.max(
      40,
      Math.min(
        maxWidth,
        Number(source.getScaledWidth?.() || source.width || 240),
      ),
    );
    const normalizedFontSize = Math.max(
      6,
      Math.round(
        Number(source.fontSize || 32)
        * Math.max(Math.abs(Number(source.scaleX || 1)), Math.abs(Number(source.scaleY || 1)), 0.1),
      ),
    );

    const textbox = new fabric.Textbox(source.text || '', {
      left: source.left || 0,
      top: source.top || 0,
      width: preferredWidth,
      fontFamily: source.fontFamily || 'Inter',
      fontSize: normalizedFontSize,
      fontWeight: source.fontWeight,
      fontStyle: source.fontStyle,
      fill: typeof source.fill === 'string' ? source.fill : '#111827',
      textAlign: source.textAlign || 'left',
      lineHeight: source.lineHeight,
      charSpacing: source.charSpacing,
      underline: source.underline,
      overline: source.overline,
      linethrough: source.linethrough,
      angle: source.angle,
      opacity: source.opacity,
      originX: source.originX,
      originY: source.originY,
      visible: source.visible,
      selectable: source.selectable,
      evented: source.evented,
      hasControls: source.hasControls,
      hasBorders: source.hasBorders,
      lockMovementX: source.lockMovementX,
      lockMovementY: source.lockMovementY,
      lockScalingX: source.lockScalingX,
      lockScalingY: source.lockScalingY,
      lockRotation: source.lockRotation,
      shadow: source.shadow,
      stroke: source.stroke,
      strokeWidth: source.strokeWidth,
      splitByGrapheme: false,
    } as any);

    if (source.backgroundColor) (textbox as any).backgroundColor = source.backgroundColor;
    if (source.styles) (textbox as any).styles = source.styles;
    textbox.set({ scaleX: 1, scaleY: 1 });
    textbox.setCoords();

    const activeObject = canvas.getActiveObject();
    canvas.remove(obj);
    canvas.add(textbox);
    if (activeObject === obj) canvas.setActiveObject(textbox);
    return textbox;
  }, [initialSize.width, isTextObject]);

  const normalizeTextObject = useCallback((obj: fabric.FabricObject): fabric.FabricObject => {
    if (!isTextObject(obj)) return obj;

    const target = convertLegacyTextObject(obj) as any;
    const type = (target.type || '').toString().toLowerCase();
    const sx = Number(target.scaleX || 1);
    const sy = Number(target.scaleY || 1);

    if (type === 'textbox') {
      const canvas = canvasRef.current;
      if (!canvas) return target;
      if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
        const safeScaleX = Math.max(Math.abs(sx), 0.1);
        const safeScaleY = Math.max(Math.abs(sy), 0.1);
        const baseWidth = Number(target.width || target.getScaledWidth?.() || 120);
        const baseFontSize = Number(target.fontSize || 32);
        const maxWidth = Math.max(canvas.getWidth() - 8, 40);
        const nextWidth = Math.max(40, Math.min(maxWidth, baseWidth * safeScaleX));
        const fontScale = Math.abs(sy - 1) > 0.001 ? safeScaleY : safeScaleX;
        const nextFontSize = Math.max(8, Math.min(400, baseFontSize * fontScale));
        target.set({
          width: nextWidth,
          fontSize: nextFontSize,
          scaleX: 1,
          scaleY: 1,
          splitByGrapheme: false,
          lockScalingY: false,
        });
        if (typeof target.initDimensions === 'function') target.initDimensions();
        target.setCoords();
      }
      return target;
    }

    // For legacy i-text/text objects, prevent scale deformation.
    if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
      target.set({ scaleX: 1, scaleY: 1 });
      target.setCoords();
    }
    return target;
  }, [convertLegacyTextObject, isTextObject]);

  const clampObjectToCanvas = useCallback((obj: fabric.FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    if (!canvasWidth || !canvasHeight) return;

    obj.setCoords();
    let bounds = obj.getBoundingRect();
    if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return;

    const maxWidth = Math.max(canvasWidth - 2, 1);
    const maxHeight = Math.max(canvasHeight - 2, 1);
    if (bounds.width > maxWidth || bounds.height > maxHeight) {
      if (isTextObject(obj)) {
        const textObj = normalizeTextObject(obj) as any;
        if ((textObj.type || '').toString().toLowerCase() === 'textbox') {
          const constrainedWidth = Math.max(40, Math.min(maxWidth, Number(textObj.width || maxWidth)));
          textObj.set({ width: constrainedWidth, scaleX: 1, scaleY: 1, splitByGrapheme: false, lockScalingY: false });
          if (typeof textObj.initDimensions === 'function') textObj.initDimensions();
          textObj.setCoords();
          bounds = textObj.getBoundingRect();
          if (bounds.height > maxHeight && Number(textObj.fontSize || 0) > 8) {
            const ratio = maxHeight / Math.max(bounds.height, 1);
            const nextFont = Math.max(8, Math.floor(Number(textObj.fontSize || 32) * Math.min(ratio, 1)));
            if (nextFont < Number(textObj.fontSize || 32)) {
              textObj.set({ fontSize: nextFont });
              if (typeof textObj.initDimensions === 'function') textObj.initDimensions();
              textObj.setCoords();
            }
          }
        }
        bounds = textObj.getBoundingRect();
      } else {
        const scaleRatio = Math.min(maxWidth / Math.max(bounds.width, 1), maxHeight / Math.max(bounds.height, 1), 1);
        obj.set({
          scaleX: (obj.scaleX || 1) * scaleRatio,
          scaleY: (obj.scaleY || 1) * scaleRatio,
        });
        obj.setCoords();
        bounds = obj.getBoundingRect();
      }
    }

    let nextLeft = obj.left || 0;
    let nextTop = obj.top || 0;
    if (bounds.left < 0) nextLeft -= bounds.left;
    if (bounds.top < 0) nextTop -= bounds.top;
    if (bounds.left + bounds.width > canvasWidth) nextLeft -= (bounds.left + bounds.width - canvasWidth);
    if (bounds.top + bounds.height > canvasHeight) nextTop -= (bounds.top + bounds.height - canvasHeight);

    obj.set({ left: nextLeft, top: nextTop });
    obj.setCoords();
  }, [isTextObject, normalizeTextObject]);

  const normalizeCanvasTextObjects = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objects = [...canvas.getObjects()];
    const activeObject = canvas.getActiveObject();
    let nextActive: fabric.FabricObject | null = null;

    objects.forEach((obj) => {
      const normalized = normalizeTextObject(obj);
      clampObjectToCanvas(normalized);
      if (activeObject && obj === activeObject) {
        nextActive = normalized;
      }
    });

    if (nextActive) {
      canvas.setActiveObject(nextActive);
    }
  }, [clampObjectToCanvas, normalizeTextObject]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvasReady || !canvas) return;

    const enforceBounds = (event: any) => {
      const target = event?.target as fabric.FabricObject | undefined;
      if (!target) return;
      normalizeTextObject(target);
      clampObjectToCanvas(target);
      canvas.requestRenderAll();
    };

    const persistObjectChange = (event: any) => {
      const target = event?.target as fabric.FabricObject | undefined;
      if (target) {
        normalizeTextObject(target);
        clampObjectToCanvas(target);
      }
      saveState();
    };

    const persistTextChange = (event: any) => {
      const target = event?.target as fabric.FabricObject | undefined;
      if (target) {
        normalizeTextObject(target);
        clampObjectToCanvas(target);
      }
      canvas.requestRenderAll();
      saveState();
    };

    canvas.on('object:moving', enforceBounds);
    canvas.on('object:scaling', enforceBounds);
    canvas.on('object:rotating', enforceBounds);
    canvas.on('object:modified', persistObjectChange);
    canvas.on('text:changed', persistTextChange);

    return () => {
      canvas.off('object:moving', enforceBounds);
      canvas.off('object:scaling', enforceBounds);
      canvas.off('object:rotating', enforceBounds);
      canvas.off('object:modified', persistObjectChange);
      canvas.off('text:changed', persistTextChange);
    };
  }, [canvasReady, clampObjectToCanvas, normalizeTextObject, saveState]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const currentIdx = historyIdxRef.current;
    if (!canvas || currentIdx <= 0) return;
    const newIdx = currentIdx - 1;
    const snapshot = historyRef.current[newIdx];
    if (!snapshot) return;
    canvas.loadFromJSON(snapshot).then(() => {
      normalizeCanvasTextObjects();
      canvas.renderAll();
    });
    historyIdxRef.current = newIdx;
    setHistoryIdx(newIdx);
  }, [normalizeCanvasTextObjects]);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    const currentIdx = historyIdxRef.current;
    if (!canvas || currentIdx >= historyRef.current.length - 1) return;
    const newIdx = currentIdx + 1;
    const snapshot = historyRef.current[newIdx];
    if (!snapshot) return;
    canvas.loadFromJSON(snapshot).then(() => {
      normalizeCanvasTextObjects();
      canvas.renderAll();
    });
    historyIdxRef.current = newIdx;
    setHistoryIdx(newIdx);
  }, [normalizeCanvasTextObjects]);

  const addText = useCallback((text = 'Edit me', options: Partial<fabric.FabricText> = {}) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const initialWidth = Math.max(140, Math.min((canvas.getWidth() || 1080) * 0.6, (canvas.getWidth() || 1080) - 20));
    const textObj = new fabric.Textbox(text, {
      left: 100,
      top: 100,
      width: initialWidth,
      fontFamily: 'Inter',
      fontSize: 32,
      fill: '#111827',
      splitByGrapheme: false,
      lockScalingY: false,
      ...options,
    } as any);
    normalizeTextObject(textObj);
    clampObjectToCanvas(textObj);
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.renderAll();
    saveState();
  }, [clampObjectToCanvas, normalizeTextObject, saveState]);

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
    clampObjectToCanvas(shape);
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
    saveState();
  }, [clampObjectToCanvas, saveState]);

  const isPhotoFrameObject = useCallback((obj: fabric.FabricObject | null | undefined) => {
    return Boolean((obj as any)?.photoFrame);
  }, []);

  const addPhotoFrame = useCallback((type: PhotoFrameType = 'rect') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const baseOptions: any = {
      left: 100,
      top: 100,
      fill: '#f8fafc',
      stroke: '#111827',
      strokeWidth: 3,
      strokeUniform: true,
    };

    let frame: fabric.FabricObject;
    switch (type) {
      case 'rounded':
        frame = new fabric.Rect({ ...baseOptions, width: 280, height: 200, rx: 34, ry: 34 });
        break;
      case 'circle':
        frame = new fabric.Circle({ ...baseOptions, radius: 110 });
        break;
      case 'diamond':
        frame = new fabric.Polygon([
          { x: 140, y: 0 },
          { x: 280, y: 110 },
          { x: 140, y: 220 },
          { x: 0, y: 110 },
        ], { ...baseOptions });
        break;
      case 'hex':
        frame = new fabric.Polygon([
          { x: 70, y: 0 },
          { x: 210, y: 0 },
          { x: 280, y: 100 },
          { x: 210, y: 200 },
          { x: 70, y: 200 },
          { x: 0, y: 100 },
        ], { ...baseOptions });
        break;
      case 'arch':
        frame = new fabric.Path(
          'M 20 220 L 20 120 Q 150 8 280 120 L 280 220 Z',
          { ...baseOptions },
        );
        break;
      case 'ticket':
        frame = new fabric.Path(
          'M 20 60 H 280 V 95 Q 250 120 280 145 V 220 H 20 V 145 Q 50 120 20 95 Z',
          { ...baseOptions },
        );
        break;
      case 'capsule':
        frame = new fabric.Rect({ ...baseOptions, width: 300, height: 140, rx: 70, ry: 70 });
        break;
      case 'rect':
      default:
        frame = new fabric.Rect({ ...baseOptions, width: 280, height: 200, rx: 12, ry: 12 });
        break;
    }

    (frame as any).photoFrame = true;
    (frame as any).photoFrameType = type;
    clampObjectToCanvas(frame);
    canvas.add(frame);
    canvas.setActiveObject(frame);
    canvas.requestRenderAll();
    saveState();
  }, [clampObjectToCanvas, saveState]);

  const findPhotoFrameAtPoint = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const point = new fabric.Point(x, y);
    const objects = [...canvas.getObjects()].reverse();
    for (const obj of objects) {
      if (!obj.visible || !isPhotoFrameObject(obj)) continue;
      try {
        if (obj.containsPoint(point)) return obj;
      } catch {
        // Ignore hit-test failures
      }
    }
    return null;
  }, [isPhotoFrameObject]);

  const fillPhotoFrameWithImage = useCallback((target: fabric.FabricObject, url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve(false);

    return fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      .then((img) => {
        const source = img.getElement() as HTMLImageElement | HTMLCanvasElement;
        const sourceW = Number((source as any)?.naturalWidth || source.width || img.width || 1);
        const sourceH = Number((source as any)?.naturalHeight || source.height || img.height || 1);
        const targetW = Math.max(32, Math.round(Number((target as any).width || target.getScaledWidth?.() || 220)));
        const targetH = Math.max(32, Math.round(Number((target as any).height || target.getScaledHeight?.() || 180)));

        const offscreen = document.createElement('canvas');
        offscreen.width = targetW;
        offscreen.height = targetH;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return false;

        const scale = Math.max(targetW / Math.max(sourceW, 1), targetH / Math.max(sourceH, 1));
        const drawW = sourceW * scale;
        const drawH = sourceH * scale;
        const drawX = (targetW - drawW) / 2;
        const drawY = (targetH - drawH) / 2;
        ctx.drawImage(source, drawX, drawY, drawW, drawH);

        const pattern = new fabric.Pattern({
          source: offscreen,
          repeat: 'no-repeat',
        } as any);

        target.set('fill', pattern);
        if ((target as any).stroke == null || (target as any).stroke === 'none') {
          target.set('stroke', '#111827');
        }
        if (!Number((target as any).strokeWidth || 0)) {
          target.set('strokeWidth', 3);
        }
        target.setCoords();
        clampObjectToCanvas(target);
        canvas.setActiveObject(target);
        canvas.requestRenderAll();
        saveState();
        return true;
      })
      .catch(() => false);
  }, [clampObjectToCanvas, saveState]);

  const addImage = useCallback((url: string, point?: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
      const scale = Math.min(
        (canvas.width! * 0.5) / (img.width || 1),
        (canvas.height! * 0.5) / (img.height || 1),
      );
      img.scale(scale);
      const imgW = img.getScaledWidth();
      const imgH = img.getScaledHeight();
      const nextLeft = point && Number.isFinite(point.x) ? point.x - (imgW / 2) : 50;
      const nextTop = point && Number.isFinite(point.y) ? point.y - (imgH / 2) : 50;
      img.set({ left: nextLeft, top: nextTop });
      clampObjectToCanvas(img);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveState();
    });
  }, [clampObjectToCanvas, saveState]);

  const placeImage = useCallback((url: string, point?: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let targetFrame: fabric.FabricObject | null = null;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      targetFrame = findPhotoFrameAtPoint(point.x, point.y);
    }
    if (!targetFrame) {
      const active = canvas.getActiveObject();
      if (isPhotoFrameObject(active)) {
        targetFrame = active as fabric.FabricObject;
      }
    }

    if (!targetFrame) {
      addImage(url, point);
      return;
    }

    fillPhotoFrameWithImage(targetFrame, url).then((placed) => {
      if (!placed) addImage(url, point);
    });
  }, [addImage, fillPhotoFrameWithImage, findPhotoFrameAtPoint, isPhotoFrameObject]);

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
      clampObjectToCanvas(cloned);
      // Update clipboard offset for subsequent pastes
      clipboardRef.current!.set({ left: (clipboardRef.current!.left || 0) + 20, top: (clipboardRef.current!.top || 0) + 20 });
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      saveState();
    });
  }, [clampObjectToCanvas, saveState]);

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
    clampObjectToCanvas(active);
    active.setCoords();
    canvas.requestRenderAll();
    saveState();
  }, [clampObjectToCanvas, saveState]);

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
    const objType = ((obj as any).type || '').toString().toLowerCase();
    if (obj instanceof fabric.FabricImage) return 'image';
    if (objType === 'textbox' || obj instanceof fabric.IText || obj instanceof fabric.FabricText) return 'text';
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
      clampObjectToCanvas(group);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      saveState();
    });
  }, [clampObjectToCanvas, saveState]);

  const resizeCanvas = useCallback((size: CanvasSize) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const oldW = canvas.width!;
    const oldH = canvas.height!;
    const fitScale = Math.min(size.width / oldW, size.height / oldH);
    const offsetX = (size.width - (oldW * fitScale)) / 2;
    const offsetY = (size.height - (oldH * fitScale)) / 2;
    const objects = [...canvas.getObjects()];
    objects.forEach((obj) => {
      const raw = obj as any;
      const rawType = (raw.type || '').toString().toLowerCase();
      const isBackgroundRect = rawType === 'rect'
        && raw.selectable === false
        && Math.abs(Number(raw.left || 0)) < 2
        && Math.abs(Number(raw.top || 0)) < 2
        && Math.abs((Number(raw.width || 0) * Number(raw.scaleX || 1)) - oldW) < 6
        && Math.abs((Number(raw.height || 0) * Number(raw.scaleY || 1)) - oldH) < 6;

      if (isBackgroundRect) {
        raw.set({
          left: 0,
          top: 0,
          width: size.width,
          height: size.height,
          scaleX: 1,
          scaleY: 1,
        });
        raw.setCoords?.();
        return;
      }

      const normalized = normalizeTextObject(obj);
      const nextLeft = (normalized.left || 0) * fitScale + offsetX;
      const nextTop = (normalized.top || 0) * fitScale + offsetY;
      if (isTextObject(normalized)) {
        const textObj = normalized as any;
        const baseWidth = Number(textObj.width || textObj.getScaledWidth?.() || 120);
        const baseFontSize = Number(textObj.fontSize || 32);
        textObj.set({
          left: nextLeft,
          top: nextTop,
          width: Math.max(40, Math.min(size.width - 8, baseWidth * fitScale)),
          fontSize: Math.max(8, Math.min(400, baseFontSize * fitScale)),
          scaleX: 1,
          scaleY: 1,
          splitByGrapheme: false,
          lockScalingY: false,
        });
        if (typeof textObj.initDimensions === 'function') textObj.initDimensions();
      } else {
        normalized.set({
          left: nextLeft,
          top: nextTop,
          scaleX: (normalized.scaleX || 1) * fitScale,
          scaleY: (normalized.scaleY || 1) * fitScale,
        });
      }
      clampObjectToCanvas(normalized);
      normalized.setCoords();
    });
    canvas.setDimensions({ width: size.width, height: size.height });
    canvas.renderAll();
    saveState();
  }, [clampObjectToCanvas, isTextObject, normalizeTextObject, saveState]);

  const setBackground = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    const buildLinearGradient = (colors: string[]) => new fabric.Gradient({
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: canvasWidth || 1, y2: canvasHeight || 1 },
      colorStops: colors.map((stopColor, idx) => ({
        offset: colors.length === 1 ? 0 : idx / (colors.length - 1),
        color: stopColor,
      })),
    });

    const backgroundRect = canvas.getObjects().find((obj) => {
      const raw = obj as any;
      const type = (raw.type || '').toString().toLowerCase();
      if (type !== 'rect') return false;
      if (raw.selectable !== false) return false;
      const w = Number(raw.width || 0) * Number(raw.scaleX || 1);
      const h = Number(raw.height || 0) * Number(raw.scaleY || 1);
      return Math.abs(Number(raw.left || 0)) < 2
        && Math.abs(Number(raw.top || 0)) < 2
        && Math.abs(w - canvasWidth) < 6
        && Math.abs(h - canvasHeight) < 6;
    }) as fabric.FabricObject | undefined;

    const gradientColors = color.match(/#[0-9A-Fa-f]{6}/g) || [];
    if (color.startsWith('linear(') && gradientColors.length >= 2) {
      const grad = buildLinearGradient(gradientColors);
      canvas.backgroundImage = undefined;
      (canvas as any).backgroundColor = grad;
      if (backgroundRect) {
        (backgroundRect as any).set('fill', buildLinearGradient(gradientColors));
        backgroundRect.setCoords();
      }
    } else {
      canvas.backgroundImage = undefined;
      canvas.backgroundColor = color;
      if (backgroundRect) {
        (backgroundRect as any).set('fill', color);
        backgroundRect.setCoords();
      }
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
      normalizeCanvasTextObjects();
      canvas.renderAll();
      saveState();
    });
  }, [normalizeCanvasTextObjects, saveState]);

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
    addPhotoFrame,
    addImage,
    placeImage,
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
    commitHistory: saveState,
  };
}
