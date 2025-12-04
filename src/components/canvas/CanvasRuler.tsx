import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

interface CanvasRulerProps {
  isVisible: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;
}

export function CanvasRuler({ isVisible, canvasRef }: CanvasRulerProps) {
  const { zoom, pan } = useCanvasStore();
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const rulerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) {
      setCanvasRect(null);
      return;
    }

    const updateRect = () => {
      if (canvasRef?.current) {
        setCanvasRect(canvasRef.current.getBoundingClientRect());
      } else if (rulerContainerRef.current?.parentElement) {
        // Use parent container dimensions, accounting for ruler offset
        const parent = rulerContainerRef.current.parentElement;
        const rect = parent.getBoundingClientRect();
        const rulerSize = 24;
        // Create a rect that represents the canvas area (parent minus ruler space)
        setCanvasRect({
          ...rect,
          width: rect.width - rulerSize,
          height: rect.height - rulerSize,
          left: rect.left + rulerSize,
          top: rect.top + rulerSize,
        } as DOMRect);
      }
    };

    // Use multiple strategies to ensure we get the rect
    const timeoutId = setTimeout(updateRect, 10);
    const rafId = requestAnimationFrame(updateRect);
    const rafId2 = requestAnimationFrame(() => {
      requestAnimationFrame(updateRect);
    });

    window.addEventListener('resize', updateRect);
    
    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(rafId2);
      window.removeEventListener('resize', updateRect);
    };
  }, [isVisible, canvasRef]);

  // Update rect when zoom/pan changes
  useEffect(() => {
    if (!isVisible) return;
    
    const updateRect = () => {
      if (canvasRef?.current) {
        setCanvasRect(canvasRef.current.getBoundingClientRect());
      }
    };

    const rafId = requestAnimationFrame(updateRect);
    return () => cancelAnimationFrame(rafId);
  }, [zoom, pan, isVisible, canvasRef]);

  if (!isVisible) return null;
  
  // Use default dimensions if rect not available yet
  if (!canvasRect) {
    return (
      <div
        ref={rulerContainerRef}
        className="absolute inset-0 pointer-events-none z-20"
      />
    );
  }

  const gridSize = 20; // Base grid size in pixels
  const scaledGridSize = gridSize * zoom;
  // Determine step based on zoom level
  let gridStep = 1;
  if (scaledGridSize < 10) gridStep = 10;
  else if (scaledGridSize < 20) gridStep = 5;
  else if (scaledGridSize < 40) gridStep = 2;
  const stepPixels = gridSize * gridStep;

  // Calculate visible range in world coordinates
  const rulerWidth = 24; // Width of the left ruler
  const rulerHeight = 24; // Height of the top ruler
  
  const canvasWidth = canvasRect.width;
  const canvasHeight = canvasRect.height;
  
  const startX = Math.floor((-pan.x / zoom) / stepPixels) * stepPixels;
  const startY = Math.floor((-pan.y / zoom) / stepPixels) * stepPixels;
  const endX = startX + (canvasWidth / zoom) + stepPixels * 2;
  const endY = startY + (canvasHeight / zoom) + stepPixels * 2;

  const horizontalTicks: number[] = [];
  for (let x = startX; x <= endX; x += stepPixels) {
    horizontalTicks.push(x);
  }

  const verticalTicks: number[] = [];
  for (let y = startY; y <= endY; y += stepPixels) {
    verticalTicks.push(y);
  }

  return (
    <div
      ref={rulerContainerRef}
      className="absolute inset-0 pointer-events-none z-20"
    >
      {/* Top ruler - positioned above canvas */}
      <div
        className="absolute bg-card/90 backdrop-blur-sm border-b border-border pointer-events-none"
        style={{
          top: 0,
          left: `${rulerWidth}px`,
          right: 0,
          height: `${rulerHeight}px`,
          transform: `translate(${pan.x}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {horizontalTicks.map((x) => (
          <div
            key={`h-${x}`}
            className="absolute top-0 bottom-0 border-l border-border/60"
            style={{ left: `${x}px`, width: '1px' }}
          >
            <span
              className="absolute top-0.5 left-1 text-[10px] text-muted-foreground font-mono whitespace-nowrap"
              style={{ transform: `scale(${1 / zoom})`, transformOrigin: '0 0' }}
            >
              {x}
            </span>
          </div>
        ))}
      </div>

      {/* Left ruler - positioned to the left of canvas */}
      <div
        className="absolute bg-card/90 backdrop-blur-sm border-r border-border pointer-events-none"
        style={{
          top: `${rulerHeight}px`,
          left: 0,
          bottom: 0,
          width: `${rulerWidth}px`,
          transform: `translate(0, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {verticalTicks.map((y) => (
          <div
            key={`v-${y}`}
            className="absolute left-0 right-0 border-t border-border/60"
            style={{ top: `${y}px`, height: '1px' }}
          >
            <span
              className="absolute left-0.5 top-1 text-[10px] text-muted-foreground font-mono whitespace-nowrap"
              style={{ transform: `scale(${1 / zoom})`, transformOrigin: '0 0' }}
            >
              {y}
            </span>
          </div>
        ))}
      </div>

      {/* Corner piece */}
      <div
        className="absolute bg-card/90 backdrop-blur-sm border-b border-r border-border pointer-events-none"
        style={{
          top: 0,
          left: 0,
          width: `${rulerWidth}px`,
          height: `${rulerHeight}px`,
        }}
      />
    </div>
  );
}

