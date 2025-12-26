'use client';

import { OrderStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { STATUS_CONFIG } from '@/config';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_CONFIG.labels[status] || status;
  
  return (
    <Badge variant={status} className={className}>
      {label}
    </Badge>
  );
}

