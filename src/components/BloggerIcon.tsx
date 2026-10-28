import React from 'react';

interface BloggerIconProps {
  className?: string;
  size?: number;
}

export const BloggerIcon: React.FC<BloggerIconProps> = ({ className = 'w-5 h-5', size }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Google Blogger Logo"
    >
      <path
        d="M19.5 0h-15A4.5 4.5 0 0 0 0 4.5v15A4.5 4.5 0 0 0 4.5 24h15a4.5 4.5 0 0 0 4.5-4.5v-15A4.5 4.5 0 0 0 19.5 0zm-3 7.5a1.5 1.5 0 0 1 1.5 1.5v1.5a1.5 1.5 0 0 1-1.5 1.5H8.25a1.5 1.5 0 0 1-1.5-1.5V9a1.5 1.5 0 0 1 1.5-1.5h8.25zm-2.25 6a1.5 1.5 0 0 1 1.5 1.5v1.5a1.5 1.5 0 0 1-1.5 1.5H8.25a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5h6z"
        fill="#FF5722"
      />
      <path
        d="M20 0H4C1.79 0 0 1.79 0 4v16c0 2.21 1.79 4 4 4h16c2.21 0 4-1.79 4-4V4c0-2.21-1.79-4-4-4zm-4.5 18H8.25C7.01 18 6 16.99 6 15.75v-1.5c0-.97.62-1.8 1.5-2.12-.88-.32-1.5-1.15-1.5-2.13V8.5C6 7.12 7.12 6 8.5 6h7c1.38 0 2.5 1.12 2.5 2.5V9c0 .83-.41 1.57-1.04 2.02.63.45 1.04 1.19 1.04 2.02v2.71c0 1.24-1.01 2.25-2.5 2.25z"
        fill="#FF5722"
      />
      <path
        d="M15.5 8.25h-7a.25.25 0 0 0-.25.25v1.5c0 .14.11.25.25.25h7a.25.25 0 0 0 .25-.25v-1.5a.25.25 0 0 0-.25-.25zm.5 5.5h-7.5a.25.25 0 0 0-.25.25v2c0 .14.11.25.25.25H16a.25.25 0 0 0 .25-.25v-2a.25.25 0 0 0-.25-.25z"
        fill="#ffffff"
      />
    </svg>
  );
};
