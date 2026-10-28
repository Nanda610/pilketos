/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ikon Garuda Pancasila (Lambang Negara Republik Indonesia).
 * Didesain khusus dengan vektor presisi tinggi untuk merepresentasikan
 * integritas nasional, asas LUBER-JURDIL, dan kewibawaan pesta demokrasi sekolah.
 */

import React from 'react';

interface GarudaIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export const GarudaIcon: React.FC<GarudaIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      {/* Sayap Kiri Garuda (Outer & Inner Feathers) */}
      <path
        d="M20 18C18.2 16.5 14.5 13 8 13.5C6.5 13.6 5 14.3 4.2 15.5C3.8 16.2 3.8 17.2 4.5 17.8C5.8 19 9 20.8 11.2 21.5C9.8 22.5 7.2 24 5.2 25.2C4.2 25.8 3.8 27 4.5 27.8C5.2 28.5 6.2 28.7 7.5 28C10.2 26.5 13.5 25 15.8 24.2C14.5 25.5 12 28.2 10.2 30C9.5 30.8 9.6 31.8 10.5 32.2C11.5 32.6 12.5 32.2 13.5 31.2C15.8 28.8 18.2 25.5 19.5 23.5V26C19.5 27.2 18.5 29 17.5 30.5C17 31.2 17.2 32.2 18.2 32.5C19.2 32.8 20 32.2 20.5 31.2C21.2 29.8 21.8 27.5 21.8 25.5V19C21.2 18.5 20.5 18.2 20 18Z"
        fill="currentColor"
        opacity="0.95"
      />

      {/* Sayap Kanan Garuda (Outer & Inner Feathers) */}
      <path
        d="M28 18C29.8 16.5 33.5 13 40 13.5C41.5 13.6 43 14.3 43.8 15.5C44.2 16.2 44.2 17.2 43.5 17.8C42.2 19 39 20.8 36.8 21.5C38.2 22.5 40.8 24 42.8 25.2C43.8 25.8 44.2 27 43.5 27.8C42.8 28.5 41.8 28.7 40.5 28C37.8 26.5 34.5 25 32.2 24.2C33.5 25.5 36 28.2 37.8 30C38.5 30.8 38.4 31.8 37.5 32.2C36.5 32.6 35.5 32.2 34.5 31.2C32.2 28.8 29.8 25.5 28.5 23.5V26C28.5 27.2 29.5 29 30.5 30.5C31 31.2 30.8 32.2 29.8 32.5C28.8 32.8 28 32.2 27.5 31.2C26.8 29.8 26.2 27.5 26.2 25.5V19C26.8 18.5 27.5 18.2 28 18Z"
        fill="currentColor"
        opacity="0.95"
      />

      {/* Kepala & Jambul Garuda Menghadap ke Kanan */}
      <path
        d="M23.5 6.5C23.5 6.5 24.8 4 27.5 4.5C28.5 4.7 29.2 5.5 28.8 6.5C30.2 5.8 31.5 6.2 31.5 7.5C31.5 8.2 31 8.8 30.2 9.2C31.8 9 32.5 10 32.2 11C31.8 12.2 30.2 13 28.8 13.2C30 13.8 30.5 15.2 29.2 16.2C28.2 17 26.5 17.2 25 17.2C23.8 17.2 23 16.5 22.8 15.2C22.5 13.8 22.2 11.5 22.2 10.2C22.2 8.5 22.8 7.2 23.5 6.5Z"
        fill="currentColor"
      />

      {/* Paruh Emas Garuda (Menghadap Kanan Tegas) */}
      <path
        d="M28.5 10.5C30.2 10.8 33 11.5 34.5 13C33 14 30.8 14.5 28.8 14.2C28.5 12.8 28.5 11.5 28.5 10.5Z"
        fill="currentColor"
      />

      {/* Mata Garuda */}
      <circle cx="27" cy="9.5" r="1.1" fill="#1e1b4b" opacity="0.9" />

      {/* Leher & Bahu Garuda */}
      <path
        d="M22 14.5C22.8 14.5 23.5 15 24 16C24.5 15 25.2 14.5 26 14.5C27 16 27.5 18 27.5 19.5H20.5C20.5 18 21 16 22 14.5Z"
        fill="currentColor"
      />

      {/* Perisai Pancasila di Dada Garuda */}
      <path
        d="M19 19.5H29C29 19.5 29.5 27 24 30C18.5 27 19 19.5 19 19.5Z"
        fill="currentColor"
      />

      {/* Border Kontur & Garis Tengah Perisai */}
      <path
        d="M19.5 20H28.5C28.3 26 24 28.8 24 28.8C24 28.8 19.7 26 19.5 20Z"
        fill="#ffffff"
        opacity="0.25"
      />

      {/* Bintang Emas di Tengah Perisai */}
      <path
        d="M24 21.2L24.8 22.8L26.5 23L25.2 24.2L25.6 25.8L24 25L22.4 25.8L22.8 24.2L21.5 23L23.2 22.8L24 21.2Z"
        fill="currentColor"
      />

      {/* Ekor Garuda (8 Helai Bulu Ekor Pokok) */}
      <path
        d="M22.5 32H25.5L26.5 40C26.5 41 25.5 41.8 24 41.8C22.5 41.8 21.5 41 21.5 40L22.5 32Z"
        fill="currentColor"
      />
      <path
        d="M20.5 32.5L18.5 39C18.2 39.8 19 40.5 20 40.2L22 34L20.5 32.5Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M27.5 32.5L29.5 39C29.8 39.8 29 40.5 28 40.2L26 34L27.5 32.5Z"
        fill="currentColor"
        opacity="0.85"
      />

      {/* Cengkeraman Kaki Garuda (Cakar) */}
      <path
        d="M20 31.8C19.2 31.8 18.5 32.5 18.8 33.5C19 34.2 19.8 34.5 20.8 34.2L21.5 32H20Z"
        fill="currentColor"
      />
      <path
        d="M28 31.8C28.8 31.8 29.5 32.5 29.2 33.5C29 34.2 28.2 34.5 27.2 34.2L26.5 32H28Z"
        fill="currentColor"
      />

      {/* Pita Putih "Bhinneka Tunggal Ika" yang Dicengkeram */}
      <path
        d="M16 34.5C18.5 33.8 21 34.2 24 34.2C27 34.2 29.5 33.8 32 34.5C33 34.8 33.2 36 32.2 36.5C29.8 35.8 27 36 24 36C21 36 18.2 35.8 15.8 36.5C14.8 36 15 34.8 16 34.5Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
};
