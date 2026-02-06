import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Trash2 } from 'lucide-react';
import { useProducts, getDbProductPriceInPLN } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/calculations';
import { useDebounce } from '@/hooks/useDebounce';

export interface ExtraLineItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  netValue: number;
  productId?: string;
}

const UNIT_OPTIONS = [
  { value: 'szt.', label: 'szt.' },
  { value: 'm²', label: 'm²' },
  { value: 'm³', label: 'm³' },
  { value: 'mb', label: 'mb' },
  { value: 'kpl', label: 'kpl' },
  { value: 'ryczałt', label: 'ryczałt' },
];

interface ExtraLineItemsProps {
  items: ExtraLineItem[];
  onAdd: (item: ExtraLineItem) => void;
  onRemove: (id: string) => void;
  colSpan?: number;
}

export function ExtraLineItemRows({ items, onRemove }: { items: ExtraLineItem[]; onRemove: (id: string) => void }) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <TableRow key={item.id} className="bg-accent/30">
          <TableCell className="font-medium">
            {item.name}
            {item.productId && <span className="text-xs text-muted-foreground ml-1">(z bazy)</span>}
          </TableCell>
          <TableCell className="text-right">{item.quantity}</TableCell>
          <TableCell>{item.unit}</TableCell>
          <TableCell className="text-right">{formatPrice(item.rate)}</TableCell>
          <TableCell className="text-right font-semibold">
            <div className="flex items-center justify-end gap-1">
              {formatPrice(item.netValue)}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive/80"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AddItemRow({ onAdd }: { onAdd: (item: ExtraLineItem) => void }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('szt.');
  const [rate, setRate] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: products } = useProducts(debouncedSearch, 10);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>();

  const netValue = quantity * rate;

  const handleAdd = () => {
    if (!name.trim() || rate <= 0) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      quantity,
      unit,
      rate,
      netValue,
      productId: selectedProductId,
    });
    // Reset
    setName('');
    setQuantity(1);
    setUnit('szt.');
    setRate(0);
    setSelectedProductId(undefined);
    setSearchQuery('');
  };

  return (
    <TableRow className="border-dashed border-t">
      <TableCell>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSearchQuery(e.target.value);
                setSelectedProductId(undefined);
                if (e.target.value.length >= 2) setPopoverOpen(true);
              }}
              placeholder="Nazwa pozycji lub szukaj..."
              className="w-full min-w-[180px]"
            />
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command shouldFilter={false}>
              <CommandInput
                value={searchQuery}
                onValueChange={(v) => {
                  setSearchQuery(v);
                  setName(v);
                }}
                placeholder="Szukaj produktu..."
              />
              <CommandList>
                <CommandEmpty>Brak wyników — wpisz ręcznie</CommandEmpty>
                <CommandGroup heading="Produkty z bazy">
                  {(products || []).map((p) => (
                    <CommandItem
                      key={p.id}
                      onSelect={() => {
                        const pricePLN = getDbProductPriceInPLN(p);
                        setName(p.name);
                        setRate(pricePLN);
                        setSelectedProductId(p.id);
                        setPopoverOpen(false);
                      }}
                    >
                      <div className="flex flex-col gap-0.5 w-full">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{p.symbol}</span>
                          <span>{formatPrice(getDbProductPriceInPLN(p))}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
          className="w-20 text-right"
          min={0}
          step={1}
        />
      </TableCell>
      <TableCell>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={rate || ''}
          onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
          className="w-24 text-right"
          min={0}
          placeholder="0"
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <span className="text-muted-foreground">{netValue > 0 ? formatPrice(netValue) : '—'}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            onClick={handleAdd}
            disabled={!name.trim() || rate <= 0}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
