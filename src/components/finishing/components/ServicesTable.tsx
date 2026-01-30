import { ServiceItem } from '../FinishingWizardContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/calculations';

interface ServicesTableProps {
  services: ServiceItem[];
  onUpdateService: (id: string, updates: Partial<ServiceItem>) => void;
}

export function ServicesTable({ services, onUpdateService }: ServicesTableProps) {
  const handleToggle = (id: string, enabled: boolean) => {
    onUpdateService(id, { isEnabled: enabled });
  };
  
  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Inne';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceItem[]>);
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usługa</TableHead>
          <TableHead className="w-[80px] text-right">Ilość</TableHead>
          <TableHead className="w-[80px]">Jed.</TableHead>
          <TableHead className="w-[100px] text-right">Cena/jed.</TableHead>
          <TableHead className="w-[120px] text-right">Razem</TableHead>
          <TableHead className="w-[80px] text-center">Aktywna</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(groupedServices).map(([category, categoryServices]) => (
          <>
            {/* Category header */}
            <TableRow key={`cat-${category}`} className="bg-muted/30">
              <TableCell colSpan={6} className="font-medium text-sm py-2">
                {category}
              </TableCell>
            </TableRow>
            
            {/* Services in category */}
            {categoryServices.map((service) => (
              <TableRow
                key={service.id}
                className={!service.isEnabled ? 'opacity-50' : ''}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{service.name}</span>
                    {service.isOptional && (
                      <Badge variant="outline" className="text-xs">
                        opcjonalna
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{service.quantity}</TableCell>
                <TableCell>{service.unit}</TableCell>
                <TableCell className="text-right">
                  {formatPrice(service.pricePerUnit)} zł
                </TableCell>
                <TableCell className="text-right font-medium">
                  {service.isEnabled ? formatPrice(service.total) : '—'} zł
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={service.isEnabled}
                    onCheckedChange={(checked) => handleToggle(service.id, checked)}
                    disabled={!service.isOptional}
                  />
                </TableCell>
              </TableRow>
            ))}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
