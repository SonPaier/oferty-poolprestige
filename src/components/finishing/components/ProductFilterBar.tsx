import { useFinishingWizard } from '../FinishingWizardContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X, Palette, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductFilterBarProps {
  availableSubtypes: string[];
  availableColors: { value: string; label: string; hex?: string }[];
  productCount: number;
}

// Color hex values for visual indicator
const colorHexMap: Record<string, string> = {
  'niebieska': '#3B82F6',
  'biała': '#F8FAFC',
  'turkus': '#14B8A6',
  'szara': '#6B7280',
  'piaskowa': '#D4A574',
  'persja niebieska': '#1E40AF',
  'bizancjum niebieska': '#312E81',
  'marble': '#E2E8F0',
  'vanity': '#C084FC',
  'greek': '#0EA5E9',
  'carrara': '#F1F5F9',
  'antracyt': '#374151',
  'standard': '#60A5FA',
  'blue': '#3B82F6',
  'white': '#F8FAFC',
};

export function ProductFilterBar({
  availableSubtypes,
  availableColors,
  productCount,
}: ProductFilterBarProps) {
  const { state, dispatch } = useFinishingWizard();
  const { filters } = state;
  
  const handleSubtypeChange = (value: string) => {
    dispatch({
      type: 'SET_FILTERS',
      payload: { subtype: value === 'all' ? null : value },
    });
  };
  
  const handleColorToggle = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color];
    dispatch({ type: 'SET_FILTERS', payload: { colors: newColors } });
  };
  
  const handleSearchChange = (value: string) => {
    dispatch({ type: 'SET_FILTERS', payload: { searchQuery: value } });
  };
  
  const clearFilters = () => {
    dispatch({
      type: 'SET_FILTERS',
      payload: { subtype: null, colors: [], searchQuery: '' },
    });
  };
  
  const hasActiveFilters = 
    filters.subtype !== null || 
    filters.colors.length > 0 || 
    filters.searchQuery.length > 0;
  
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj produktu..."
            value={filters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8"
          />
          {filters.searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Subtype select */}
        <Select
          value={filters.subtype || 'all'}
          onValueChange={handleSubtypeChange}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Podtyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie podtypy</SelectItem>
            {availableSubtypes.map((subtype) => (
              <SelectItem key={subtype} value={subtype}>
                {subtype}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Color multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "min-w-[140px]",
                filters.colors.length > 0 && "border-primary"
              )}
            >
              <Palette className="w-4 h-4 mr-2" />
              Kolory
              {filters.colors.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.colors.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Wybierz kolory</h4>
              <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto">
                {availableColors.map((color) => (
                  <label
                    key={color.value}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.colors.includes(color.value)}
                      onCheckedChange={() => handleColorToggle(color.value)}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-border shrink-0"
                      style={{ 
                        backgroundColor: color.hex || colorHexMap[color.value.toLowerCase()] || '#9CA3AF' 
                      }}
                    />
                    <span className="text-sm truncate">{color.label}</span>
                  </label>
                ))}
              </div>
              {filters.colors.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => dispatch({ type: 'SET_FILTERS', payload: { colors: [] } })}
                >
                  Wyczyść wybór
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Wyczyść filtry
          </Button>
        )}
      </div>
      
      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Znaleziono <strong className="text-foreground">{productCount}</strong> produktów
        </span>
        {hasActiveFilters && (
          <span>
            Aktywne filtry: {[
              filters.subtype && `podtyp: ${filters.subtype}`,
              filters.colors.length > 0 && `${filters.colors.length} kolorów`,
              filters.searchQuery && `szukaj: "${filters.searchQuery}"`,
            ].filter(Boolean).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
