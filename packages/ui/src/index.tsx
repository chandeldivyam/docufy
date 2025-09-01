import * as React from 'react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, ...props }) => {
  const styles: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    background: variant === 'primary' ? '#111827' : '#f3f4f6',
    color: variant === 'primary' ? '#fff' : '#111827',
    cursor: 'pointer',
  };

  return (
    <button style={styles} {...props}>
      {children}
    </button>
  );
};

export default { Button };
