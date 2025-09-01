import * as React from 'react';

export const H1: React.FC<React.PropsWithChildren> = ({ children }) => (
  <h1 style={{ fontSize: 32, fontWeight: 700, margin: '16px 0' }}>{children}</h1>
);

export const P: React.FC<React.PropsWithChildren> = ({ children }) => (
  <p style={{ margin: '8px 0' }}>{children}</p>
);

export default { H1, P };
