import React, { useState, useRef, ReactNode, useCallback } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DragDropItem {
  id: string | number;
  [key: string]: unknown;
}

interface DragDropGridProps<T extends DragDropItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T) => string | number;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

const colClasses: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

export default function DragDropGrid<T extends DragDropItem>({
  items,
  onReorder,
  renderItem,
  keyExtractor = (item) => item.id,
  columns = 3,
  className,
  itemClassName,
  disabled = false,
}: DragDropGridProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    if (disabled) return;
    dragItem.current = index;
    setDragIndex(index);
  }, [disabled]);

  const handleDragEnter = useCallback((index: number) => {
    if (dragItem.current === null || disabled) return;
    setOverIndex(index);
  }, [disabled]);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || overIndex === null || dragItem.current === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      dragItem.current = null;
      return;
    }

    const reordered = [...items];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(overIndex, 0, moved);
    onReorder(reordered);

    setDragIndex(null);
    setOverIndex(null);
    dragItem.current = null;
  }, [items, onReorder, overIndex]);

  return (
    <div className={cn("grid gap-3", colClasses[columns], className)}>
      {items.map((item, index) => {
        const key = keyExtractor(item);
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <div
            key={key}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "relative group transition-all",
              isDragging && "opacity-40 scale-95",
              isOver && "ring-2 ring-blue-400 ring-offset-2 rounded-2xl",
              itemClassName
            )}
          >
            {/* Drag Handle */}
            {!disabled && (
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <div className="w-6 h-6 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                  <GripVertical size={12} />
                </div>
              </div>
            )}
            {renderItem(item, index)}
          </div>
        );
      })}
    </div>
  );
}
