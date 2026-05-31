import { type ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { BrandProvider } from './BrandContext';
import { ProgressionProvider } from './ProgressionContext';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => (
  <AuthProvider>
    <BrandProvider>
      <ProgressionProvider>
        {children}
      </ProgressionProvider>
    </BrandProvider>
  </AuthProvider>
);
