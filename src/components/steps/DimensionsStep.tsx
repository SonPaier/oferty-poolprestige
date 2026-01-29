import { useEffect, useState } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Ruler, 
  Droplets, 
  ArrowLeft,
  Info,
  Waves,
  Pencil,
  Box,
  Calculator,
  Footprints,
  Baby,
  AlertTriangle
} from 'lucide-react';
import { Pool3DVisualization, DimensionDisplay } from '@/components/Pool3DVisualization';
import Pool2DPreview from '@/components/Pool2DPreview';
import { 
  PoolType, 
  PoolShape, 
  PoolOverflowType, 
  PoolLiningType,
  PoolLocation,
  poolTypeLabels, 
  poolShapeLabels, 
  overflowTypeLabels, 
  liningTypeLabels,
  poolLocationLabels,
  nominalLoadByType, 
  CustomPoolVertex,
  StairsConfig,
  WadingPoolConfig,
  PoolCorner,
  PoolWall,
  WallDirection,
  StairsPlacement,
  StairsShapeType,
  poolCornerLabels,
  poolWallLabels,
  wallDirectionLabels,
  stairsPlacementLabels,
  stairsShapeTypeLabels,
  getCornerLabel,
  mapCornerToIndex,
  mapIndexToCorner
} from '@/types/configurator';
import { calculatePoolMetrics, calculateFoilOptimization } from '@/lib/calculations';
import { CustomPoolDrawer } from '@/components/CustomPoolDrawer';
import { usePoolGeometryValidation } from '@/hooks/usePoolGeometryValidation';

interface DimensionsStepProps {
  onNext: () => void;
  onBack: () => void;
}

// SVG Pool Shape Icons
const PoolShapeIcon = ({ shape, isSelected }: { shape: PoolShape; isSelected: boolean }) => {
  const strokeColor = isSelected ? 'hsl(190 80% 42%)' : 'currentColor';
  const fillColor = isSelected ? 'hsl(190 80% 42% / 0.1)' : 'transparent';
  
  switch (shape) {
    case 'prostokatny':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <rect x="5" y="5" width="50" height="30" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
        </svg>
      );
    case 'owalny':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <ellipse cx="30" cy="20" rx="25" ry="15" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
        </svg>
      );
    case 'nieregularny':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <path d="M10 30 L15 10 L30 5 L45 10 L50 25 L40 35 L20 35 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
          <circle cx="15" cy="10" r="2" fill={strokeColor}/>
          <circle cx="30" cy="5" r="2" fill={strokeColor}/>
          <circle cx="45" cy="10" r="2" fill={strokeColor}/>
          <circle cx="50" cy="25" r="2" fill={strokeColor}/>
        </svg>
      );
    default:
      return null;
  }
};

// SVG Stairs Shape Icons for the 2 stair types
const StairsShapeIcon = ({ shapeType, isSelected }: { shapeType: StairsShapeType; isSelected: boolean }) => {
  const strokeColor = isSelected ? 'hsl(190 80% 42%)' : 'currentColor';
  const fillColor = isSelected ? 'hsl(190 80% 42% / 0.1)' : 'transparent';
  
  switch (shapeType) {
    case 'rectangular':
      return (
        <svg viewBox="0 0 40 24" className="w-10 h-6">
          <rect x="4" y="4" width="32" height="16" rx="1" fill={fillColor} stroke={strokeColor} strokeWidth="1.5"/>
          <line x1="12" y1="4" x2="12" y2="20" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 1"/>
          <line x1="20" y1="4" x2="20" y2="20" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 1"/>
          <line x1="28" y1="4" x2="28" y2="20" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 1"/>
        </svg>
      );
    case 'diagonal-45':
      return (
        <svg viewBox="0 0 40 24" className="w-10 h-6">
          <path d="M4 4 L36 4 L4 20 Z" fill={fillColor} stroke={strokeColor} strokeWidth="1.5"/>
          <line x1="12" y1="4" x2="4" y2="10" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 1"/>
          <line x1="20" y1="4" x2="4" y2="14" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 1"/>
          <line x1="28" y1="4" x2="4" y2="18" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 1"/>
        </svg>
      );
    default:
      return null;
  }
};

