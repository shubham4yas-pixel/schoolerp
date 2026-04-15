import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
}

const variantClasses = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

const StatCard = ({ label, value, icon: Icon, trend, variant = 'default', onClick }: StatCardProps) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -4 }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
    onKeyDown={(event) => {
      if (!onClick) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    }}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    className={`bg-card rounded-2xl border border-border p-6 shadow-soft hover:shadow-hover ${onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-3xl font-display font-bold text-foreground mt-2 tracking-tight">{value}</p>
        {trend && <p className="text-sm font-medium text-muted-foreground mt-2">{trend}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${variantClasses[variant]}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </motion.div>
);

export default StatCard;
