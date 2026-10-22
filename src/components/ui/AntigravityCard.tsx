'use client';

import React, { useRef, useState, useCallback } from 'react';

interface AntigravityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  tiltIntensity?: number;
  glowColor?: string;
  className?: string;
}

export function AntigravityCard({
  children,
  tiltIntensity = 10,
  glowColor = 'rgba(99, 102, 241, 0.15)',
  className = '',
  ...props
}: AntigravityCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenPosition, setSheenPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const xPct = (mouseX / width) * 100;
      const yPct = (mouseY / height) * 100;
      setSheenPosition({ x: xPct, y: yPct });

      const xRotation = ((mouseY - height / 2) / (height / 2)) * -tiltIntensity;
      const yRotation = ((mouseX - width / 2) / (width / 2)) * tiltIntensity;

      setRotate({ x: xRotation, y: yRotation });
    },
    [tiltIntensity]
  );

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1200,
        transformStyle: 'preserve-3d',
      }}
      className={`relative rounded-2xl transition-transform duration-300 ease-out will-change-transform ${className}`}
      {...props}
    >
      <div
        style={{
          transform: isHovered
            ? `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateZ(12px)`
            : 'rotateX(0deg) rotateY(0deg) translateZ(0px)',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="w-full h-full relative rounded-2xl overflow-hidden glass-panel"
      >
        {/* Dynamic Specular Sheen Highlight */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 rounded-2xl"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(circle 280px at ${sheenPosition.x}% ${sheenPosition.y}%, ${glowColor}, transparent 70%)`,
          }}
        />

        {children}
      </div>
    </div>
  );
}

