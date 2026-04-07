import { LucideIcon, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color?: "gold" | "green" | "red" | "blue" | "purple";
  href?: string;
}

const colorMap = {
  gold:   "text-primary bg-primary/10",
  green:  "text-green-400 bg-green-400/10",
  red:    "text-red-400 bg-red-400/10",
  blue:   "text-blue-400 bg-blue-400/10",
  purple: "text-purple-400 bg-purple-400/10",
};

const hoverBorderMap = {
  gold:   "hover:border-primary/30",
  green:  "hover:border-green-500/30",
  red:    "hover:border-red-500/30",
  blue:   "hover:border-blue-500/30",
  purple: "hover:border-purple-500/30",
};

export function StatCard({ icon: Icon, label, value, sub, color = "gold", href }: StatCardProps) {
  const inner = (
    <div className={`bg-[#0c1829] border border-white/5 rounded-xl p-5 flex items-start gap-4 transition-all ${
      href ? `cursor-pointer group ${hoverBorderMap[color]} hover:bg-white/2` : "hover:border-white/10"
    }`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/40 uppercase tracking-widest font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
      </div>
      {href && (
        <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/40 shrink-0 mt-1 transition-colors" />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <a>{inner}</a>
      </Link>
    );
  }
  return inner;
}
