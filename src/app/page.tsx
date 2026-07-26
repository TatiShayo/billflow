"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Sparkles,
  Globe,
  MessageCircle,
  Receipt,
  Smartphone,
  ArrowRight,
  Check,
  Star,
  ChevronDown,
  ChevronUp,
  Mail,
  Loader2,
  Zap,
  Users,
  BarChart3,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div as any;

const features = [
  {
    icon: Sparkles,
    title: "AI Invoice Generator",
    description:
      "Just describe your work in plain English and our AI builds professional invoices with accurate line items, rates, and payment terms — in seconds.",
  },
  {
    icon: FileText,
    title: "PDF Generation + Email",
    description:
      "Instantly generate clean, professional PDFs and email them to clients with a single click. Fully customizable with your branding.",
  },
  {
    icon: Globe,
    title: "Multi-Currency Support",
    description:
      "Bill clients in USD, EUR, GBP, KES, ZAR, NGN, and more. Built for freelancers everywhere, with special support for East Africa.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Share",
    description:
      "Share invoices directly via WhatsApp. Generate a link with a pre-filled message — your client clicks and sees the invoice instantly.",
  },
  {
    icon: Receipt,
    title: "Expense Tracking",
    description:
      "Track business expenses by category. Upload receipts, see monthly breakdowns, and understand your profitability at a glance.",
  },
  {
    icon: Smartphone,
    title: "M-Pesa Friendly",
    description:
      "Designed with East African freelancers in mind. Currency support for KES, payment tracking compatible with mobile money workflows.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      "Up to 10 clients",
      "5 invoices per month",
      "Single currency",
      "PDF generation",
      "Email invoices",
    ],
    cta: "Start Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$8",
    period: "/month",
    description: "For growing freelancers",
    features: [
      "Unlimited clients",
      "Unlimited invoices",
      "AI invoice generator",
      "Multi-currency support",
      "WhatsApp sharing",
      "Priority support",
    ],
    cta: "Get Pro",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$16",
    period: "/month",
    description: "For agencies and teams",
    features: [
      "Everything in Pro",
      "Expense management",
      "Financial reports",
      "Custom branding",
      "Receipt uploads",
      "Client portal",
    ],
    cta: "Get Business",
    href: "/signup",
    highlighted: false,
  },
];

const testimonials = [
  {
    quote:
      "BillFlow saved me hours every week. The AI generator actually understands my projects and creates perfect invoices. I went from dreading invoice day to it taking 30 seconds.",
    author: "Sarah M.",
    role: "Freelance Designer, Nairobi",
    rating: 5,
  },
  {
    quote:
      "I tried FreshBooks but couldn't justify $19/month when I only have a few clients. BillFlow's free tier is genuinely generous, and the $8 Pro plan has everything I need.",
    author: "James K.",
    role: "Web Developer, London",
    rating: 5,
  },
  {
    quote:
      "The WhatsApp sharing feature is a game-changer. Most of my clients in Kenya prefer WhatsApp over email, and now I can send invoices exactly where they'll see them.",
    author: "Amina W.",
    role: "Marketing Consultant, Mombasa",
    rating: 5,
  },
];

const faqs = [
  {
    q: "Is the free tier really free?",
    a: "Yes — no credit card required. You get 10 clients, 5 invoices per month, PDF generation, and email delivery. We make money when you upgrade because the product is actually useful.",
  },
  {
    q: "How does the AI invoice generator work?",
    a: "Just describe what you did: 'Built a Shopify store over 3 weeks, logo design, and consulting.' Our AI (GPT-4o-mini) parses your description and fills in line items with professional descriptions and rates automatically.",
  },
  {
    q: "What payment methods do you support?",
    a: "BillFlow helps you create and send invoices. Payment collection (Stripe integration) is coming soon. For now, invoices include your payment instructions — bank transfer, M-Pesa, PayPal, whatever you prefer.",
  },
  {
    q: "Can I use my own branding?",
    a: "Business plan ($16/mo) includes custom branding — your logo, colors, and company details on every invoice. Free and Pro plans include the BillFlow brand on invoices.",
  },
  {
    q: "How does multi-currency work?",
    a: "Set a default currency or choose per invoice. We support USD, GBP, EUR, KES, ZAR, NGN, and more. Each client can have their own default currency too.",
  },
  {
    q: "Can I export my data?",
    a: "Yes — you can export invoices to CSV anytime. Your data is yours. We're built on Supabase so you own your database.",
  },
];

