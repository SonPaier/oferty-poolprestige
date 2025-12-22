import { supabase } from '@/integrations/supabase/client';
import { SavedOffer, ExcavationData } from '@/types/offers';
import { CustomerData, PoolDimensions, PoolType, PoolCalculations, OfferItem } from '@/types/configurator';
import { Json } from '@/integrations/supabase/types';
// Generate unique share UID with timestamp and random string
export function generateShareUid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const extraRandom = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${randomPart}-${extraRandom}`;
}

export interface DbOffer {
  id: string;
  share_uid: string;
  offer_number: string;
  created_at: string;
  updated_at: string;
  customer_data: CustomerData;
  pool_type: PoolType;
  dimensions: PoolDimensions;
  calculations: PoolCalculations | null;
  sections: Record<string, { items: OfferItem[] }>;
  excavation: ExcavationData;
  total_net: number;
  total_gross: number;
}

// Convert DB format to SavedOffer format
export function dbToSavedOffer(dbOffer: DbOffer): SavedOffer & { shareUid: string } {
  return {
    id: dbOffer.id,
    shareUid: dbOffer.share_uid,
    offerNumber: dbOffer.offer_number,
    createdAt: dbOffer.created_at,
    updatedAt: dbOffer.updated_at,
    customerData: dbOffer.customer_data as CustomerData,
    poolType: dbOffer.pool_type as PoolType,
    dimensions: dbOffer.dimensions as PoolDimensions,
    calculations: dbOffer.calculations as PoolCalculations | null,
    sections: dbOffer.sections as Record<string, { items: OfferItem[] }>,
    excavation: dbOffer.excavation as ExcavationData,
    totalNet: dbOffer.total_net,
    totalGross: dbOffer.total_gross,
  };
}

// Save offer to database
export async function saveOfferToDb(offer: SavedOffer): Promise<{ shareUid: string; id: string } | null> {
  const shareUid = generateShareUid();
  
  const { data, error } = await supabase
    .from('offers')
    .insert({
      share_uid: shareUid,
      offer_number: offer.offerNumber,
      customer_data: offer.customerData as unknown as Json,
      pool_type: offer.poolType,
      dimensions: offer.dimensions as unknown as Json,
      calculations: offer.calculations as unknown as Json,
      sections: offer.sections as unknown as Json,
      excavation: offer.excavation as unknown as Json,
      total_net: offer.totalNet,
      total_gross: offer.totalGross,
    })
    .select('id, share_uid')
    .single();

  if (error) {
    console.error('Error saving offer to DB:', error);
    return null;
  }

  return { shareUid: data.share_uid, id: data.id };
}

// Update existing offer
export async function updateOfferInDb(id: string, offer: Partial<SavedOffer>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  
  if (offer.offerNumber) updateData.offer_number = offer.offerNumber;
  if (offer.customerData) updateData.customer_data = offer.customerData;
  if (offer.poolType) updateData.pool_type = offer.poolType;
  if (offer.dimensions) updateData.dimensions = offer.dimensions;
  if (offer.calculations !== undefined) updateData.calculations = offer.calculations;
  if (offer.sections) updateData.sections = offer.sections;
  if (offer.excavation) updateData.excavation = offer.excavation;
  if (offer.totalNet !== undefined) updateData.total_net = offer.totalNet;
  if (offer.totalGross !== undefined) updateData.total_gross = offer.totalGross;

  const { error } = await supabase
    .from('offers')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating offer:', error);
    return false;
  }

  return true;
}

// Get all offers from database
export async function getOffersFromDb(): Promise<(SavedOffer & { shareUid: string })[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching offers:', error);
    return [];
  }

  return (data || []).map((row) => dbToSavedOffer(row as unknown as DbOffer));
}

// Get offer by share UID
export async function getOfferByShareUid(shareUid: string): Promise<(SavedOffer & { shareUid: string }) | null> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('share_uid', shareUid)
    .single();

  if (error) {
    console.error('Error fetching offer by share UID:', error);
    return null;
  }

  return dbToSavedOffer(data as unknown as DbOffer);
}

// Get offer by ID
export async function getOfferByIdFromDb(id: string): Promise<(SavedOffer & { shareUid: string }) | null> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching offer by ID:', error);
    return null;
  }

  return dbToSavedOffer(data as unknown as DbOffer);
}

// Delete offer from database
export async function deleteOfferFromDb(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting offer:', error);
    return false;
  }

  return true;
}

// Search offers
export async function searchOffersInDb(query: string): Promise<(SavedOffer & { shareUid: string })[]> {
  const allOffers = await getOffersFromDb();
  
  if (!query.trim()) return allOffers;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return allOffers.filter(offer => {
    const { customerData, offerNumber, createdAt } = offer;
    
    return (
      offerNumber.toLowerCase().includes(lowerQuery) ||
      customerData.contactPerson.toLowerCase().includes(lowerQuery) ||
      customerData.companyName?.toLowerCase().includes(lowerQuery) ||
      customerData.email?.toLowerCase().includes(lowerQuery) ||
      customerData.phone?.includes(lowerQuery) ||
      createdAt.includes(lowerQuery)
    );
  });
}
