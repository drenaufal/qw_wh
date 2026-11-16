'use client';

import React from 'react';

interface AntigravityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  tiltIntensity?: number;
  glowColor?: string;
  className?: string;
}

/**
 * Clean Operational Card (Anti-Slop refactored).
 * Replaces distracting 3D mouse tilt and specular neon sheen with a stable,
 * high-contrast container with crisp 1px borders and subtle elevation.
 */
export function AntigravityCard({
  children,
  className = '',
  ...props
}: AntigravityCardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm hover:border-[var(--border-strong)] transition-colors duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
