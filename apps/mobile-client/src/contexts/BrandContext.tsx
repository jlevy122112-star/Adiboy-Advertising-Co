import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Brand } from '../types';
import { useAuth } from './AuthContext';

interface BrandContextValue {
  brands: Brand[];
  activeBrand: Brand | null;
  isLoading: boolean;
  setActiveBrand: (brand: Brand) => void;
  refreshBrands: () => Promise<void>;
  createBrand: (data: Partial<Brand>) => Promise<Brand>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBrands = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/brands', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands);
        // Set first brand as active if none selected
        if (!activeBrand && data.brands.length > 0) {
          setActiveBrand(data.brands[0]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchBrands();
  }, [isAuthenticated]);

  const createBrand = async (data: Partial<Brand>): Promise<Brand> => {
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create brand');
    const result = await res.json();
    setBrands(prev => [...prev, result.brand]);
    return result.brand;
  };

  return (
    <BrandContext.Provider
      value={{
        brands,
        activeBrand,
        isLoading,
        setActiveBrand,
        refreshBrands: fetchBrands,
        createBrand,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = (): BrandContextValue => {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
};
