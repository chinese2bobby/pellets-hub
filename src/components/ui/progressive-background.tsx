'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProgressiveBackgroundProps {
  src: string;
  blurSrc: string;
  alt?: string;
  overlayClassName?: string;
}

export function ProgressiveBackground({
  src,
  blurSrc,
  alt = "Background",
  overlayClassName = "bg-black/40"
}: ProgressiveBackgroundProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden">
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-in-out ${
          imgLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ 
          backgroundImage: `url(${blurSrc})`, 
          transform: 'scale(1.1)',
          filter: 'blur(20px)'
        }}
      />
      
      <Image
        src={src}
        alt={alt}
        fill
        priority
        className={`object-cover transition-opacity duration-1000 ease-in-out ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImgLoaded(true)}
      />
      
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  );
}
