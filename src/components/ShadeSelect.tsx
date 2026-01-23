import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SHADE_OPTIONS = [
  { value: 'biały', label: 'Biały', hex: '#FFFFFF' },
  { value: 'beżowy', label: 'Beżowy', hex: '#D2B48C' },
  { value: 'szary', label: 'Szary', hex: '#808080' },
  { value: 'czarny', label: 'Czarny', hex: '#1A1A1A' },
  { value: 'niebieski', label: 'Niebieski', hex: '#4169E1' },
  { value: 'turkusowy', label: 'Turkusowy', hex: '#20B2AA' },
  { value: 'zielony', label: 'Zielony', hex: '#228B22' },
  { value: 'brązowy', label: 'Brązowy', hex: '#8B4513' },
] as const;

export type ShadeValue = typeof SHADE_OPTIONS[number]['value'] | null;

interface ShadeSelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function ShadeSelect({ value, onChange, placeholder = "Wybierz odcień", className }: ShadeSelectProps) {
  const selectedOption = SHADE_OPTIONS.find(opt => opt.value === value);
  
  return (
    <Select 
      value={value || ''} 
      onValueChange={(val) => onChange(val === '__none__' ? null : val)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedOption && (
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full border border-border shrink-0"
                style={{ backgroundColor: selectedOption.hex }}
              />
              <span>{selectedOption.label}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-border bg-background" />
            <span className="text-muted-foreground">Brak</span>
          </div>
        </SelectItem>
        {SHADE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full border border-border shrink-0"
                style={{ backgroundColor: option.hex }}
              />
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Helper to get hex for a shade value
export function getShadeHex(shade: string | null | undefined): string | null {
  if (!shade) return null;
  const option = SHADE_OPTIONS.find(opt => opt.value === shade);
  return option?.hex || null;
}