export function DimensionsStep({ onNext, onBack }: DimensionsStepProps) {
  const { state, dispatch } = useConfigurator();
  const { companySettings } = useSettings();
  const { dimensions, poolType, calculations } = state;
  const [showCustomDrawer, setShowCustomDrawer] = useState(false);
  const [dimensionDisplay, setDimensionDisplay] = useState<DimensionDisplay>('pool');
  
  // Geometry validation
  const geometryWarnings = usePoolGeometryValidation(dimensions);

  useEffect(() => {
    // Recalculate when dimensions or pool type change
    const calcs = calculatePoolMetrics(dimensions, poolType);
    dispatch({ type: 'SET_CALCULATIONS', payload: calcs });
    
    const foilCalc = calculateFoilOptimization(
      dimensions, 
      state.foilType,
      companySettings.irregularSurchargePercent
    );
    dispatch({ type: 'SET_FOIL_CALCULATION', payload: foilCalc });
  }, [dimensions, poolType, state.foilType, companySettings.irregularSurchargePercent]);

  const updateDimension = (field: keyof typeof dimensions, value: any) => {
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, [field]: value },
    });
  };

  // Calculate step height from step count and depth
  // Each step has equal height = poolDepth / stepCount
  // First step starts at -stepHeight (below pool edge)
  const calculateStepHeight = (poolDepth: number, stepCount: number) => {
    if (stepCount <= 0) return 0.20;
    // We intentionally divide by (stepCount + 1) so the last tread is NOT flush with the pool floor.
    // This also ensures the first tread is lower than the pool edge.
    return poolDepth / (stepCount + 1);
  };

  // Calculate total stairs depth (how far they extend into the pool)
  const calculateTotalStairsDepth = (stairsConfig: StairsConfig) => {
    if (!stairsConfig.enabled) return 0;
    const stepCount = stairsConfig.stepCount || 4;
    const stepDepth = stairsConfig.stepDepth || 0.30;
    return stepCount * stepDepth;
  };

  // Get base corner labels for rectangular pools (A, B, C, D)
  const getBaseCornerLabels = () => {
    if (dimensions.customVertices && dimensions.customVertices.length >= 3) {
      return dimensions.customVertices.map((_, index) => ({
        value: String.fromCharCode(65 + index),
        label: `Narożnik ${String.fromCharCode(65 + index)}`,
        index,
        isWadingIntersection: false,
        position: { x: 0, y: 0 } // Would need actual vertex positions for custom shapes
      }));
    }
    // For rectangular pools, default to A, B, C, D
    const halfL = dimensions.length / 2;
    const halfW = dimensions.width / 2;
    return [
      { value: 'A', label: 'Narożnik A (tylny lewy)', index: 0, isWadingIntersection: false, position: { x: -halfL, y: -halfW } },
      { value: 'B', label: 'Narożnik B (tylny prawy)', index: 1, isWadingIntersection: false, position: { x: halfL, y: -halfW } },
      { value: 'C', label: 'Narożnik C (przedni prawy)', index: 2, isWadingIntersection: false, position: { x: halfL, y: halfW } },
      { value: 'D', label: 'Narożnik D (przedni lewy)', index: 3, isWadingIntersection: false, position: { x: -halfL, y: halfW } }
    ];
  };

  // Calculate wading pool intersection points with pool walls
  // These become new corner options (E, F) for stair placement
  const getWadingPoolIntersections = () => {
    if (!dimensions.wadingPool?.enabled || dimensions.shape !== 'prostokatny') return [];
    
    const wadingCorner = dimensions.wadingPool.cornerIndex ?? 0;
    const wadingDir = dimensions.wadingPool.direction || 'along-width';
    const wadingWidth = dimensions.wadingPool.width || 2;
    const wadingLength = dimensions.wadingPool.length || 1.5;
    
    const halfL = dimensions.length / 2;
    const halfW = dimensions.width / 2;
    
    // Calculate intersection points based on wading pool corner and direction
    // These are points where the wading pool meets the pool walls (not the corner itself)
    const intersections: { value: string; label: string; index: number; isWadingIntersection: true; position: { x: number; y: number }; adjacentWall: WallDirection }[] = [];
    
    // Wading pool creates 2 intersection points (E and F) on the pool walls
    // E is along the "width" direction from the corner
    // F is along the "length" direction from the corner
    switch (wadingCorner) {
      case 0: // Corner A (back-left)
        if (wadingDir === 'along-length') {
          // Width along A-B (horizontal), length into pool (down)
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: -halfL + wadingWidth, y: -halfW }, // On back wall
            adjacentWall: 'along-length'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: -halfL, y: -halfW + wadingLength }, // On left wall
            adjacentWall: 'along-width'
          });
        } else {
          // Width along A-D (vertical), length into pool (right)
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: -halfL, y: -halfW + wadingWidth }, // On left wall
            adjacentWall: 'along-width'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: -halfL + wadingLength, y: -halfW }, // On back wall
            adjacentWall: 'along-length'
          });
        }
        break;
      case 1: // Corner B (back-right)
        if (wadingDir === 'along-length') {
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: halfL - wadingWidth, y: -halfW }, // On back wall
            adjacentWall: 'along-length'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: halfL, y: -halfW + wadingLength }, // On right wall
            adjacentWall: 'along-width'
          });
        } else {
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: halfL, y: -halfW + wadingWidth }, // On right wall
            adjacentWall: 'along-width'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: halfL - wadingLength, y: -halfW }, // On back wall
            adjacentWall: 'along-length'
          });
        }
        break;
      case 2: // Corner C (front-right)
        if (wadingDir === 'along-length') {
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: halfL - wadingWidth, y: halfW }, // On front wall
            adjacentWall: 'along-length'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: halfL, y: halfW - wadingLength }, // On right wall
            adjacentWall: 'along-width'
          });
        } else {
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: halfL, y: halfW - wadingWidth }, // On right wall
            adjacentWall: 'along-width'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: halfL - wadingLength, y: halfW }, // On front wall
            adjacentWall: 'along-length'
          });
        }
        break;
      case 3: // Corner D (front-left)
        if (wadingDir === 'along-length') {
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: -halfL + wadingWidth, y: halfW }, // On front wall
            adjacentWall: 'along-length'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: -halfL, y: halfW - wadingLength }, // On left wall
            adjacentWall: 'along-width'
          });
        } else {
          intersections.push({
            value: 'E', label: 'Punkt E (brodzik)', index: 4, isWadingIntersection: true,
            position: { x: -halfL, y: halfW - wadingWidth }, // On left wall
            adjacentWall: 'along-width'
          });
          intersections.push({
            value: 'F', label: 'Punkt F (brodzik)', index: 5, isWadingIntersection: true,
            position: { x: -halfL + wadingLength, y: halfW }, // On front wall
            adjacentWall: 'along-length'
          });
        }
        break;
    }
    
    return intersections;
  };

  // Get available corner labels for stairs (including wading pool intersections)
  const getCornerLabelsForStairs = () => {
    const baseCorners = getBaseCornerLabels();
    const wadingIntersections = getWadingPoolIntersections();
    
    // Combine base corners with wading pool intersection points
    return [...baseCorners, ...wadingIntersections];
  };

  // Get base corner labels only (for wading pool - no dynamic corners needed)
  const getCornerLabels = getBaseCornerLabels;

  // Get occupied corner indices
  const getOccupiedCorners = () => {
    const occupied: { index: number; by: 'stairs' | 'wadingPool' }[] = [];
    
    if (dimensions.stairs.enabled && dimensions.stairs.cornerIndex !== undefined) {
      occupied.push({ index: dimensions.stairs.cornerIndex, by: 'stairs' });
    }
    
    if (dimensions.wadingPool?.enabled && dimensions.wadingPool.cornerIndex !== undefined) {
      occupied.push({ index: dimensions.wadingPool.cornerIndex, by: 'wadingPool' });
    }
    
    return occupied;
  };

  // Check if a corner is occupied by another element (for stairs only)
  const isCornerOccupied = (cornerIndex: number, currentElement: 'stairs' | 'wadingPool') => {
    const occupied = getOccupiedCorners();
    // For stairs, also consider wading pool corner as occupied
    if (currentElement === 'stairs') {
      return occupied.some(o => o.index === cornerIndex && o.by === 'wadingPool');
    }
    // For wading pool, stairs corner is occupied
    return occupied.some(o => o.index === cornerIndex && o.by !== currentElement);
  };

  // Check if stairs from a corner would lead into the wading pool (not allowed)
  const wouldStairsLeadIntoWadingPool = (stairsCornerIndex: number, stairsDirection: WallDirection) => {
    if (!dimensions.wadingPool?.enabled) return false;
    
    const wadingCorner = dimensions.wadingPool.cornerIndex ?? 0;
    const wadingDir = dimensions.wadingPool.direction || 'along-width';
    
    // For wading pool intersection points (E, F), stairs always lead into pool (allowed)
    if (stairsCornerIndex >= 4) return false;
    
    // If stairs start from the same corner as wading pool, check direction
    if (stairsCornerIndex === wadingCorner) {
      // Both elements at same corner - stairs would lead into wading pool if same direction
      return stairsDirection === wadingDir;
    }
    
    return false;
  };

  // Get wall direction labels based on selected corner (for rectangular stairs)
  // Also filters out directions that would lead into the wading pool
  const getWallDirectionOptions = (cornerIndex: number, shapeType?: StairsShapeType) => {
    // For wading pool intersection points (E, F), special handling
    const wadingIntersections = getWadingPoolIntersections();
    const intersection = wadingIntersections.find(i => i.index === cornerIndex);
    
    if (intersection) {
      // For diagonal 45° stairs, only one direction (into the pool) - no choice needed
      // For rectangular stairs, user can choose: parallel to wading pool edge OR parallel to pool wall
      if (shapeType === 'diagonal-45') {
        // Diagonal 45° always faces pool interior - direction not relevant for rendering
        return [{
          value: intersection.adjacentWall,
          label: 'Do wnętrza basenu'
        }];
      }
      
      // For rectangular stairs from E/F, provide two options:
      // 1. Along the pool wall (where the intersection point is located)
      // 2. Into the main pool (perpendicular to the wall)
      const isOnHorizontalWall = intersection.adjacentWall === 'along-length';
      
      return [
        {
          value: 'along-length' as WallDirection,
          label: isOnHorizontalWall 
            ? `Równolegle do ściany basenu` 
            : `Prostopadle do brodzika (w głąb basenu)`
        },
        {
          value: 'along-width' as WallDirection,
          label: isOnHorizontalWall 
            ? `Prostopadle do brodzika (w głąb basenu)` 
            : `Równolegle do ściany basenu`
        }
      ];
    }
    
    // For each corner, we can place stairs along one of two adjacent walls
    // Corner A (0) = back-left: walls A-B (back) or A-D (left)
    // Corner B (1) = back-right: walls A-B (back) or B-C (right)
    // Corner C (2) = front-right: walls B-C (right) or C-D (front)
    // Corner D (3) = front-left: walls C-D (front) or A-D (left)
    const wallOptions: Record<number, { value: WallDirection; label: string }[]> = {
      0: [
        { value: 'along-length', label: 'Wzdłuż ściany A-B (tylna)' },
        { value: 'along-width', label: 'Wzdłuż ściany A-D (lewa)' }
      ],
      1: [
        { value: 'along-length', label: 'Wzdłuż ściany A-B (tylna)' },
        { value: 'along-width', label: 'Wzdłuż ściany B-C (prawa)' }
      ],
      2: [
        { value: 'along-width', label: 'Wzdłuż ściany B-C (prawa)' },
        { value: 'along-length', label: 'Wzdłuż ściany C-D (przednia)' }
      ],
      3: [
        { value: 'along-length', label: 'Wzdłuż ściany C-D (przednia)' },
        { value: 'along-width', label: 'Wzdłuż ściany A-D (lewa)' }
      ]
    };
    
    const options = wallOptions[cornerIndex % 4] || wallOptions[0];
    
    // Filter out directions that would lead stairs into the wading pool
    return options.filter(opt => !wouldStairsLeadIntoWadingPool(cornerIndex, opt.value));
  };

  // Calculate maximum available width for stairs/wading pool based on shared wall
  // When both elements share a wall, their combined widths cannot exceed the wall length
  const getMaxAvailableWidth = (
    elementType: 'stairs' | 'wadingPool',
    cornerIndex: number,
    direction: WallDirection
  ): number => {
    const stairsEnabled = dimensions.stairs.enabled;
    const wadingEnabled = dimensions.wadingPool?.enabled;
    
    // Get wall length based on direction
    const wallLength = direction === 'along-length' ? dimensions.length : dimensions.width;
    
    // If only one element is enabled, full wall is available
    if (!stairsEnabled || !wadingEnabled) {
      return wallLength;
    }
    
    // Check if both elements share the same wall
    const stairsCorner = dimensions.stairs.cornerIndex ?? 0;
    const wadingCorner = dimensions.wadingPool.cornerIndex ?? 0;
    const stairsDir = dimensions.stairs.direction || 'along-width';
    const wadingDir = dimensions.wadingPool.direction || 'along-width';
    
    // Two elements share a wall if:
    // 1. They are on adjacent corners (differ by 1 or 3 modulo 4)
    // 2. The element on the earlier corner extends along the shared wall direction
    const cornerDiff = Math.abs(stairsCorner - wadingCorner);
    const areAdjacent = cornerDiff === 1 || cornerDiff === 3;
    
    if (!areAdjacent) {
      return wallLength; // Not adjacent, full wall available
    }
    
    // Check if they share the same wall (same direction extending from adjacent corners)
    // For corners A(0)-B(1): shared wall is A-B (along-length)
    // For corners B(1)-C(2): shared wall is B-C (along-width)
    // For corners C(2)-D(3): shared wall is C-D (along-length)
    // For corners D(3)-A(0): shared wall is A-D (along-width)
    
    const smallerCorner = Math.min(stairsCorner, wadingCorner);
    const largerCorner = Math.max(stairsCorner, wadingCorner);
    
    let sharedWallDirection: WallDirection;
    if ((smallerCorner === 0 && largerCorner === 1) || (smallerCorner === 2 && largerCorner === 3)) {
      sharedWallDirection = 'along-length';
    } else if ((smallerCorner === 1 && largerCorner === 2) || (smallerCorner === 0 && largerCorner === 3)) {
      sharedWallDirection = 'along-width';
    } else {
      return wallLength;
    }
    
    // Check if both elements are oriented along the shared wall
    const stairsOnSharedWall = stairsDir === sharedWallDirection;
    const wadingOnSharedWall = wadingDir === sharedWallDirection;
    
    if (!stairsOnSharedWall || !wadingOnSharedWall) {
      return wallLength; // Not both on shared wall
    }
    
    // They share the wall - calculate remaining space
    const otherElementWidth = elementType === 'stairs'
      ? (dimensions.wadingPool.width || 2)
      : (typeof dimensions.stairs.width === 'number' ? dimensions.stairs.width : 1.5);
    
    const maxAvailable = wallLength - otherElementWidth;
    return Math.max(0.5, maxAvailable); // Minimum 0.5m
  };

  // Update stairs config
  const updateStairs = (updates: Partial<StairsConfig>) => {
    const newStairs = { ...dimensions.stairs, ...updates };

    // Outside stairs are no longer supported
    newStairs.position = 'inside';

    // Auto-calculate stepHeight when stepCount changes
    if (updates.stepCount !== undefined) {
      newStairs.stepHeight = calculateStepHeight(dimensions.depth, updates.stepCount);
    }
    // Set default stepCount when enabling if not set
    if (updates.enabled && !newStairs.stepCount) {
      newStairs.stepCount = 4; // Default to 4 steps
      newStairs.stepHeight = calculateStepHeight(dimensions.depth, 4);
    }
    // Set default shapeType when enabling if not set
    if (updates.enabled && !newStairs.shapeType) {
      newStairs.shapeType = 'rectangular';
      newStairs.cornerIndex = 0;
    }
    // Sync cornerIndex with legacy corner field for backward compatibility
    if (updates.cornerIndex !== undefined) {
      newStairs.corner = mapIndexToCorner(updates.cornerIndex);
      newStairs.cornerLabel = getCornerLabel(updates.cornerIndex);
    }
    // Sync shapeType with legacy placement field for backward compatibility
    if (updates.shapeType !== undefined) {
      if (updates.shapeType === 'diagonal-45') {
        newStairs.placement = 'diagonal';
      } else {
        newStairs.placement = 'corner';
      }
    }
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, stairs: newStairs },
    });
  };

  // Update wading pool config
  const updateWadingPool = (updates: Partial<WadingPoolConfig>) => {
    const newWadingPool = { ...dimensions.wadingPool, ...updates };
    
    // Sync cornerIndex with legacy corner field for backward compatibility
    if (updates.cornerIndex !== undefined) {
      newWadingPool.corner = mapIndexToCorner(updates.cornerIndex);
      newWadingPool.cornerLabel = getCornerLabel(updates.cornerIndex);
    }
    // Set defaults when enabling
    if (updates.enabled && newWadingPool.cornerIndex === undefined) {
      // Find first available corner
      const stairsCorner = dimensions.stairs.enabled ? (dimensions.stairs.cornerIndex ?? 0) : -1;
      newWadingPool.cornerIndex = stairsCorner === 0 ? 1 : 0;
      newWadingPool.corner = mapIndexToCorner(newWadingPool.cornerIndex);
      newWadingPool.cornerLabel = getCornerLabel(newWadingPool.cornerIndex);
    }
    
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, wadingPool: newWadingPool },
    });
  };

  // Recalculate step height when depth changes (keeping step count)
  useEffect(() => {
    if (dimensions.stairs?.enabled && dimensions.stairs.stepCount) {
      const newStepHeight = calculateStepHeight(dimensions.depth, dimensions.stairs.stepCount);
      if (Math.abs(newStepHeight - (dimensions.stairs.stepHeight || 0)) > 0.001) {
        updateStairs({ stepHeight: newStepHeight });
      }
    }
  }, [dimensions.depth]);

  const isCustomShape = dimensions.shape === 'nieregularny';

  const handleShapeSelect = (shape: PoolShape) => {
    if (shape === 'nieregularny') {
      // When switching to irregular shape, open drawer immediately
      // and clear rectangle dimensions so they don't show in visualization
      setShowCustomDrawer(true);
    } else if (shape === 'prostokatny' && dimensions.shape !== 'prostokatny') {
      // When switching to rectangular, generate vertices from length/width
      generateRectangularVertices();
    }
    updateDimension('shape', shape);
  };

  // Generate rectangular vertices from current length/width
  const generateRectangularVertices = () => {
    const { length, width } = dimensions;
    const vertices = [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width }
    ];
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: {
        ...dimensions,
        customVertices: vertices,
        customArea: length * width,
        customPerimeter: 2 * (length + width)
      }
    });
  };

  const handleCustomShapeComplete = (
    poolVertices: CustomPoolVertex[], 
    area: number, 
    perimeter: number,
    stairsVertices?: CustomPoolVertex[],
    wadingPoolVertices?: CustomPoolVertex[],
    stairsRotation?: number,
    stairsConfig?: Partial<StairsConfig>,
    wadingPoolConfig?: Partial<WadingPoolConfig>
  ) => {
    // IMPORTANT: Only include stairs/wading arrays if they were actually drawn
    // If undefined was passed, it means the element was NOT drawn - use empty array
    const stairsArray = stairsVertices && stairsVertices.length >= 3 ? [stairsVertices] : [];
    const rotationsArray = stairsVertices && stairsVertices.length >= 3 && stairsRotation !== undefined ? [stairsRotation] : [];
    const wadingArray = wadingPoolVertices && wadingPoolVertices.length >= 3 ? [wadingPoolVertices] : [];
    const isIrregular = dimensions.shape === 'nieregularny';

    // Merge stairs config from drawer with existing config
    const updatedStairsConfig: StairsConfig = {
      ...dimensions.stairs,
      // For irregular shapes: if there are no drawn stairs vertices, treat stairs as disabled
      enabled: stairsArray.length > 0 ? true : (isIrregular ? false : (dimensions.stairs?.enabled || false)),
      ...(stairsConfig || {}),
    };
    
    // Merge wading pool config from drawer with existing config
    const updatedWadingPoolConfig: WadingPoolConfig = {
      ...dimensions.wadingPool,
      // For irregular shapes: if there are no drawn wading vertices, treat wading pool as disabled
      enabled: wadingArray.length > 0 ? true : (isIrregular ? false : (dimensions.wadingPool?.enabled || false)),
      ...(wadingPoolConfig || {}),
    };

    dispatch({
      type: 'SET_DIMENSIONS',
      payload: {
        ...dimensions,
        shape: dimensions.shape, // Keep current shape (could be prostokatny or nieregularny)
        customVertices: poolVertices,
        customArea: area,
        customPerimeter: perimeter,
        customStairsVertices: stairsArray,
        customStairsRotations: rotationsArray,
        customWadingPoolVertices: wadingArray,
        // Update stairs config with parameters from drawer
        stairs: updatedStairsConfig,
        wadingPool: updatedWadingPoolConfig,
      },
    });
    setShowCustomDrawer(false);
  };

  return (
    <div className="animate-slide-up">
      {/* Custom Pool Drawer Dialog */}
      <Dialog open={showCustomDrawer} onOpenChange={setShowCustomDrawer}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              {dimensions.shape === 'nieregularny' ? 'Edytuj kształt nieregularny' : 'Edytuj kształt basenu'}
            </DialogTitle>
          </DialogHeader>
          <CustomPoolDrawer
            onComplete={handleCustomShapeComplete}
            onCancel={() => setShowCustomDrawer(false)}
            initialPoolVertices={dimensions.customVertices}
            initialStairsVertices={dimensions.customStairsVertices?.[0]}
            initialWadingPoolVertices={dimensions.customWadingPoolVertices?.[0]}
            initialStairsRotation={dimensions.customStairsRotations?.[0]}
            initialLength={dimensions.length}
            initialWidth={dimensions.width}
            shape={dimensions.shape === 'nieregularny' ? 'nieregularny' : 'prostokatny'}
            initialStairsConfig={dimensions.stairs}
            initialWadingPoolConfig={dimensions.wadingPool}
          />
        </DialogContent>
      </Dialog>

      <div className="section-header">
        <Ruler className="w-5 h-5 text-primary" />
        Wymiary i kształt basenu
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Input form */}
        <div className="glass-card p-6 space-y-6">
          {/* Pool Shape Selection */}
          <div>
            <Label className="text-base font-medium mb-4 block">Kształt basenu</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(poolShapeLabels) as PoolShape[]).map((shape) => (
                <button
                  key={shape}
                  onClick={() => handleShapeSelect(shape)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                    dimensions.shape === shape
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30'
                  }`}
                >
                  <PoolShapeIcon shape={shape} isSelected={dimensions.shape === shape} />
                  <span className={`text-xs mt-2 text-center leading-tight ${
                    dimensions.shape === shape ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>
                    {poolShapeLabels[shape]}
                  </span>
                </button>
              ))}
            </div>
            {isCustomShape && dimensions.customArea && (
              <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Nieregularny kształt: {dimensions.customArea.toFixed(1)} m², obwód: {dimensions.customPerimeter?.toFixed(1)} m</span>
                  <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                    <Pencil className="w-3 h-3 mr-1" />
                    Edytuj
                  </Button>
                </div>
              </div>
            )}
            {/* Edit shape button for rectangular pools */}
            {dimensions.shape === 'prostokatny' && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Edytuj w edytorze kształtu
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Otwórz graficzny edytor z oznaczeniem narożników (A, B, C, D)
                </p>
              </div>
            )}
          </div>

          {/* Info and edit button for custom shapes */}
          {isCustomShape && (
            <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4 text-primary" />
                  <span>Kształt nieregularny - edytuj w graficznym edytorze.</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Edytuj kształt
                </Button>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                {dimensions.customStairsVertices && dimensions.customStairsVertices.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3 h-3" />
                    Schody: ✓
                  </span>
                )}
                {dimensions.customWadingPoolVertices && dimensions.customWadingPoolVertices.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Baby className="w-3 h-3" />
                    Brodzik: ✓
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Pool Lining Type (Ceramic/Foil) */}
          <div>
            <Label className="text-base font-medium mb-4 block">Typ wykończenia</Label>
            <RadioGroup
              value={dimensions.liningType}
              onValueChange={(value) => updateDimension('liningType', value as PoolLiningType)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(liningTypeLabels) as PoolLiningType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={`lining-${type}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`lining-${type}`}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{liningTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {type === 'foliowany' ? 'Wykończenie folią PVC' : 'Płytki ceramiczne'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Pool Type */}
          <div>
            <Label className="text-base font-medium mb-4 block">Typ basenu</Label>
            <RadioGroup
              value={poolType}
              onValueChange={(value) => dispatch({ type: 'SET_POOL_TYPE', payload: value as PoolType })}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {(Object.keys(poolTypeLabels) as PoolType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={type}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={type}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{poolTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Obciążenie: {nominalLoadByType[type]}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Pool Location (Indoor/Outdoor) */}
          <div>
            <Label className="text-base font-medium mb-4 block">Lokalizacja basenu</Label>
            <RadioGroup
              value={dimensions.location || 'zewnetrzny'}
              onValueChange={(value) => updateDimension('location', value as PoolLocation)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(poolLocationLabels) as PoolLocation[]).map((loc) => (
                <div key={loc} className="relative">
                  <RadioGroupItem
                    value={loc}
                    id={`location-${loc}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`location-${loc}`}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{poolLocationLabels[loc]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {loc === 'wewnetrzny' ? 'W budynku / hala' : 'Na zewnątrz / ogród'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium mb-4 block">Typ przelewu</Label>
            <RadioGroup
              value={dimensions.overflowType}
              onValueChange={(value) => updateDimension('overflowType', value as PoolOverflowType)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(overflowTypeLabels) as PoolOverflowType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={`overflow-${type}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`overflow-${type}`}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{overflowTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {type === 'skimmerowy' ? 'Woda -10cm od krawędzi' : 'Woda = głębokość niecki'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Main Dimensions - hidden for custom shape */}
          {!isCustomShape && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">Długość (m)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="2"
                  max="50"
                  value={dimensions.length}
                  onChange={(e) => updateDimension('length', parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="width">Szerokość (m)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="2"
                  max="25"
                  value={dimensions.width}
                  onChange={(e) => updateDimension('width', parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="depth">Głębokość (m)</Label>
                <Input
                  id="depth"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="5"
                  value={dimensions.depth}
                  onChange={(e) => updateDimension('depth', parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
                <p className="text-xs text-muted-foreground">
                  Woda: {calculations?.waterDepth?.toFixed(2) || (dimensions.depth - (dimensions.overflowType === 'skimmerowy' ? 0.1 : 0)).toFixed(2)} m
                </p>
              </div>
            </div>
          )}

          {/* Slope, Deep Depth and Attractions section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-3">
                <Ruler className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="hasSlope" className="font-medium">Spadek dna</Label>
                  <p className="text-xs text-muted-foreground">
                    Różne głębokości (płytko → głęboko)
                  </p>
                </div>
              </div>
              <Switch
                id="hasSlope"
                checked={dimensions.hasSlope}
                onCheckedChange={(checked) => {
                  updateDimension('hasSlope', checked);
                  if (checked && !dimensions.depthDeep) {
                    updateDimension('depthDeep', dimensions.depth + 0.5);
                  }
                }}
              />
            </div>

            <div className={`grid gap-4 ${dimensions.hasSlope ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {dimensions.hasSlope && (
                <div className="space-y-2">
                  <Label htmlFor="depthDeep">Głębokość głęboka (m)</Label>
                  <Input
                    id="depthDeep"
                    type="number"
                    step="0.1"
                    min={dimensions.depth}
                    max="5"
                    value={dimensions.depthDeep || dimensions.depth + 0.5}
                    onChange={(e) => updateDimension('depthDeep', parseFloat(e.target.value) || 0)}
                    className="input-field"
                  />
                  <p className="text-xs text-muted-foreground">
                    Spadek: {((dimensions.depthDeep || dimensions.depth) - dimensions.depth).toFixed(2)} m
                  </p>
                </div>
              )}

              {/* Attractions - now available for ALL pool types */}
              <div className="space-y-2">
                <Label htmlFor="attractions">Ilość atrakcji</Label>
                <Input
                  id="attractions"
                  type="number"
                  step="1"
                  min="0"
                  max="20"
                  value={dimensions.attractions}
                  onChange={(e) => updateDimension('attractions', parseInt(e.target.value) || 0)}
                  className="input-field"
                />
                <p className="text-xs text-muted-foreground">
                  +{6 * dimensions.attractions} m³/h do filtracji
                </p>
              </div>
            </div>
          </div>

          {/* Stairs configuration - available for rectangular and irregular shapes (NOT oval) */}
          {/* For irregular shapes: only show if stairs were drawn in editor (no toggle) */}
          {dimensions.shape !== 'owalny' && (
            // For rectangular pools: show toggle
            // For irregular pools: only show if customStairsVertices exist (drawn in editor)
            (dimensions.shape !== 'nieregularny' || (dimensions.customStairsVertices && dimensions.customStairsVertices.some(arr => arr.length >= 3))) && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Footprints className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="stairsEnabled" className="font-medium">Schody</Label>
                    <p className="text-xs text-muted-foreground">
                      {isCustomShape ? 'Schody narysowane w edytorze' : 'Dodaj schody do basenu'}
                    </p>
                  </div>
                </div>
                {/* Hide toggle for irregular pools - stairs are drawn in editor */}
                {!isCustomShape && (
                  <Switch
                    id="stairsEnabled"
                    checked={dimensions.stairs?.enabled || false}
                    onCheckedChange={(checked) => updateStairs({ enabled: checked })}
                  />
                )}
              </div>
              
              {(isCustomShape || dimensions.stairs?.enabled) && (
                <div className="space-y-4 pt-3 border-t border-border">
                  {/* For irregular shapes - show simplified read-only controls */}
                  {isCustomShape ? (
                    <>
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                        <p className="font-medium mb-1">Schody rysowane w edytorze kształtu</p>
                        <p className="text-muted-foreground text-xs">
                          Pozycja i kształt schodów definiowane są graficznie. Poniżej możesz zmienić liczbę stopni.
                        </p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowCustomDrawer(true)}>
                          <Pencil className="w-3 h-3 mr-1" />
                          Edytuj pozycję schodów
                        </Button>
                      </div>
                      
                      {/* Show calculated dimensions from customStairsVertices (read-only) */}
                      {dimensions.customStairsVertices?.[0] && (() => {
                        const stairsVerts = dimensions.customStairsVertices[0];
                        // Calculate dimensions from vertices
                        let stairsLength = 0;
                        let stairsWidth = 0;
                        
                        if (stairsVerts.length === 3) {
                          // Triangle: find the two legs from corner vertex (v0)
                          const v0 = stairsVerts[0], v1 = stairsVerts[1], v2 = stairsVerts[2];
                          const leg1 = Math.hypot(v1.x - v0.x, v1.y - v0.y);
                          const leg2 = Math.hypot(v2.x - v0.x, v2.y - v0.y);
                          stairsLength = Math.max(leg1, leg2);
                          stairsWidth = Math.min(leg1, leg2);
                        } else if (stairsVerts.length === 4) {
                          // Rectangle: calculate edge lengths
                          const edges = [0, 1, 2, 3].map(i => {
                            const next = (i + 1) % 4;
                            return Math.hypot(stairsVerts[next].x - stairsVerts[i].x, stairsVerts[next].y - stairsVerts[i].y);
                          });
                          const pair1 = (edges[0] + edges[2]) / 2;
                          const pair2 = (edges[1] + edges[3]) / 2;
                          stairsLength = Math.max(pair1, pair2);
                          stairsWidth = Math.min(pair1, pair2);
                        }
                        
                        const stepCount = dimensions.stairs.stepCount || 4;
                        const calculatedStepDepth = stairsLength / stepCount;
                        
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            {/* Read-only width display */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block text-muted-foreground">
                                Szerokość (z rysunku)
                              </Label>
                              <div className="input-field bg-muted/50 text-muted-foreground">
                                {(stairsWidth * 100).toFixed(0)} cm
                              </div>
                            </div>
                            
                            {/* Read-only length display */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block text-muted-foreground">
                                Długość (z rysunku)
                              </Label>
                              <div className="input-field bg-muted/50 text-muted-foreground">
                                {(stairsLength * 100).toFixed(0)} cm
                              </div>
                            </div>
                            
                            {/* Editable step count */}
                            <div>
                              <Label htmlFor="stepCountIrregular" className="text-sm font-medium mb-2 block">
                                Liczba stopni
                              </Label>
                              <Input
                                id="stepCountIrregular"
                                type="number"
                                step="1"
                                min="2"
                                max="15"
                                value={stepCount}
                                onChange={(e) => {
                                  const count = Math.max(2, Math.min(15, parseInt(e.target.value) || 4));
                                  // Recalculate stepDepth based on stairs length
                                  const newStepDepth = stairsLength / count;
                                  updateStairs({ stepCount: count, stepDepth: newStepDepth });
                                }}
                                className="input-field"
                              />
                              <p className="text-xs text-muted-foreground mt-1">2-15 stopni</p>
                            </div>
                            
                            {/* Read-only calculated step depth */}
                            <div>
                              <Label className="text-sm font-medium mb-2 block text-muted-foreground">
                                Głęb. stopnia (wyliczona)
                              </Label>
                              <div className="input-field bg-muted/50 text-muted-foreground">
                                {(calculatedStepDepth * 100).toFixed(0)} cm
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Calculated step info */}
                      <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-3 h-3" />
                          <span>
                            Wysokość podstopnia: {Math.round((dimensions.depth / ((dimensions.stairs.stepCount || 4) + 1)) * 100)} cm
                          </span>
                        </div>
                        <div className="text-muted-foreground/70">
                          Pierwszy stopień zaczyna się {Math.round((dimensions.depth / ((dimensions.stairs.stepCount || 4) + 1)) * 100)} cm poniżej krawędzi basenu
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Shape type selection - 2 buttons */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Typ schodów</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['rectangular', 'diagonal-45'] as StairsShapeType[]).map((type) => (
                            <button
                              key={type}
                              onClick={() => updateStairs({ shapeType: type })}
                              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                                (dimensions.stairs.shapeType || 'rectangular') === type
                                  ? 'border-primary bg-primary/10 shadow-md'
                                  : 'border-border bg-background hover:bg-muted/50 hover:border-primary/30'
                              }`}
                            >
                              <StairsShapeIcon shapeType={type} isSelected={(dimensions.stairs.shapeType || 'rectangular') === type} />
                              <span className={`text-xs mt-1 text-center ${
                                (dimensions.stairs.shapeType || 'rectangular') === type ? 'text-primary font-medium' : 'text-muted-foreground'
                              }`}>
                                {stairsShapeTypeLabels[type]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Corner selection (A, B, C, D + E, F from wading pool) */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          Narożnik startowy
                          {dimensions.wadingPool?.enabled && (
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              (E, F - punkty przy brodziku)
                            </span>
                          )}
                        </Label>
                        <div className={`grid gap-2 ${
                          dimensions.wadingPool?.enabled ? 'grid-cols-3' : 'grid-cols-4'
                        }`}>
                          {getCornerLabelsForStairs().map((corner) => {
                            const isOccupied = isCornerOccupied(corner.index, 'stairs');
                            const isWadingPoint = corner.isWadingIntersection;
                            const isSelected = (dimensions.stairs.cornerIndex ?? 0) === corner.index;
                            
                            // Get description for base corners
                            const getCornerDescription = (idx: number, isWading: boolean) => {
                              if (isWading) return 'przy brodziku';
                              if (isOccupied) return 'brodzik';
                              switch (idx) {
                                case 0: return 'tylny L';
                                case 1: return 'tylny P';
                                case 2: return 'przedni P';
                                case 3: return 'przedni L';
                                default: return '';
                              }
                            };
                            
                            return (
                              <button
                                key={corner.value}
                                onClick={() => {
                                  if (!isOccupied) {
                                    // When selecting a wading pool intersection point, set the correct direction
                                    if (isWadingPoint && 'adjacentWall' in corner) {
                                      updateStairs({ 
                                        cornerIndex: corner.index,
                                        direction: corner.adjacentWall as WallDirection
                                      });
                                    } else {
                                      updateStairs({ cornerIndex: corner.index });
                                    }
                                  }
                                }}
                                disabled={isOccupied}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 shadow-md'
                                    : isOccupied
                                      ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                                      : isWadingPoint
                                        ? 'border-accent bg-accent/10 hover:bg-accent/20 hover:border-accent'
                                        : 'border-border bg-background hover:bg-muted/50 hover:border-primary/30'
                                }`}
                              >
                                <span className={`text-lg font-bold ${
                                  isSelected 
                                    ? 'text-primary' 
                                    : isOccupied 
                                      ? 'text-muted-foreground/50' 
                                      : isWadingPoint
                                        ? 'text-accent-foreground'
                                        : 'text-muted-foreground'
                                }`}>
                                  {corner.value}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {getCornerDescription(corner.index, isWadingPoint)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Wall direction selection - only for rectangular stairs */}
                      {(dimensions.stairs.shapeType || 'rectangular') === 'rectangular' && (
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Równolegle do ściany</Label>
                          <div className="grid grid-cols-1 gap-2">
                            {getWallDirectionOptions(dimensions.stairs.cornerIndex ?? 0, dimensions.stairs.shapeType).map((option) => (
                              <button
                                key={option.value}
                                onClick={() => updateStairs({ direction: option.value })}
                                className={`flex items-center justify-start p-3 rounded-lg border transition-all ${
                                  dimensions.stairs.direction === option.value
                                    ? 'border-primary bg-primary/10 shadow-md'
                                    : 'border-border bg-background hover:bg-muted/50 hover:border-primary/30'
                                }`}
                              >
                                <span className={`text-sm ${
                                  dimensions.stairs.direction === option.value ? 'text-primary font-medium' : 'text-muted-foreground'
                                }`}>
                                  {option.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stairs width - only for rectangular shape */}
                      {(dimensions.stairs.shapeType || 'rectangular') === 'rectangular' && (() => {
                        const maxWidth = getMaxAvailableWidth(
                          'stairs',
                          dimensions.stairs.cornerIndex ?? 0,
                          dimensions.stairs.direction || 'along-width'
                        );
                        const currentWidth = typeof dimensions.stairs.width === 'number' ? dimensions.stairs.width : 1.5;
                        const isOverLimit = currentWidth > maxWidth;
                        
                        return (
                          <div>
                            <Label htmlFor="stairsWidth" className="text-sm font-medium mb-2 block">
                              Szerokość schodów (m)
                            </Label>
                            <Input
                              id="stairsWidth"
                              type="number"
                              step="0.1"
                              min="0.5"
                              max={maxWidth}
                              value={currentWidth}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 1.5;
                                updateStairs({ width: Math.min(value, maxWidth) });
                              }}
                              className={`input-field ${isOverLimit ? 'border-destructive' : ''}`}
                            />
                            {dimensions.wadingPool?.enabled && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Maks. {maxWidth.toFixed(1)}m (brodzik zajmuje {(dimensions.wadingPool.width || 2).toFixed(1)}m)
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      
                      {/* Step count and depth */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="stepCount" className="text-sm font-medium mb-2 block">
                            Liczba stopni
                          </Label>
                          <Input
                            id="stepCount"
                            type="number"
                            step="1"
                            min="2"
                            max="15"
                            value={dimensions.stairs.stepCount || 4}
                            onChange={(e) => {
                              const count = parseInt(e.target.value) || 4;
                              updateStairs({ stepCount: Math.max(2, Math.min(15, count)) });
                            }}
                            className="input-field"
                          />
                          <p className="text-xs text-muted-foreground mt-1">2-15 stopni</p>
                        </div>
                        <div>
                          <Label htmlFor="stepDepth" className="text-sm font-medium mb-2 block">
                            Głęb. stopnia (cm)
                          </Label>
                          <Input
                            id="stepDepth"
                            type="number"
                            step="1"
                            min="20"
                            max="60"
                            value={Math.round((dimensions.stairs.stepDepth || 0.30) * 100)}
                            onChange={(e) => {
                              const cm = parseFloat(e.target.value) || 30;
                              updateStairs({ stepDepth: cm / 100 });
                            }}
                            className="input-field"
                          />
                          <p className="text-xs text-muted-foreground mt-1">część pozioma stopnia (30-50 cm)</p>
                        </div>
                      </div>
                      
                      {/* Calculated step info */}
                      <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-3 h-3" />
                          <span>
                            Wysokość podstopnia: {Math.round((dimensions.depth / ((dimensions.stairs.stepCount || 4) + 1)) * 100)} cm
                          </span>
                        </div>
                        <div className="text-muted-foreground/70">
                          Pierwszy stopień zaczyna się {Math.round((dimensions.depth / ((dimensions.stairs.stepCount || 4) + 1)) * 100)} cm poniżej krawędzi basenu
                        </div>
                        <div className="text-muted-foreground/70">
                          Głębokość stopnia: {Math.round((dimensions.stairs.stepDepth || 0.30) * 100)} cm
                          {' '}•{' '}
                          Całkowita długość schodów: {Math.round(calculateTotalStairsDepth(dimensions.stairs) * 100)} cm
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Pozycja: wewnątrz basenu (schody na zewnątrz wyłączone)
                  </div>
                </div>
              )}
            </div>
            )
          )}

          {/* Wading pool configuration for rectangular and irregular shapes (NOT oval) */}
          {/* For irregular shapes: only show if wading pool was drawn in editor (no toggle) */}
          {dimensions.shape !== 'owalny' && (
            // For rectangular pools: show toggle
            // For irregular pools: only show if customWadingPoolVertices exist (drawn in editor)
            (dimensions.shape !== 'nieregularny' || (dimensions.customWadingPoolVertices && dimensions.customWadingPoolVertices.some(arr => arr.length >= 3))) && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Baby className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="wadingPoolEnabled" className="font-medium">Brodzik</Label>
                    <p className="text-xs text-muted-foreground">
                      {isCustomShape ? 'Brodzik narysowany w edytorze' : 'Dodaj brodzik dla dzieci'}
                    </p>
                  </div>
                </div>
                {/* Hide toggle for irregular pools - wading pool is drawn in editor */}
                {!isCustomShape && (
                  <Switch
                    id="wadingPoolEnabled"
                    checked={dimensions.wadingPool?.enabled || false}
                    onCheckedChange={(checked) => updateWadingPool({ enabled: checked })}
                  />
                )}
              </div>
              
              {(isCustomShape || dimensions.wadingPool?.enabled) && (
                <div className="space-y-4 pt-3 border-t border-border">
                  {/* For irregular shapes - show simplified controls with edit button */}
                  {isCustomShape && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                      <p className="font-medium mb-1">Brodzik rysowany w edytorze kształtu</p>
                      <p className="text-muted-foreground text-xs">
                        Pozycja i kształt brodzika definiowane są graficznie. Poniżej możesz zmienić parametry murka.
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowCustomDrawer(true)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edytuj pozycję brodzika
                      </Button>
                    </div>
                  )}
                  
                  {/* For rectangular pools - show full positioning controls */}
                  {!isCustomShape && (
                    <>
                      {/* Corner selection (A, B, C, D) - same style as stairs */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Narożnik startowy</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {getCornerLabels().map((corner, index) => {
                            const isOccupied = isCornerOccupied(index, 'wadingPool');
                            return (
                              <button
                                key={corner.value}
                                onClick={() => !isOccupied && updateWadingPool({ cornerIndex: index })}
                                disabled={isOccupied}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                  (dimensions.wadingPool.cornerIndex ?? 0) === index
                                    ? 'border-primary bg-primary/10 shadow-md'
                                    : isOccupied
                                      ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                                      : 'border-border bg-background hover:bg-muted/50 hover:border-primary/30'
                                }`}
                              >
                                <span className={`text-lg font-bold ${
                                  (dimensions.wadingPool.cornerIndex ?? 0) === index 
                                    ? 'text-primary' 
                                    : isOccupied 
                                      ? 'text-muted-foreground/50' 
                                      : 'text-muted-foreground'
                                }`}>
                                  {corner.value}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {isOccupied ? 'schody' : index === 0 ? 'tylny L' : index === 1 ? 'tylny P' : index === 2 ? 'przedni P' : 'przedni L'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Direction selection - buttons instead of dropdown */}
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Równolegle do ściany</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {getWallDirectionOptions(dimensions.wadingPool.cornerIndex ?? 0).map((option) => (
                            <button
                              key={option.value}
                              onClick={() => updateWadingPool({ direction: option.value })}
                              className={`flex items-center justify-start p-3 rounded-lg border transition-all ${
                                dimensions.wadingPool.direction === option.value
                                  ? 'border-primary bg-primary/10 shadow-md'
                                  : 'border-border bg-background hover:bg-muted/50 hover:border-primary/30'
                              }`}
                            >
                              <span className={`text-sm ${
                                dimensions.wadingPool.direction === option.value ? 'text-primary font-medium' : 'text-muted-foreground'
                              }`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Size inputs */}
                      {(() => {
                        const maxWidth = getMaxAvailableWidth(
                          'wadingPool',
                          dimensions.wadingPool.cornerIndex ?? 0,
                          dimensions.wadingPool.direction || 'along-width'
                        );
                        const currentWidth = dimensions.wadingPool.width || 2;
                        const isOverLimit = currentWidth > maxWidth;
                        
                        return (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor="wadingWidth" className="text-xs">Szerokość (m)</Label>
                              <Input
                                id="wadingWidth"
                                type="number"
                                step="0.1"
                                min="0.5"
                                max={maxWidth}
                                value={currentWidth}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 2;
                                  updateWadingPool({ width: Math.min(value, maxWidth) });
                                }}
                                className={`input-field ${isOverLimit ? 'border-destructive' : ''}`}
                              />
                              {dimensions.stairs.enabled && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Maks. {maxWidth.toFixed(1)}m
                                </p>
                              )}
                            </div>
                            <div>
                              <Label htmlFor="wadingLength" className="text-xs">Długość (m)</Label>
                              <Input
                                id="wadingLength"
                                type="number"
                                step="0.1"
                                min="0.5"
                                max="10"
                                value={dimensions.wadingPool.length || 1.5}
                                onChange={(e) => updateWadingPool({ length: parseFloat(e.target.value) || 1.5 })}
                                className="input-field"
                              />
                            </div>
                            <div>
                              <Label htmlFor="wadingDepthRect" className="text-xs">Głębokość (m)</Label>
                              <Input
                                id="wadingDepthRect"
                                type="number"
                                step="0.1"
                                min="0.2"
                                max="1"
                                value={dimensions.wadingPool.depth || 0.4}
                                onChange={(e) => updateWadingPool({ depth: parseFloat(e.target.value) || 0.4 })}
                                className="input-field"
                              />
                            </div>
                          </div>
                        );
                      })()}
                      
                      <p className="text-xs text-muted-foreground -mt-2">
                        * Wymiary zewnętrzne (łącznie ze ścianą 20cm)
                      </p>
                    </>
                  )}
                  
                  {/* Depth input for irregular pools */}
                  {isCustomShape && (
                    <div className="space-y-2">
                      <Label htmlFor="wadingDepthIrregular" className="text-sm font-medium">Głębokość brodzika (m)</Label>
                      <Input
                        id="wadingDepthIrregular"
                        type="number"
                        step="0.1"
                        min="0.2"
                        max="1"
                        value={dimensions.wadingPool?.depth || 0.4}
                        onChange={(e) => updateWadingPool({ depth: parseFloat(e.target.value) || 0.4 })}
                        className="input-field"
                      />
                    </div>
                  )}
                  
                  {/* Dividing wall toggle - for both rectangular and irregular */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2">
                      <div>
                        <Label htmlFor="hasDividingWall" className="font-medium text-sm">Murek oddzielający</Label>
                        <p className="text-xs text-muted-foreground">
                          {dimensions.wadingPool?.hasDividingWall !== false 
                            ? `Góra murka: ${dimensions.wadingPool?.dividingWallOffset ?? 0}cm poniżej krawędzi basenu`
                            : 'Bez murku - płynne przejście'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="hasDividingWall"
                      checked={dimensions.wadingPool?.hasDividingWall !== false}
                      onCheckedChange={(checked) => updateWadingPool({ hasDividingWall: checked })}
                    />
                  </div>
                  
                  {/* Wall offset input - only when dividing wall is enabled */}
                  {dimensions.wadingPool?.hasDividingWall !== false && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border">
                      <Label htmlFor="wallOffset" className="text-sm">Góra murka od krawędzi basenu (cm)</Label>
                      <Input
                        id="wallOffset"
                        type="number"
                        min={0}
                        max={Math.round(dimensions.depth * 100) - Math.round((dimensions.wadingPool?.depth ?? 0.4) * 100)}
                        step={1}
                        value={dimensions.wadingPool?.dividingWallOffset ?? 0}
                        onChange={(e) => updateWadingPool({ dividingWallOffset: Number(e.target.value) })}
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = równo ze ścianą basenu, większa wartość = murek niżej
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          )}

          {/* Geometry validation warnings */}
          {geometryWarnings.length > 0 && (
            <div className="space-y-2">
              {geometryWarnings.map((warning, index) => (
                <Alert 
                  key={index} 
                  variant={warning.severity === 'error' ? 'destructive' : 'default'}
                  className={warning.severity === 'warning' ? 'border-yellow-500 bg-yellow-500/10' : ''}
                >
                  <AlertTriangle className={`h-4 w-4 ${warning.severity === 'warning' ? 'text-yellow-600' : ''}`} />
                  <AlertDescription className={warning.severity === 'warning' ? 'text-yellow-700' : ''}>
                    {warning.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-3">
              <Waves className="w-5 h-5 text-primary" />
              <div>
                <Label htmlFor="irregular" className="font-medium">Kształt nieregularny</Label>
                <p className="text-xs text-muted-foreground">
                  Dopłata {companySettings.irregularSurchargePercent}% do folii
                </p>
              </div>
            </div>
            <Switch
              id="irregular"
              checked={dimensions.isIrregular}
              onCheckedChange={(checked) => updateDimension('isIrregular', checked)}
              
            />
          </div>
        </div>

        {/* Right: 3D Visualization & Calculations - sticky on scroll */}
        <div className="glass-card p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <Tabs defaultValue="3d" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="3d" className="flex items-center gap-2">
                <Box className="w-4 h-4" />
                Wizualizacja 3D
              </TabsTrigger>
              <TabsTrigger value="calculations" className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Obliczenia
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="3d" className="space-y-4">
              {/* Dimension display control */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Wymiary:</span>
                <RadioGroup 
                  value={dimensionDisplay} 
                  onValueChange={(value) => setDimensionDisplay(value as DimensionDisplay)}
                  className="flex flex-wrap gap-2"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="pool" id="dim-pool-main" className="h-3 w-3" />
                    <Label htmlFor="dim-pool-main" className="text-xs cursor-pointer">Niecka</Label>
                  </div>
                  {(dimensions.stairs?.enabled || (dimensions.shape === 'nieregularny' && dimensions.customStairsVertices?.some(arr => arr.length >= 3))) && (
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="stairs" id="dim-stairs-main" className="h-3 w-3" />
                      <Label htmlFor="dim-stairs-main" className="text-xs cursor-pointer">Schody</Label>
                    </div>
                  )}
                  {(dimensions.wadingPool?.enabled || (dimensions.shape === 'nieregularny' && dimensions.customWadingPoolVertices?.some(arr => arr.length >= 3))) && (
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="wading" id="dim-wading-main" className="h-3 w-3" />
                      <Label htmlFor="dim-wading-main" className="text-xs cursor-pointer">Brodzik</Label>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="all" id="dim-all-main" className="h-3 w-3" />
                    <Label htmlFor="dim-all-main" className="text-xs cursor-pointer">Wszystko</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="none" id="dim-none-main" className="h-3 w-3" />
                    <Label htmlFor="dim-none-main" className="text-xs cursor-pointer">Brak</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="flex flex-col gap-4">
                <div>
                  <Pool2DPreview 
                    dimensions={dimensions}
                    height={200}
                    dimensionDisplay={dimensionDisplay}
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Widok z góry (2D)
                  </p>
                </div>
                <div>
                  <Pool3DVisualization 
                    dimensions={dimensions}
                    calculations={calculations}
                    showFoilLayout={false}
                    height={320}
                    dimensionDisplay={dimensionDisplay}
                    onDimensionDisplayChange={setDimensionDisplay}
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Wizualizacja 3D
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="calculations">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-5 h-5 text-primary" />
                <h3 className="text-base font-medium">Obliczenia</h3>
              </div>

              {calculations && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Objętość</p>
                      <p className="text-2xl font-bold text-primary">
                        {calculations.volume.toFixed(1)} <span className="text-sm font-normal">m³</span>
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Powierzchnia lustra</p>
                      <p className="text-2xl font-bold">
                        {calculations.surfaceArea.toFixed(1)} <span className="text-sm font-normal">m²</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Powierzchnia ścian</span>
                      <span className="font-medium">{calculations.wallArea.toFixed(1)} m²</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Obwód</span>
                      <span className="font-medium">{calculations.perimeterLength.toFixed(1)} m</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Głębokość wody</span>
                      <span className="font-medium">{calculations.waterDepth.toFixed(2)} m</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Typ przelewu</span>
                      <span className="font-medium">{overflowTypeLabels[dimensions.overflowType]}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-accent mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-accent">Wydajność filtracji (DIN)</p>
                        <p className="text-2xl font-bold mt-1">
                          {calculations.requiredFlow.toFixed(1)} <span className="text-sm font-normal">m³/h</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Formuła: (0.37 × {calculations.volume.toFixed(1)}) / {nominalLoadByType[poolType]}
                          {dimensions.attractions > 0 && ` + (6 × ${dimensions.attractions})`}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

    </div>
  );
}