import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  loading?: boolean;
}

export const PaginationControls = ({
  page, totalCount, pageSize, hasMore, hasPrev, onNext, onPrev, loading,
}: PaginationControlsProps) => {
  if (totalCount <= pageSize) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <span className="text-xs text-muted-foreground">
        {from}–{to} de {totalCount}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={!hasPrev || loading} onClick={onPrev} className="h-7 w-7 p-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={onNext} className="h-7 w-7 p-0">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
