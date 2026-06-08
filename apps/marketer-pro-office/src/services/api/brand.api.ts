import type { Brand } from '@/types/brand.types'
import { supabase } from './supabase.client'

export async function getBrand(workspaceId: string): Promise<Brand | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapRowToBrand(data)
}

export async function createBrand(data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
  const { data: row, error } = await supabase
    .from('brands')
    .insert(mapBrandToRow(data))
    .select()
    .single()

  if (error) throw error
  return mapRowToBrand(row)
}

export async function updateBrand(id: string, data: Partial<Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Brand> {
  const { data: row, error } = await supabase
    .from('brands')
    .update({ ...mapBrandToRow(data as Brand), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapRowToBrand(row)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToBrand(row: Record<string, any>): Brand {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    tagline: row.tagline ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    voice: row.voice,
    industry: row.industry,
    targetAudience: row.target_audience,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBrandToRow(brand: Partial<Brand>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (brand.workspaceId !== undefined) row.workspace_id = brand.workspaceId
  if (brand.name !== undefined) row.name = brand.name
  if (brand.tagline !== undefined) row.tagline = brand.tagline
  if (brand.logoUrl !== undefined) row.logo_url = brand.logoUrl
  if (brand.primaryColor !== undefined) row.primary_color = brand.primaryColor
  if (brand.secondaryColor !== undefined) row.secondary_color = brand.secondaryColor
  if (brand.accentColor !== undefined) row.accent_color = brand.accentColor
  if (brand.voice !== undefined) row.voice = brand.voice
  if (brand.industry !== undefined) row.industry = brand.industry
  if (brand.targetAudience !== undefined) row.target_audience = brand.targetAudience
  return row
}
