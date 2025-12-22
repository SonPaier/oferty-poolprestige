import { useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { saveOfferToDb, updateOfferInDb } from '@/lib/offerDb';
import { generateOfferNumber, saveOffer, SavedOffer, calculateExcavation } from '@/types/offers';
import { toast } from 'sonner';
import { useState, useCallback } from 'react';

export function useOfferSave() {
  const { state } = useConfigurator();
  const { excavationSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);

  const saveCurrentOffer = useCallback(async (status: 'queue' | 'draft' | 'sent' = 'draft'): Promise<{ success: boolean; offerId?: string; shareUid?: string }> => {
    if (isSaving) {
      return { success: false };
    }
    
    setIsSaving(true);
    
    try {
      const { customerData, dimensions, calculations, sections, poolType, editMode } = state;
      
      // Calculate excavation
      const excavation = calculateExcavation(dimensions, excavationSettings);
      
      // Calculate totals (simplified - full calculation in SummaryStep)
      const productsTotal = Object.values(sections).reduce((sum, section) => {
        return sum + section.items.reduce((itemSum, item) => {
          return itemSum + (item.product.price * item.quantity);
        }, 0);
      }, 0);
      
      const excavationTotal = excavation.excavationTotal + excavation.removalFixedPrice;
      const grandTotalNet = productsTotal + excavationTotal;
      const grandTotalGross = grandTotalNet * 1.23; // 23% VAT
      
      // Prepare sections data
      const sectionsData = Object.fromEntries(
        Object.entries(sections).map(([key, section]) => [key, { items: section.items }])
      );
      
      if (editMode.isEditing && editMode.offerId) {
        // Update existing offer
        const success = await updateOfferInDb(editMode.offerId, {
          customerData,
          poolType,
          dimensions,
          calculations,
          sections: sectionsData as Record<string, { items: any[] }>,
          excavation,
          totalNet: grandTotalNet,
          totalGross: grandTotalGross,
        });
        
        if (success) {
          toast.success('Zmiany zostały zapisane', {
            description: `Oferta ${editMode.offerNumber} zaktualizowana`,
          });
          return { success: true, offerId: editMode.offerId, shareUid: editMode.shareUid || undefined };
        } else {
          toast.error('Błąd zapisu zmian');
          return { success: false };
        }
      } else {
        // Create new offer
        const offerNumber = generateOfferNumber();
        
        const offer: SavedOffer = {
          id: crypto.randomUUID(),
          offerNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customerData,
          poolType,
          dimensions,
          calculations,
          sections: sectionsData as Record<string, { items: any[] }>,
          excavation,
          totalNet: grandTotalNet,
          totalGross: grandTotalGross,
          status,
        };
        
        // Save to localStorage (backup)
        saveOffer(offer);
        
        // Save to database
        const dbResult = await saveOfferToDb(offer, status);
        
        if (dbResult) {
          toast.success('Oferta została zapisana', {
            description: `Numer: ${offerNumber}`,
          });
          return { success: true, offerId: dbResult.id, shareUid: dbResult.shareUid };
        } else {
          toast.warning('Oferta zapisana lokalnie', {
            description: 'Błąd zapisu do bazy danych',
          });
          return { success: true, offerId: offer.id };
        }
      }
    } catch (error) {
      console.error('Error saving offer:', error);
      toast.error('Błąd zapisu oferty');
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, state, excavationSettings]);

  return {
    saveCurrentOffer,
    isSaving,
  };
}
