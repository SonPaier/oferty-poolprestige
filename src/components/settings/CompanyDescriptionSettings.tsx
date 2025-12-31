import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, User, Upload, X } from 'lucide-react';
import { CompanySettings, ContactPersonSettings } from '@/types/configurator';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CompanyDescriptionSettingsProps {
  company: CompanySettings;
  onChange: (settings: CompanySettings) => void;
}

export function CompanyDescriptionSettings({ company, onChange }: CompanyDescriptionSettingsProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const contactPerson: ContactPersonSettings = company.contactPerson || {
    name: '',
    role: '',
    phone: '',
    email: '',
  };

  const handleContactChange = (field: keyof ContactPersonSettings, value: string) => {
    onChange({
      ...company,
      contactPerson: {
        ...contactPerson,
        [field]: value,
      },
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz plik graficzny');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `contact-person-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      handleContactChange('photo', publicUrl);
      toast.success('Zdjęcie zostało przesłane');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Błąd przesyłania zdjęcia');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    handleContactChange('photo', '');
  };

  return (
    <div className="space-y-6">
      {/* Company Description */}
      <div>
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          Opis firmy (widoczny w ofercie)
        </h3>
        <Textarea
          value={company.companyDescription || ''}
          onChange={(e) => onChange({ ...company, companyDescription: e.target.value })}
          className="input-field min-h-[120px]"
          placeholder="Przedstaw swoją firmę klientowi. Ten tekst będzie widoczny w widoku publicznym oferty..."
        />
      </div>

      {/* Contact Person */}
      <div>
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          Osoba kontaktowa (widoczna w ofercie)
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contactPersonName">Imię i nazwisko</Label>
            <Input
              id="contactPersonName"
              value={contactPerson.name}
              onChange={(e) => handleContactChange('name', e.target.value)}
              className="input-field"
              placeholder="Jan Kowalski"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contactPersonRole">Stanowisko</Label>
            <Input
              id="contactPersonRole"
              value={contactPerson.role}
              onChange={(e) => handleContactChange('role', e.target.value)}
              className="input-field"
              placeholder="Specjalista ds. basenów"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contactPersonPhone">Telefon</Label>
            <Input
              id="contactPersonPhone"
              value={contactPerson.phone}
              onChange={(e) => handleContactChange('phone', e.target.value)}
              className="input-field"
              placeholder="+48 123 456 789"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contactPersonEmail">Email</Label>
            <Input
              id="contactPersonEmail"
              type="email"
              value={contactPerson.email}
              onChange={(e) => handleContactChange('email', e.target.value)}
              className="input-field"
              placeholder="jan.kowalski@firma.pl"
            />
          </div>
          
          <div className="space-y-2 sm:col-span-2">
            <Label>Zdjęcie</Label>
            <div className="flex items-center gap-4">
              {contactPerson.photo ? (
                <div className="relative">
                  <img 
                    src={contactPerson.photo} 
                    alt="Zdjęcie osoby kontaktowej" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 w-6 h-6"
                    onClick={handleRemovePhoto}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Przesyłanie...' : 'Wybierz zdjęcie'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Zdjęcie będzie wyświetlane w widoku oferty
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}