interface HeatMapLegendProps {
  isVisible?: boolean;
}

export function HeatMapLegend({ isVisible = true }: HeatMapLegendProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm border border-border rounded-md p-2 z-10 pointer-events-none">
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></div>
          <span>&lt;20%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30"></div>
          <span>20-40%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30"></div>
          <span>40-60%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"></div>
          <span>&gt;60%</span>
        </div>
      </div>
    </div>
  );
}

