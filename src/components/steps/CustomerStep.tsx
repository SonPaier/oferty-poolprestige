import { useState, useRef, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { User, Building, Mail, Phone, MapPin, Sparkles, Loader2, Paperclip, X, FileText, Image as ImageIcon, FileSpreadsheet, Download, Pencil, Check, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
];

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
  uploadedAt?: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
  if (type === 'application/pdf') return <FileText className="w-4 h-4" />;
  if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') return <FileSpreadsheet className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
};

interface CustomerStepProps {
  onNext: () => void;
}

export function CustomerStep({ onNext }: CustomerStepProps) {
  const { state, dispatch } = useConfigurator();
  const { customerData } = state;
  
  const [emailInput, setEmailInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load attachments from customerData when editing existing offer
  useEffect(() => {
    if (customerData.attachments && customerData.attachments.length > 0 && uploadedFiles.length === 0) {
      setUploadedFiles(customerData.attachments as UploadedFile[]);
    }
  }, [customerData.attachments]);

  // Save attachments to customerData whenever they change
  useEffect(() => {
    if (uploadedFiles.length > 0 || (customerData.attachments && customerData.attachments.length > 0)) {
      if (JSON.stringify(uploadedFiles) !== JSON.stringify(customerData.attachments)) {
        dispatch({
          type: 'SET_CUSTOMER_DATA',
          payload: { ...customerData, attachments: uploadedFiles },
        });
      }
    }
  }, [uploadedFiles]);

  const updateField = (field: keyof typeof customerData, value: string) => {
    dispatch({
      type: 'SET_CUSTOMER_DATA',
      payload: { ...customerData, [field]: value },
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (uploadedFiles.length + files.length > MAX_FILES) {
      toast.error(`Maksymalnie ${MAX_FILES} plików`);
      return;
    }
    
    const validFiles = files.filter(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Nieobsługiwany format: ${file.name}`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Plik za duży (max 10MB): ${file.name}`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    setIsUploading(true);
    const newFiles: UploadedFile[] = [];
    
    for (const file of validFiles) {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { data, error } = await supabase.storage
        .from('offer-attachments')
        .upload(fileName, file);
      
      if (error) {
        console.error('Upload error:', error);
        toast.error(`Błąd uploadu: ${file.name}`);
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('offer-attachments')
        .getPublicUrl(data.path);
      
      newFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        url: urlData.publicUrl,
        path: data.path,
        uploadedAt: new Date().toISOString()
      });
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (newFiles.length > 0) {
      toast.success(`Dodano ${newFiles.length} plik(ów)`);
    }
  };
  
  const removeFile = async (path: string) => {
    const file = uploadedFiles.find(f => f.path === path);
    if (!confirm(`Czy na pewno chcesz usunąć plik "${file?.name}"?`)) return;
    
    await supabase.storage.from('offer-attachments').remove([path]);
    setUploadedFiles(prev => prev.filter(f => f.path !== path));
    toast.success('Plik usunięty');
  };

  const startEditFileName = (file: UploadedFile) => {
    setEditingFileId(file.path);
    // Remove extension for editing
    const lastDot = file.name.lastIndexOf('.');
    setEditingFileName(lastDot > 0 ? file.name.substring(0, lastDot) : file.name);
  };

  const saveFileName = (path: string) => {
    const file = uploadedFiles.find(f => f.path === path);
    if (!file || !editingFileName.trim()) {
      setEditingFileId(null);
      return;
    }
    
    // Get original extension
    const lastDot = file.name.lastIndexOf('.');
    const extension = lastDot > 0 ? file.name.substring(lastDot) : '';
    const newName = editingFileName.trim() + extension;
    
    setUploadedFiles(prev => prev.map(f => 
      f.path === path ? { ...f, name: newName } : f
    ));
    setEditingFileId(null);
    toast.success('Nazwa pliku zmieniona');
  };

  const formatUploadDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExtractFromEmail = async () => {
    if (!emailInput.trim() && uploadedFiles.length === 0) {
      toast.error('Wklej treść maila lub dodaj załączniki');
      return;
    }

    setIsExtracting(true);
    try {
      // Prepare file info for AI
      const fileInfo = uploadedFiles.map(f => ({
        name: f.name,
        type: f.type,
        url: f.url
      }));
      
      const { data, error } = await supabase.functions.invoke('extract-from-email', {
        body: { 
          emailContent: emailInput,
          attachments: fileInfo 
        },
      });

      if (error) {
        console.error('Extraction error:', error);
        toast.error('Błąd ekstrakcji danych', { 
          description: error.message || 'Spróbuj ponownie'
        });
        return;
      }

      console.log('Extracted data:', data);

      // Update customer data with extracted info and save source email
      const extracted = data.customerData || {};
      dispatch({
        type: 'SET_CUSTOMER_DATA',
        payload: {
          ...customerData,
          companyName: extracted.companyName || customerData.companyName,
          contactPerson: extracted.contactPerson || customerData.contactPerson,
          email: extracted.email || customerData.email,
          phone: extracted.phone || customerData.phone,
          address: extracted.address || customerData.address,
          city: extracted.city || customerData.city,
          postalCode: extracted.postalCode || customerData.postalCode,
          nip: extracted.nip || customerData.nip,
          sourceEmail: emailInput, // Save original email content
        },
      });

      // Update pool dimensions if found
      if (data.poolDimensions) {
        const dims = data.poolDimensions;
        if (dims.length || dims.width) {
          dispatch({
            type: 'SET_DIMENSIONS',
            payload: {
              ...state.dimensions,
              length: dims.length || state.dimensions.length,
              width: dims.width || state.dimensions.width,
              depth: dims.depth || state.dimensions.depth,
            },
          });
        }
      }

      // Update pool type if found
      if (data.poolType) {
        dispatch({ type: 'SET_POOL_TYPE', payload: data.poolType });
      }

      toast.success('Dane wyekstrahowane', {
        description: 'Sprawdź i uzupełnij brakujące pola',
      });

      setEmailInput('');
    } catch (err) {
      console.error('Extract error:', err);
      toast.error('Błąd połączenia');
    } finally {
      setIsExtracting(false);
    }
  };

  const isValid = customerData.contactPerson;

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <User className="w-5 h-5 text-primary" />
        Dane klienta
      </div>

      {/* Saved Source Email Display */}
      {customerData.sourceEmail && (
        <div className="glass-card p-4 mb-6 border-l-4 border-l-primary/50">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Treść zapytania</h3>
          </div>
          <div className="bg-muted/50 rounded-md p-3 max-h-[150px] overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
              {customerData.sourceEmail}
            </pre>
          </div>
        </div>
      )}

      {/* AI Extraction Input */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="font-medium">Automatyczne uzupełnianie z maila</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Wklej treść maila od klienta i/lub dodaj załączniki (obrazki, PDF, Excel). AI wyekstrahuje dane kontaktowe i wymiary basenu.
        </p>
        <Textarea
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Wklej tutaj treść maila, wiadomości lub zapytania od klienta..."
          className="input-field min-h-[100px] mb-3"
        />
        
        {/* File upload section */}
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || uploadedFiles.length >= MAX_FILES}
            className="mb-2"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4 mr-2" />
            )}
            Dodaj załączniki
          </Button>
          <p className="text-xs text-muted-foreground">
            Max {MAX_FILES} plików, do 10MB każdy (JPG, PNG, PDF, Excel, CSV)
          </p>
          
          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploadedFiles.map((file) => (
                <div 
                  key={file.path}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm group"
                >
                  {getFileIcon(file.type)}
                  
                  {editingFileId === file.path ? (
                    <div className="flex-1 flex items-center gap-1">
                      <Input
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        className="h-7 text-sm py-0"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveFileName(file.path);
                          if (e.key === 'Escape') setEditingFileId(null);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-500"
                        onClick={() => saveFileName(file.path)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <a 
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate hover:text-primary hover:underline transition-colors"
                      title="Pobierz plik"
                    >
                      {file.name}
                    </a>
                  )}
                  
                  <span className="text-muted-foreground text-xs hidden sm:inline">
                    {formatFileSize(file.size)}
                  </span>
                  
                  {file.uploadedAt && (
                    <span className="text-muted-foreground text-xs hidden md:flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatUploadDate(file.uploadedAt)}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => window.open(file.url, '_blank')}
                      title="Pobierz"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => startEditFileName(file)}
                      title="Zmień nazwę"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeFile(file.path)}
                      title="Usuń"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <Button
          onClick={handleExtractFromEmail}
          disabled={isExtracting || (!emailInput.trim() && uploadedFiles.length === 0)}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analizuję...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Wyekstrahuj dane
            </>
          )}
        </Button>
      </div>
      
      <div className="glass-card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="companyName" className="flex items-center gap-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              Nazwa firmy
            </Label>
            <Input
              id="companyName"
              value={customerData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="Opcjonalnie"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nip" className="flex items-center gap-2">
              NIP
            </Label>
            <Input
              id="nip"
              value={customerData.nip || ''}
              onChange={(e) => updateField('nip', e.target.value)}
              placeholder="Opcjonalnie"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson" className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Osoba kontaktowa *
            </Label>
            <Input
              id="contactPerson"
              value={customerData.contactPerson}
              onChange={(e) => updateField('contactPerson', e.target.value)}
              placeholder="Imię i nazwisko"
              className="input-field"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Telefon
            </Label>
            <Input
              id="phone"
              type="tel"
              value={customerData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+48 123 456 789"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={customerData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="email@example.com"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Miasto
            </Label>
            <Input
              id="city"
              value={customerData.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="Miejscowość"
              className="input-field"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="address">Adres</Label>
            <Input
              id="address"
              value={customerData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Ulica, numer domu"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Kod pocztowy</Label>
            <Input
              id="postalCode"
              value={customerData.postalCode}
              onChange={(e) => updateField('postalCode', e.target.value)}
              placeholder="00-000"
              className="input-field"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
