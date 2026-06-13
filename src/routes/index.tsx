import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Pill, BarChart3, ShieldCheck, Clock, Boxes, Receipt,
  Users, CheckCircle2, Phone, Mail, MapPin, ArrowRight,
} from "lucide-react";
import heroImg from "@/assets/hero-pharmacy.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MedixPharm — Pharmacy Management System for Ethiopia" },
      { name: "description", content: "Affordable, locally-built pharmacy management software for Ethiopian pharmacies. Inventory, sales, expiry tracking, and reports in one system." },
      { property: "og:title", content: "MedixPharm — Pharmacy Management System for Ethiopia" },
      { property: "og:description", content: "Run your pharmacy smarter. Inventory, POS, expiry alerts, and reports — built for Ethiopia." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="size-8 rounded-lg grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
              <Pill className="size-4" />
            </span>
            MedixPharm
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline"><a href="/app/inventory">Open App</a></Button>
            <Button asChild size="sm"><a href="#contact">Request Demo</a></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-soft)" }}>
        <div className="container mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-accent/20 text-accent-foreground border border-accent/30">
              🇪🇹 Made for Ethiopian pharmacies
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05]">
              Run your pharmacy <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>without the chaos</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              MedixPharm is an all-in-one pharmacy management system — track inventory, sell faster at the counter, get expiry alerts, and see your profit in real time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="shadow-[var(--shadow-glow)]">
                <a href="#contact">Get a Free Demo <ArrowRight className="ml-2 size-4" /></a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">See Features</a>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> Amharic & English</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> Works offline</div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-30" style={{ background: "var(--gradient-hero)" }} />
            <img
              src={heroImg}
              alt="Modern pharmacy using MedixPharm management software"
              width={1920}
              height={1080}
              className="relative rounded-2xl shadow-[var(--shadow-card)] w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Everything your pharmacy needs</h2>
          <p className="mt-4 text-muted-foreground">One simple system that replaces spreadsheets, paper records, and guesswork.</p>
        </div>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { i: Boxes, t: "Inventory Management", d: "Track every medicine, batch, and supplier in real time." },
            { i: Receipt, t: "Point of Sale (POS)", d: "Fast counter sales with barcode support and printable receipts." },
            { i: Clock, t: "Expiry Alerts", d: "Get notified before medicines expire — never lose stock again." },
            { i: BarChart3, t: "Sales & Profit Reports", d: "Daily, weekly and monthly reports to know exactly how you're doing." },
            { i: Users, t: "Staff & Roles", d: "Add cashiers and pharmacists with the right permissions." },
            { i: ShieldCheck, t: "Secure Backups", d: "Your data is safe — automatic backups so you never lose records." },
          ].map(({ i: Icon, t, d }) => (
            <Card key={t} className="p-6 hover:shadow-[var(--shadow-card)] transition-shadow border-border">
              <div className="size-11 rounded-lg grid place-items-center mb-4 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold text-lg">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-secondary/40 py-20">
        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Built for Ethiopia, priced for Ethiopia</h2>
            <p className="mt-4 text-muted-foreground">We understand local pharmacies — from Addis to regional towns. MedixPharm supports ETB pricing, local tax, and works even when the internet is slow.</p>
            <ul className="mt-6 space-y-3">
              {["Local Birr (ETB) pricing & VAT", "On-site installation & training", "Works on any Windows computer", "Free updates & local phone support"].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-primary mt-0.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: "50+", l: "Pharmacies onboarded" },
              { n: "24/7", l: "Local support" },
              { n: "99%", l: "Uptime" },
              { n: "< 1 day", l: "Setup time" },
            ].map((s) => (
              <Card key={s.l} className="p-6 text-center">
                <div className="text-3xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>{s.n}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.l}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Simple, honest pricing</h2>
          <p className="mt-4 text-muted-foreground">Pay once or subscribe monthly — your choice.</p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { n: "Starter", p: "15,000", per: "ETB / one-time", f: ["1 computer", "Inventory + POS", "Basic reports", "Email support"] },
            { n: "Business", p: "30,000", per: "ETB / one-time", f: ["Up to 3 computers", "All features", "Expiry alerts", "Phone support", "On-site training"], featured: true },
            { n: "Enterprise", p: "Custom", per: "Contact us", f: ["Multi-branch", "Custom features", "Dedicated manager", "Priority support"] },
          ].map((plan) => (
            <Card key={plan.n} className={`p-8 relative ${plan.featured ? "border-primary shadow-[var(--shadow-glow)]" : ""}`}>
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
                  Most Popular
                </span>
              )}
              <h3 className="font-display font-bold text-xl">{plan.n}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.p}</span>
              </div>
              <div className="text-sm text-muted-foreground">{plan.per}</div>
              <ul className="mt-6 space-y-3 text-sm">
                {plan.f.map((f) => (
                  <li key={f} className="flex gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              <Button asChild className="w-full mt-8" variant={plan.featured ? "default" : "outline"}>
                <a href="#contact">Get Started</a>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="py-20" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-6 max-w-4xl text-center text-primary-foreground">
          <h2 className="text-3xl md:text-5xl font-bold">Ready to modernize your pharmacy?</h2>
          <p className="mt-4 text-lg opacity-90">Book a free demo today — we'll show you everything in 20 minutes.</p>
          <div className="mt-10 grid sm:grid-cols-3 gap-6 text-left">
            <a href="tel:+251900000000" className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl p-4 hover:bg-white/20 transition">
              <Phone className="size-5" /><div><div className="text-xs opacity-75">Call</div><div className="font-semibold">+251 900 000 000</div></div>
            </a>
            <a href="mailto:hello@medixpharm.et" className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl p-4 hover:bg-white/20 transition">
              <Mail className="size-5" /><div><div className="text-xs opacity-75">Email</div><div className="font-semibold">hello@medixpharm.et</div></div>
            </a>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl p-4">
              <MapPin className="size-5" /><div><div className="text-xs opacity-75">Based in</div><div className="font-semibold">Addis Ababa, Ethiopia</div></div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} MedixPharm. Built in Ethiopia.
        </div>
      </footer>
    </div>
  );
}