const comparisonData = [
  { feature: "Free clients", billflow: "10", freshbooks: "0", wave: "Unlimited" },
  { feature: "AI invoice generator", billflow: "✓", freshbooks: "✗", wave: "✗" },
  { feature: "WhatsApp sharing", billflow: "✓", freshbooks: "✗", wave: "✗" },
  { feature: "Multi-currency", billflow: "✓", freshbooks: "✓", wave: "✓" },
  { feature: "Expense tracking", billflow: "✓", freshbooks: "✓", wave: "✓" },
  { feature: "PDF invoices", billflow: "✓", freshbooks: "✓", wave: "✓" },
  { feature: "Starting price", billflow: "$0/mo", freshbooks: "$19/mo", wave: "$0/mo" },
  { feature: "M-Pesa friendly", billflow: "✓", freshbooks: "✗", wave: "✗" },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [demoInput, setDemoInput] = useState("");
  const [demoResult, setDemoResult] = useState<
    { description: string; qty: number; price: string }[] | null
  >(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function runDemo() {
    if (!demoInput.trim()) return;
    setDemoLoading(true);
    // Simulated AI demo — in production would call the API
    setTimeout(() => {
      const items = demoInput.toLowerCase().includes("website")
        ? [
            {
              description: "Website Development — Shopify Store",
              qty: 60,
              price: "$75/hr",
            },
            {
              description: "Logo Design & Branding",
              qty: 1,
              price: "$500 flat",
            },
            {
              description: "Strategy Consulting Call",
              qty: 1,
              price: "$150 flat",
            },
          ]
        : [
            {
              description: "Professional Services",
              qty: 20,
              price: "$85/hr",
            },
            {
              description: "Project Deliverables",
              qty: 1,
              price: "$1,200 flat",
            },
          ];
      setDemoResult(items);
      setDemoLoading(false);
    }, 1500);
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
              <FileText className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-lg font-bold tracking-tight">BillFlow</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#compare" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Compare
            </a>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-emerald-600 hover:bg-emerald-500" size="sm">
                Start Free — No Card Required
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-8">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                AI-Powered Invoicing for Freelancers
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                Describe your work.
                <br />
                <span className="text-emerald-400">We write the invoice.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Stop wrestling with invoice templates. Just describe what you did
                in plain English and our AI builds a professional, accurate
                invoice in seconds. Free for up to 10 clients.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 max-w-sm">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12"
                  />
                </div>
                <Link href={email ? `/signup?email=${email}` : "/signup"}>
                  <Button className="bg-emerald-600 hover:bg-emerald-500 h-12 px-8 gap-2 text-base" size="lg">
                    Start Free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                No credit card required. 10 clients free forever.
              </p>
            </div>

            {/* Animated invoice mockup */}
            <div className="relative">
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white text-gray-900 rounded-xl shadow-2xl p-6 rotate-1"
              >
                <div className="flex justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="font-bold text-sm">BillFlow</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">INVOICE</p>
                    <p className="text-xs text-gray-500">#INV-0042</p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider">Bill To</p>
                  <p className="font-semibold text-sm">Acme Corp</p>
                </div>
                <table className="w-full text-xs mb-4">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-400">
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">Website Development</td>
                      <td className="py-2 text-right">60 hrs</td>
                      <td className="py-2 text-right font-mono">$4,500</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">Logo Design Package</td>
                      <td className="py-2 text-right">1</td>
                      <td className="py-2 text-right font-mono">$500</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">Strategy Consulting</td>
                      <td className="py-2 text-right">1 hr</td>
                      <td className="py-2 text-right font-mono">$150</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex justify-end border-t-2 border-gray-200 pt-2">
                  <div className="text-right">
                    <p className="text-lg font-bold">$5,150.00</p>
                    <p className="text-[10px] text-gray-500">Due May 15, 2026</p>
                  </div>
                </div>
              </MotionDiv>
              {/* Floaty badge */}
              <MotionDiv
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="absolute -bottom-4 -left-4 bg-emerald-500 text-white rounded-lg px-4 py-2 shadow-lg flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">AI generated</span>
              </MotionDiv>
            </div>
          </div>
        </div>
      </section>

      {/* AI Demo */}
      <section className="py-16 bg-card/50">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Try the AI Invoice Generator
          </h2>
          <p className="text-muted-foreground">
            Type what you did and watch an invoice appear — no signup needed.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder='e.g. "I built a website, logo design, and 3 weeks consulting"'
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
              className="h-12 text-base"
              onKeyDown={(e) => e.key === "Enter" && runDemo()}
            />
            <Button
              onClick={runDemo}
              disabled={demoLoading || !demoInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 h-12 gap-2 px-6"
            >
              {demoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate
            </Button>
          </div>

          <AnimatePresence>
            {demoResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-gray-900 rounded-xl p-6 text-left shadow-lg"
              >
                <div className="flex justify-between mb-4">
                  <div>
                    <p className="font-bold">INVOICE</p>
                    <p className="text-xs text-gray-500">#INV-DEMO</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    AI Generated
                  </Badge>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-400 text-xs">
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoResult.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2.5">{item.description}</td>
                        <td className="py-2.5 text-right font-mono text-xs">{item.qty}</td>
                        <td className="py-2.5 text-right font-mono text-xs">{item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-4 pt-3 border-t-2 border-gray-200">
                  <p className="text-lg font-bold">
                    {demoResult && demoResult.length > 0
                      ? `$${demoResult
                          .reduce((sum, i) => {
                            const price = parseFloat(
                              i.price.replace(/[^0-9.]/g, "")
                            );
                            return sum + price * i.qty;
                          }, 0)
                          .toLocaleString()}`
                      : ""}
                    .00
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge className="bg-emerald-500/20 text-emerald-400 mb-4">
              Everything you need
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Built for freelancers who want to get paid
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              No bloated accounting features you&apos;ll never use. Just fast,
              professional invoicing that gets money in your account.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border p-6 hover:border-emerald-500/30 transition-colors group"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="compare" className="py-20 bg-card/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              How we compare
            </h2>
            <p className="text-muted-foreground">
              The best free tier in the freelancer invoicing market
            </p>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-4 text-sm font-semibold">Feature</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-emerald-400">
                    BillFlow
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-muted-foreground">
                    FreshBooks
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-muted-foreground">
                    Wave
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-6 py-3.5 text-sm">{row.feature}</td>
                    <td className="px-6 py-3.5 text-sm text-center font-medium text-emerald-400">
                      {row.billflow}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-center text-muted-foreground">
                      {row.freshbooks}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-center text-muted-foreground">
                      {row.wave}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge className="bg-emerald-500/20 text-emerald-400 mb-4">
              Simple pricing
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Start free, upgrade when you grow
            </h2>
            <p className="text-muted-foreground">
              No hidden fees. Cancel anytime.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.highlighted
                    ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                    : "border-border"
                }`}
              >
                {plan.highlighted && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 mb-3 border-emerald-500/30">
                    Most popular
                  </Badge>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-3 mb-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  {plan.description}
                </p>
                <Link href={plan.href}>
                  <Button
                    className={`w-full mb-6 ${
                      plan.highlighted
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-card/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Loved by freelancers
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="rounded-xl border border-border p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-semibold">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-border overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    setOpenFaq(openFaq === i ? null : i)
                  }
                >
                  <span className="font-medium text-sm">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-card/50">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to get paid faster?
          </h2>
          <p className="text-muted-foreground">
            Join thousands of freelancers using BillFlow to create professional
            invoices in seconds. Start free — no credit card.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 h-12 px-8 gap-2"
                size="lg"
              >
                Start Free — No Card Required <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                <FileText className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="font-bold tracking-tight">BillFlow</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-foreground transition-colors">
                Sign up
              </Link>
              <a
                href="mailto:hello@billflow.app"
                className="hover:text-foreground transition-colors"
              >
                Contact
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} BillFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
