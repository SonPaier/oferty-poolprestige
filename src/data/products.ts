// Product database converted from Excel
export interface Product {
  id: string;
  symbol: string;
  name: string;
  price: number;
  currency: 'PLN' | 'EUR';
  description?: string;
  category: ProductCategory;
  subcategory?: string;
  specs?: Record<string, string | number>;
  imageId?: string;
}

export type ProductCategory = 
  | 'pompy'
  | 'filtry'
  | 'folia'
  | 'oswietlenie'
  | 'automatyka'
  | 'uzbrojenie'
  | 'atrakcje'
  | 'materialy'
  | 'chemia'
  | 'akcesoria';

export const categoryLabels: Record<ProductCategory, string> = {
  pompy: 'Pompy obiegowe',
  filtry: 'Filtry',
  folia: 'Folia basenowa',
  oswietlenie: 'Oświetlenie',
  automatyka: 'Automatyka',
  uzbrojenie: 'Uzbrojenie niecki',
  atrakcje: 'Atrakcje',
  materialy: 'Materiały budowlane',
  chemia: 'Chemia basenowa',
  akcesoria: 'Akcesoria',
};

// Sample products from the database
export const products: Product[] = [
  // POMPY
  {
    id: 'p1',
    symbol: '100704',
    name: 'Pompa obiegowa IML Discovery 21m3/h, 1,1kW, 230V',
    price: 874.42,
    currency: 'PLN',
    category: 'pompy',
    specs: { wydajnosc: 21, moc: 1.1, napiecie: 230 },
    description: 'Pompa produkowana w Europie. Obudowa wzmocniona włóknem szklanym.'
  },
  {
    id: 'p2',
    symbol: '10072',
    name: 'Pompa obiegowa IML Discovery 28m3/h, 2,2kW, 230V',
    price: 278.61,
    currency: 'EUR',
    category: 'pompy',
    specs: { wydajnosc: 28, moc: 2.2, napiecie: 230 }
  },
  {
    id: 'p3',
    symbol: '182239',
    name: 'Pompa obiegowa Badu 90/30, 31m3/h, 230V, 1,5kW',
    price: 1850,
    currency: 'PLN',
    category: 'pompy',
    specs: { wydajnosc: 31, moc: 1.5, napiecie: 230 },
    description: 'Najwyższa jakość, cicha praca, odporność i trwałość.'
  },
  {
    id: 'p4',
    symbol: '10078',
    name: 'Pompa NewBCC 300, 45m3/h, 400V, 2,2kW',
    price: 1266.51,
    currency: 'PLN',
    category: 'pompy',
    specs: { wydajnosc: 45, moc: 2.2, napiecie: 400 }
  },
  {
    id: 'p5',
    symbol: '219.0008.138',
    name: 'Pompa Speck Badu Eco Soft 0,75kW, max 22m3/h',
    price: 2200,
    currency: 'PLN',
    category: 'pompy',
    specs: { wydajnosc: 22, moc: 0.75, napiecie: 230 },
    description: 'Regulowana wydajność, energooszczędna.'
  },
  {
    id: 'p6',
    symbol: '10022',
    name: 'Pompa Speck Badu Bettar 12m3/h, 0,45kW, 230V',
    price: 1104.07,
    currency: 'PLN',
    category: 'pompy',
    specs: { wydajnosc: 12, moc: 0.45, napiecie: 230 }
  },

  // FILTRY
  {
    id: 'f1',
    symbol: '04024',
    name: 'Filtr laminowany SYRIUS NORM 100, 650mm, złoże 1m',
    price: 3100.10,
    currency: 'PLN',
    category: 'filtry',
    specs: { srednica: 650, wysokoscZloza: 100, wydajnosc: 10 },
    description: 'Najlepszy filtr poliestrowy na rynku z klasy Prestige.'
  },
  {
    id: 'f2',
    symbol: '04026',
    name: 'Filtr laminowany SYRIUS NORM 100, 800mm, złoże 1m',
    price: 731.32,
    currency: 'EUR',
    category: 'filtry',
    specs: { srednica: 800, wysokoscZloza: 100, wydajnosc: 16 },
    description: 'Do basenów w hotelach i prywatnych o wysokim standardzie.'
  },
  {
    id: 'f3',
    symbol: '04016',
    name: 'Filtr Syrius NORM 120, 1250mm, dno dyszowe, złoże 120cm',
    price: 2930.85,
    currency: 'EUR',
    category: 'filtry',
    specs: { srednica: 1250, wysokoscZloza: 120, wydajnosc: 40 },
    description: 'Do basenów publicznych, hotelowych.'
  },

  // FOLIA
  {
    id: 'fo1',
    symbol: '069900',
    name: 'Folia Alkorplan 2000 - szer. 1,65m, niebieska',
    price: 50.21,
    currency: 'PLN',
    category: 'folia',
    specs: { szerokosc: 1.65, typ: 'tradycyjna', grubosc: 1.5 }
  },
  {
    id: 'fo2',
    symbol: '069903',
    name: 'Folia Alkorplan 2000 - szer. 2,05m, niebieska',
    price: 50.21,
    currency: 'PLN',
    category: 'folia',
    specs: { szerokosc: 2.05, typ: 'tradycyjna', grubosc: 1.5 },
    description: 'Wygładzona folia PVC o grubości 1,5mm.'
  },
  {
    id: 'fo3',
    symbol: '069945',
    name: 'Folia Alkorplan 3000 - szer. 1,65m, persja niebieska',
    price: 71.06,
    currency: 'PLN',
    category: 'folia',
    specs: { szerokosc: 1.65, typ: 'strukturalna', grubosc: 1.5 },
    description: 'Folia z nadrukowanym wzorem.'
  },
  {
    id: 'fo4',
    symbol: '070035',
    name: 'Folia Alkorplan Relief schodowa antypoślizgowa 1,65m - biała',
    price: 110.58,
    currency: 'PLN',
    category: 'folia',
    specs: { szerokosc: 1.65, typ: 'antyposlizgowa', grubosc: 1.5 }
  },

  // OŚWIETLENIE
  {
    id: 'l1',
    symbol: '24405LEDmaxi',
    name: 'Lampa Euro WHITE-STEEL, LED 30W, 2400lm, zimna',
    price: 461.36,
    currency: 'PLN',
    category: 'oswietlenie',
    specs: { moc: 30, lumeny: 2400, barwa: 'zimna' },
    description: 'Korpus z tworzywa, osłona ze stali nierdzewnej.'
  },
  {
    id: 'l2',
    symbol: '30270',
    name: 'Lampa nierdzewna 270mm do folii',
    price: 382.08,
    currency: 'PLN',
    category: 'oswietlenie',
    specs: { srednica: 270, material: 'AISI 316' },
    description: 'Stal nierdzewna AISI 316, IP68.'
  },
  {
    id: 'l3',
    symbol: '30110',
    name: 'Lampa nierdzewna 100mm do folii',
    price: 447.43,
    currency: 'PLN',
    category: 'oswietlenie',
    specs: { srednica: 100, material: 'AISI 316' }
  },
  {
    id: 'l4',
    symbol: '24881',
    name: 'Żarówka LED MAXI 12V, 30W, 2400lm, zimna',
    price: 197.22,
    currency: 'PLN',
    category: 'oswietlenie',
    specs: { moc: 30, lumeny: 2400, barwa: 'zimna' }
  },
  {
    id: 'l5',
    symbol: '24880',
    name: 'Żarówka LED 12V, 14W, 1000lm, PAR56, zimna',
    price: 162.04,
    currency: 'PLN',
    category: 'oswietlenie',
    specs: { moc: 14, lumeny: 1000, barwa: 'zimna' }
  },

  // AUTOMATYKA
  {
    id: 'a1',
    symbol: 'PCS public',
    name: 'Sterownik PCS pH, redox, chlor, temperatura - public',
    price: 9900.00,
    currency: 'PLN',
    category: 'automatyka',
    description: 'Kompleksowa automatyczna obsługa obiektów basenowych.'
  },
  {
    id: 'a2',
    symbol: '1116000',
    name: 'Automat dozujący Tebas Future pH/redox, bez pomp',
    price: 854.70,
    currency: 'EUR',
    category: 'automatyka'
  },
  {
    id: 'a3',
    symbol: '14613',
    name: 'Pompa ciepła Tebas 11,5 - 16kW, 230V',
    price: 1270.40,
    currency: 'EUR',
    category: 'automatyka',
    description: 'Ekonomiczne grzanie basenu od wiosny do jesieni.'
  },

  // UZBROJENIE NIECKI
  {
    id: 'u1',
    symbol: '24210',
    name: 'Dysza EURO z tworzywa GZ 2" - do basenu foliowanego',
    price: 41.88,
    currency: 'PLN',
    category: 'uzbrojenie',
    description: 'Dysza napływowa do ściany basenu.'
  },
  {
    id: 'u2',
    symbol: '21410',
    name: 'Dysza WHITE-STEEL nierdzewna - do basenu foliowanego',
    price: 41.84,
    currency: 'EUR',
    category: 'uzbrojenie',
    description: 'Korpus z tworzywa, maskownica ze stali nierdzewnej.'
  },
  {
    id: 'u3',
    symbol: '21400',
    name: 'Skimmer WHITE-STEEL nierdzewny - do basenu foliowanego',
    price: 562.40,
    currency: 'PLN',
    category: 'uzbrojenie',
    description: 'Maksymalny przepływ 8m3/h.'
  },
  {
    id: 'u4',
    symbol: '24300',
    name: 'Odpływ kratka denna z tworzywa EURO, GW 2"',
    price: 41.31,
    currency: 'PLN',
    category: 'uzbrojenie'
  },
  {
    id: 'u5',
    symbol: '324300',
    name: 'Dysza denna z brązu Hugo Lahme, 1 1/2"',
    price: 349.00,
    currency: 'PLN',
    category: 'uzbrojenie',
    description: 'Premium, pokrywa ze stali nierdzewnej.'
  },
  {
    id: 'u6',
    symbol: '324736',
    name: 'Odpływ denny z brązu, wyjście pionowe 2"',
    price: 361.00,
    currency: 'PLN',
    category: 'uzbrojenie'
  },

  // MATERIAŁY
  {
    id: 'm1',
    symbol: 'g400',
    name: 'Podkład włóknina 400g/m2',
    price: 5.50,
    currency: 'PLN',
    category: 'materialy',
    description: 'Geowłóknina pod folię, szerokość 2m.'
  },
  {
    id: 'm2',
    symbol: '070111i',
    name: 'Kątownik stalowy Tebas 3x6cm powlekany PCW, 2m',
    price: 5.68,
    currency: 'EUR',
    category: 'materialy'
  },
  {
    id: 'm3',
    symbol: '070110folia',
    name: 'Płaskownik powlekany PCW - dł. 2m',
    price: 11.83,
    currency: 'PLN',
    category: 'materialy'
  },
  {
    id: 'm4',
    symbol: '070100',
    name: 'Nity montażowe 200szt.',
    price: 35.57,
    currency: 'EUR',
    category: 'materialy'
  },

  // ZŁOŻE FILTRACYJNE
  {
    id: 'z1',
    symbol: 'piasek 04-08',
    name: 'Piasek filtracyjny 0,4-0,8mm, worek 25kg',
    price: 20.90,
    currency: 'PLN',
    category: 'materialy',
    subcategory: 'zloze'
  },
  {
    id: 'z2',
    symbol: '00030',
    name: 'Złoże szklane AFM stopień 1, 0,4-1,0mm, 21kg',
    price: 88.65,
    currency: 'PLN',
    category: 'materialy',
    subcategory: 'zloze',
    description: 'O 30% lepsza filtracja niż piasek.'
  },
  {
    id: 'z3',
    symbol: '00032',
    name: 'Złoże szklane AFM stopień 2, 1,0-2,0mm, 21kg',
    price: 73.53,
    currency: 'PLN',
    category: 'materialy',
    subcategory: 'zloze'
  },

  // DRABINY I PORĘCZE
  {
    id: 'd1',
    symbol: '30017',
    name: 'Drabina Maria 3 stopniowa, stal AISI 304',
    price: 459.44,
    currency: 'PLN',
    category: 'akcesoria',
    subcategory: 'drabiny'
  },
  {
    id: 'd2',
    symbol: '87100319',
    name: 'Poręcz FX-7 stal nierdzewna AISI-316, komplet 2szt.',
    price: 489.20,
    currency: 'PLN',
    category: 'akcesoria',
    subcategory: 'drabiny'
  },

  // PRZYKRYCIA
  {
    id: 'pr1',
    symbol: '00090lux5',
    name: 'Folia komórkowa deLUX szer. 5m, ciemnoniebieska',
    price: 71.45,
    currency: 'PLN',
    category: 'akcesoria',
    subcategory: 'przykrycia'
  },
  {
    id: 'pr2',
    symbol: '00125',
    name: 'Rolka zwijająca mobilna do 5m szerokości',
    price: 718.83,
    currency: 'PLN',
    category: 'akcesoria',
    subcategory: 'przykrycia'
  },

  // WYMIENNIKI CIEPŁA
  {
    id: 'w1',
    symbol: '7012312',
    name: 'Wymiennik ciepła HE 75, 75kW',
    price: 858.00,
    currency: 'PLN',
    category: 'automatyka',
    subcategory: 'grzanie'
  },
];

export const getProductsByCategory = (category: ProductCategory): Product[] => {
  return products.filter(p => p.category === category);
};

export const getProductById = (id: string): Product | undefined => {
  return products.find(p => p.id === id);
};

// EUR to PLN conversion rate
export const EUR_TO_PLN = 4.35;

export const getPriceInPLN = (product: Product): number => {
  return product.currency === 'EUR' ? product.price * EUR_TO_PLN : product.price;
};
