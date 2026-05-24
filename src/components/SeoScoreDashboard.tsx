import { useMemo, useEffect, useState } from "react";
import {
  calculateFleschScore,
  getFleschLabel,
  extractKeywordDensity,
  getContentMetrics,
  analyzeSeoChecklist,
  calculateOverallScore,
  type SeoCheckItem,
} from "@/lib/seo-utils";
import {
  CheckCircle2,
  XCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target,
  Type,
  AlignLeft,
  Hash,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface SeoScoreDashboardProps {
  markdown: string;
  seo: {
    title?: string;
    metaDescription?: string;
    tags?: string[];
    readingTime?: string;
  };
}

// ─── Animated Circular Gauge ─────────────────────────────────────────

function CircularGauge({ score, size = 120 }: { score: number; size?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  useEffect(() => {
    setAnimatedScore(0);
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const getColor = (s: number) => {
    if (s >= 80) return "oklch(0.75 0.18 145)"; // green
    if (s >= 60) return "oklch(0.80 0.18 90)";  // yellow
    if (s >= 40) return "oklch(0.72 0.18 45)";  // amber/accent
    return "oklch(0.6 0.22 25)";                 // red
  };

  const color = getColor(animatedScore);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(1 0 0 / 6%)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      {/* Score Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold transition-all duration-700"
          style={{ color }}
        >
          {animatedScore}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
          / 100
        </span>
      </div>
    </div>
  );
}

// ─── Horizontal Bar ──────────────────────────────────────────────────

function HorizontalBar({ value, max, color }: { value: number; max: number; color: string }) {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const percentage = Math.min(100, (value / max) * 100);

  useEffect(() => {
    setAnimatedWidth(0);
    const timer = setTimeout(() => setAnimatedWidth(percentage), 150);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="h-2 w-full rounded-full bg-border/50 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${animatedWidth}%`,
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
    </div>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────

export function SeoScoreDashboard({ markdown, seo }: SeoScoreDashboardProps) {
  const [expanded, setExpanded] = useState(true);

  const overallScore = useMemo(() => calculateOverallScore(markdown, seo), [markdown, seo]);
  const fleschScore = useMemo(() => calculateFleschScore(markdown), [markdown]);
  const fleschLabel = useMemo(() => getFleschLabel(fleschScore), [fleschScore]);
  const keywords = useMemo(() => extractKeywordDensity(markdown, 5), [markdown]);
  const metrics = useMemo(() => getContentMetrics(markdown), [markdown]);
  const checklist = useMemo(() => analyzeSeoChecklist(markdown, seo), [markdown, seo]);

  const passedCount = checklist.filter((c) => c.passed).length;

  return (
    <Card className="seo-score-card border-border/60 bg-card/60 backdrop-blur shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="inline-flex size-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
            <BarChart3 className="size-4 text-accent" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">SEO Health Score</h3>
            <p className="text-xs text-muted-foreground">
              {passedCount}/{checklist.length} checks passed · Readability: {fleschLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-bold"
            style={{
              color:
                overallScore >= 80
                  ? "oklch(0.75 0.18 145)"
                  : overallScore >= 60
                    ? "oklch(0.80 0.18 90)"
                    : "var(--accent)",
            }}
          >
            {overallScore}/100
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 pb-6 space-y-6 border-t border-border/40">
          {/* Top Row: Gauge + Readability */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {/* Circular Gauge */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-background/40 border border-border/30">
              <CircularGauge score={overallScore} />
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">Overall SEO Score</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Combines content, readability & metadata
                </p>
              </div>
            </div>

            {/* Readability */}
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-background/40 border border-border/30">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Target className="size-3.5 text-accent" /> Readability
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Flesch Reading Ease</span>
                  <span className="font-semibold text-foreground">{fleschScore}/100</span>
                </div>
                <HorizontalBar
                  value={fleschScore}
                  max={100}
                  color={
                    fleschScore >= 60
                      ? "oklch(0.75 0.18 145)"
                      : fleschScore >= 40
                        ? "oklch(0.80 0.18 90)"
                        : "oklch(0.6 0.22 25)"
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  Grade: <span className="font-medium text-foreground">{fleschLabel}</span>
                </p>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg sentence length</span>
                  <span className="font-medium text-foreground">{metrics.avgSentenceLength} words</span>
                </div>
                <HorizontalBar
                  value={Math.min(metrics.avgSentenceLength, 30)}
                  max={30}
                  color={
                    metrics.avgSentenceLength >= 10 && metrics.avgSentenceLength <= 20
                      ? "oklch(0.75 0.18 145)"
                      : "oklch(0.80 0.18 90)"
                  }
                />
              </div>
            </div>
          </div>

          {/* Content Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                icon: <Type className="size-3.5" />,
                label: "Words",
                value: metrics.wordCount.toLocaleString(),
                sub:
                  metrics.wordCount >= 800
                    ? "Great depth"
                    : metrics.wordCount >= 400
                      ? "Good length"
                      : "Consider expanding",
              },
              {
                icon: <Hash className="size-3.5" />,
                label: "Headings",
                value: metrics.headingCount.toString(),
                sub: `${metrics.h1Count} H1 · ${metrics.h2Count} H2 · ${metrics.h3Count} H3`,
              },
              {
                icon: <AlignLeft className="size-3.5" />,
                label: "Paragraphs",
                value: metrics.paragraphCount.toString(),
                sub: metrics.paragraphCount >= 5 ? "Well structured" : "Could use more breaks",
              },
              {
                icon: <Target className="size-3.5" />,
                label: "Sentences",
                value: metrics.sentenceCount.toString(),
                sub: `~${metrics.avgSentenceLength} words/sentence`,
              },
            ].map((m) => (
              <div
                key={m.label}
                className="flex flex-col gap-1.5 p-3 rounded-xl bg-background/40 border border-border/30"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {m.icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{m.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* SEO Checklist */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-accent" />
              SEO Checklist ({passedCount}/{checklist.length})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {checklist.map((item: SeoCheckItem) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs border transition-colors ${
                    item.passed
                      ? "bg-emerald-500/5 border-emerald-500/20 text-foreground"
                      : "bg-destructive/5 border-destructive/20 text-muted-foreground"
                  }`}
                >
                  {item.passed ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="size-3.5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground ml-1.5">· {item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keyword Density */}
          {keywords.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-accent" />
                Top Keywords
              </p>
              <div className="space-y-2">
                {keywords.map((kw) => (
                  <div key={kw.word} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-foreground">{kw.word}</span>
                      <span className="text-muted-foreground">
                        {kw.count}× ({kw.percentage}%)
                      </span>
                    </div>
                    <HorizontalBar
                      value={kw.percentage}
                      max={Math.max(5, keywords[0]?.percentage || 5)}
                      color="var(--accent)"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
