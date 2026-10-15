import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Church,
  CircleHelp,
  CircleUserRound,
  ClipboardCheck,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Folder,
  FolderKanban,
  GraduationCap,
  Home,
  Hourglass,
  Info,
  Link2,
  ListTodo,
  Lock,
  MapPin,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Target,
  Trash2,
  Unlock,
  Upload,
  UserRound,
  UsersRound,
  Video,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";

export const CEAC_ICON_SIZES = Object.freeze({
  meta: 16,
  row: 18,
  control: 18,
  nav: 20,
  feature: 24,
  empty: 36,
});

export const CEAC_ICONS = Object.freeze({
  home: Home,
  work: ClipboardCheck,
  team: UsersRound,
  people: UsersRound,
  person: UserRound,
  record: FileCheck2,
  calendar: CalendarDays,
  projects: FolderKanban,
  portfolio: Briefcase,
  ministry: Church,
  organisation: Building2,
  finance: WalletCards,
  reports: BarChart3,
  messages: MessageSquare,
  learning: GraduationCap,
  assets: Package,
  compliance: ShieldCheck,
  time: Clock,
  account: CircleUserRound,
  settings: Settings,
  control: SlidersHorizontal,
  help: CircleHelp,

  search: Search,
  create: Plus,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  close: X,
  more: MoreHorizontal,
  menu: Menu,
  filter: Filter,
  sort: ArrowUpDown,
  download: Download,
  upload: Upload,
  external: ExternalLink,
  refresh: RefreshCw,
  expand: Maximize2,
  collapse: Minimize2,

  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,

  check: Check,
  checkCircle: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: XCircle,
  notification: Bell,
  lock: Lock,
  unlock: Unlock,
  clock: Clock,
  pending: Hourglass,

  chart: BarChart3,
  table: Table2,
  location: MapPin,
  file: FileText,
  folder: Folder,
  link: Link2,
  meeting: Video,
  goal: Target,
  task: ListTodo,
  budget: DollarSign,
  knowledge: BookOpen,
});

export const CEAC_ICON_STROKE_WIDTH = 1.75;

export function CeacIcon({
  name,
  size = "control",
  strokeWidth = CEAC_ICON_STROKE_WIDTH,
  className,
  label,
  decorative,
  ...rest
}) {
  const IconComponent = CEAC_ICONS[name];

  if (!IconComponent) {
    if (import.meta.env.DEV) {
      console.warn(`Unknown CEAC V2 icon: ${String(name)}`);
    }
    return null;
  }

  const resolvedSize =
    typeof size === "number"
      ? size
      : CEAC_ICON_SIZES[size] ?? CEAC_ICON_SIZES.control;

  const isDecorative = decorative ?? !label;

  return (
    <IconComponent
      aria-hidden={isDecorative ? "true" : undefined}
      aria-label={!isDecorative && label ? label : undefined}
      className={className}
      color="currentColor"
      focusable="false"
      role={!isDecorative && label ? "img" : undefined}
      size={resolvedSize}
      strokeWidth={strokeWidth}
      {...rest}
    />
  );
}
