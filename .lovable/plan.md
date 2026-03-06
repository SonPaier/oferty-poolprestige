

# Eksport wizualizacji 2D i 3D do PDF

## Podejście

Dodanie przycisku "Eksportuj do PDF" nad/pod wizualizacjami w DimensionsStep, który:

1. **2D (SVG)** — serializuje istniejący SVG (`svgRef`) do stringa, rysuje na `<canvas>` przez `Image` + data URI, potem `canvas.toDataURL('image/png')` → wstawia do jsPDF
2. **3D (Three.js Canvas)** — pobiera canvas z `<Canvas>` przez `gl.domElement.toDataURL('image/png')` → wstawia do jsPDF

Obie wizualizacje trafiają na jedną stronę PDF (2D u góry, 3D poniżej) z nagłówkiem zawierającym podstawowe parametry basenu.

## Zmiany w plikach

### 1. `src/components/Pool2DPreview.tsx`
- Wyeksponować `svgRef` na zewnątrz przez `forwardRef` lub dodać metodę `getSvgElement()` via `useImperativeHandle`
- Alternatywnie: dodać prop `svgRef` (ref forwarding) żeby DimensionsStep mógł uzyskać dostęp do SVG DOM

### 2. `src/components/Pool3DVisualization.tsx`
- Dodać `gl={{ preserveDrawingBuffer: true }}` do `<Canvas>` — wymagane aby `toDataURL()` działało na WebGL canvas
- Wyeksponować ref do canvasa analogicznie (forwardRef na div wrapper + querySelector('canvas'))

### 3. `src/components/steps/DimensionsStep.tsx`
- Dodać przycisk "Eksportuj PDF" w zakładce wizualizacji (obok kontrolki wymiarów)
- Zaimplementować funkcję `handleExportVisualizationPDF()`:
  1. Pobrać SVG element z Pool2DPreview ref → serializować → narysować na temp canvas → PNG data URL
  2. Pobrać canvas z Pool3DVisualization ref → `toDataURL('image/png')`
  3. Utworzyć jsPDF, dodać nagłówek z parametrami basenu (wymiary, głębokość, typ), wstawić oba obrazy, zapisać

### 4. Nowy helper: `src/lib/svgToImage.ts`
- Funkcja `svgToDataUrl(svgElement: SVGSVGElement, width: number, height: number): Promise<string>`
- Serializuje SVG → rysuje na canvas → zwraca PNG data URL

## Szczegóły techniczne

- SVG → PNG wymaga `XMLSerializer().serializeToString()` + `new Image()` + canvas
- Three.js canvas wymaga `preserveDrawingBuffer: true` (inaczej `toDataURL` zwraca pusty obraz)
- jsPDF `addImage()` przyjmuje base64 PNG
- PDF format: A4 landscape, 2D na górze (~40% strony), 3D na dole (~50%), nagłówek z parametrami

