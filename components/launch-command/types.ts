// ─────────────────────────────────────────────────────────
// Launch Command — Types
// ─────────────────────────────────────────────────────────

export interface BattleContext {
  opponent: string;
  reason: string;
  keyDifference: string;
  recommendation: string;
}

export interface LaunchCommandData {
  product: { title: string; score: number; verdict: string; country: string; marginMultiple: number };
  battle: { opponent: string; whyWon: string; keyDifference: string; confidence: number; recommendation: string };
  market: { country: string; language: string; currency: string; tone: string };
  winnerSnapshot: { battleAdvantage: string; mainRisks: string[]; missingValidations: string[] };
  strategicDecision: { whyLaunch: string; functionalProblem: string; emotionalProblem: string; mainDesire: string; alternativeReplaced: string; mainHypothesis: string; killRisk: string };
  unitEconomics: { suggestedRetailPrice: string; estimatedLandedCost: string; grossMarginUSD: string; grossMarginPct: string; maxCACRecommendation: string; breakEvenLogic: string; recommendedOffer: string; bundleIdea: string; discountLimit: string };
  positioning: { categoryFraming: string; oneLiner: string; mainPromise: string; dangerousPromises: string[]; primaryAudience: string; secondaryAudience: string; useCases: string[]; objectionsToOvercome: string[] };
  creativeAngles: Array<{ id: string; name: string; emotion: string; hook: string; visualDirection: string; objectionAttacked: string; hypothesis: string; risk: string; confidence: 'high' | 'medium' | 'low' }>;
  creativeTestingPlan: { staticAds: Array<{ id: string; concept: string; hook: string; copy: string; whatItTests: string; winSignal: string; winAction: string }>; ugcBriefs: Array<{ id: string; hook: string; brief: string; whatItTests: string; winSignal: string }>; hookVariations: string[] };
  storeLanding: { headline: string; subheadline: string; heroCopy: string; benefits: string[]; problemStatement: string; solutionStatement: string; howItWorks: string[]; objectionsFAQ: Array<{ q: string; a: string }>; cta: string; shortDescription: string; longDescription: string; blockOrder: string[] };
  preImportValidation: { supplierQuestions: string[]; mediaToRequest: string[]; certificationsToVerify: string[]; sampleTests: string[]; killConditions: string[]; firstStockRecommendation: string };
  launchPlan: Array<{ period: string; focus: string; tasks: string[]; checkpoint: string }>;
}

export type LaunchBoardData = LaunchCommandData;

export type SectionId =
  | 'snapshot'
  | 'estrategia'
  | 'economia'
  | 'posicionamiento'
  | 'angulos'
  | 'creativos'
  | 'landing'
  | 'validacion'
  | 'plan';

export type TabStatus = 'pending' | 'in-progress' | 'blocked' | 'ready';

export interface TabDecision {
  status: TabStatus;
  note: string;
  decidedAt?: string;
}

export interface EconomicsInputs {
  fobCost: number;
  moq: number;
  freightPerUnit: number;
  importDutiesPct: number;
  packagingCost: number;
  processorFeePct: number;
  platformFeePct: number;
  fulfillmentCost: number;
  returnsAllowancePct: number;
  damagedAllowancePct: number;
  sellingPrice: number;
  discountPrice: number;
  expectedCAC: number;
  monthlyMarketingBudget: number;
}

export type GateStatus = 'not-started' | 'in-progress' | 'passed' | 'blocked' | 'failed';

export interface ValidationGate {
  id: string;
  label: string;
  description: string;
  requiredEvidence: string;
  nextAction: string;
  required: boolean; // required gates block "mark ready"
}

export const VALIDATION_GATES: ValidationGate[] = [
  { id: 'supplier', label: 'Gate de Proveedor', description: 'Proveedor confirmado, MOQ viable, tiempos claros', requiredEvidence: 'Confirmación escrita de MOQ, lead time y política de defectos', nextAction: 'Contactar proveedor en Alibaba o WhatsApp', required: true },
  { id: 'sample', label: 'Gate de Muestra', description: 'Muestra física recibida y testeada en uso real', requiredEvidence: 'Muestra en mano, fotos propias, video de uso, defectos documentados', nextAction: 'Solicitar muestra y confirmar costo de envío', required: true },
  { id: 'compliance', label: 'Gate de Cumplimiento', description: 'Certificaciones y trámites aduaneros claros', requiredEvidence: 'Posición arancelaria, certificaciones requeridas, VUCE si aplica', nextAction: 'Consultar con despachante de aduana', required: false },
  { id: 'demand', label: 'Gate de Demanda', description: 'Señal de mercado confirma interés real (independiente del análisis interno)', requiredEvidence: 'Datos de Google Trends, ML competidores, rango de precios real validado', nextAction: 'Revisar análisis de mercado', required: false },
  { id: 'economics', label: 'Gate Económico', description: 'Economía de la unidad aprobada con números reales, no estimados', requiredEvidence: 'Calculadora completada, margen >= 40%, CAC máximo calculado', nextAction: 'Completar calculadora en Tab 03', required: true },
  { id: 'creative', label: 'Gate Creativo', description: 'Al menos un ángulo testeado con presupuesto real de pauta', requiredEvidence: 'Al menos 1 creativo con CTR > 1.5% o ROAS > 1.5x en test mínimo', nextAction: 'Completar brief creativo en Tab 06', required: false },
  { id: 'landing', label: 'Gate de Landing', description: 'Página de producto operativa y testeada de punta a punta', requiredEvidence: 'Landing publicada, tracking configurado, compra de prueba realizada', nextAction: 'Completar estructura en Tab 07', required: false },
];

// Checklist state: outer key = checklist group ID, inner key = item index as string, value = checked
export type ChecklistState = Partial<Record<string, boolean>>;

export interface UserEdits {
  tabDecisions: Partial<Record<SectionId, TabDecision>>;
  checkpoints: Partial<Record<SectionId, string>>;
  economicsInputs: Partial<EconomicsInputs>;
  selectedAngles: string[];
  validationGates: Partial<Record<string, GateStatus>>;
  validationNotes: Partial<Record<string, string>>;
  chosenPositioningNote: string;
  landingNotes: string;
  // Checklist state persisted per checklist group
  checklistState: Partial<Record<string, ChecklistState>>;
  lastUpdated: string;
}

export const DEFAULT_USER_EDITS: UserEdits = {
  tabDecisions: {},
  checkpoints: {},
  economicsInputs: {},
  selectedAngles: [],
  validationGates: {},
  validationNotes: {},
  chosenPositioningNote: '',
  landingNotes: '',
  checklistState: {},
  lastUpdated: new Date().toISOString(),
};

// Required tabs (must be 'ready' for the board to conclude)
export const REQUIRED_TABS: SectionId[] = ['snapshot', 'economia', 'estrategia', 'angulos', 'validacion'];

// Ordered workflow
export const TAB_ORDER: SectionId[] = [
  'snapshot', 'economia', 'estrategia', 'posicionamiento',
  'angulos', 'creativos', 'landing', 'validacion', 'plan',
];
