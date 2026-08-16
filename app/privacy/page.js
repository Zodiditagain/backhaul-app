import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Backhaul",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-6"
        >
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
            <Truck className="-rotate-45" size={18} color="#ffffff" />
          </div>
          <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
        </div>

        <p className="text-xs text-gray-500 mb-8">Last updated: August 16, 2026</p>

        <div className="space-y-7 text-sm text-gray-300 leading-relaxed">
          <Section title="Who we are">
            <p>
              Backhaul ("Backhaul," "we," "us," or "our") operates the Backhaul platform at
              joinbackhaul.com and related mobile and web applications (the "Service"), which
              connects trucking companies, freight brokers, and vendors for backhaul and freight
              matching. This Policy is operated by{" "}
              <span className="text-gray-500">[Legal Entity Name, e.g. "Backhaul LLC, a [State] limited liability company"]</span>.
              For questions about this Policy, contact us at{" "}
              <span className="text-blue-400">privacy@joinbackhaul.com</span>.
            </p>
          </Section>

          <Section title="Information we collect">
            <p className="mb-2">
              We collect information you provide directly, information generated through your use
              of the Service, and information from third-party services that support the Service.
            </p>
            <p className="font-semibold text-gray-200 mt-4 mb-1">Account and profile information</p>
            <p>
              When you create an account, we collect your email address and role (trucker, broker,
              or vendor). Depending on your role, your profile may include your company name, fleet
              size, equipment types, DOT and MC numbers, cargo and liability insurance details,
              truck dimensions (height, weight, length, axle count) and hazmat status, years active,
              lanes you run, and a bio you choose to share.
            </p>
            <p className="font-semibold text-gray-200 mt-4 mb-1">Location information</p>
            <p>
              With your permission, we collect precise geolocation data from your device to power
              features including: marking yourself "available" for a backhaul near your current
              location, truck-legal route planning and turn-by-turn voice navigation, and biasing
              location search results toward where you are. We also process the addresses,
              places, and routes you search for or navigate to. Location searches and route
              calculations are sent to HERE Technologies to provide mapping, geocoding, and
              routing results — see "Third-party services" below.
            </p>
            <p className="font-semibold text-gray-200 mt-4 mb-1">Shipment and negotiation information</p>
            <p>
              When you use the Service to document a completed load, we collect the shipment
              details you enter — such as pickup and delivery locations, equipment type, and the
              agreed rate. Aggregated, anonymized rate data (never a single shipment, and never
              below a minimum sample size) may be used to power Market Pulse rate estimates for
              other users; we do not disclose any individual shipment, rate, or party. We also
              store messages and rate offers exchanged between matched users, and performance
              reviews submitted about counterparties.
            </p>
            <p className="font-semibold text-gray-200 mt-4 mb-1">Payment information</p>
            <p>
              Subscription payments are processed by Stripe. We do not receive or store your full
              payment card number. We do store your subscription status, plan, and Stripe customer
              and subscription identifiers so we can manage your access to paid features.
            </p>
            <p className="font-semibold text-gray-200 mt-4 mb-1">Automatically collected information</p>
            <p>
              We use session identifiers necessary to keep you signed in and to operate the
              Service securely. We do not currently use third-party advertising trackers.
            </p>
          </Section>

          <Section title="How we use your information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Operate, maintain, and improve the Service, including matching truckers with brokers and vendors;</li>
              <li>Process subscription payments and manage billing;</li>
              <li>Provide truck-legal routing, navigation, and location-based availability features;</li>
              <li>Calculate and display anonymized, aggregated Market Pulse rate estimates;</li>
              <li>Communicate with you about your account, transactions, and updates to the Service;</li>
              <li>Detect, investigate, and prevent fraud, abuse, and security incidents;</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </Section>

          <Section title="How we share your information">
            <p className="mb-2">We do not sell your personal information. We share information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-gray-200">With other users, as part of how the Service works</span> —
                for example, your company name, equipment, and availability are visible to
                potential matches, and your messages are visible to the counterparty in that
                conversation;
              </li>
              <li>
                <span className="text-gray-200">With service providers</span> who host, secure, and
                operate the Service on our behalf (see "Third-party services" below);
              </li>
              <li>
                <span className="text-gray-200">For legal reasons</span>, if required by law,
                subpoena, or other legal process, or to protect the rights, property, or safety of
                Backhaul, our users, or the public;
              </li>
              <li>
                <span className="text-gray-200">In a business transfer</span>, if Backhaul is
                involved in a merger, acquisition, or sale of assets.
              </li>
            </ul>
          </Section>

          <Section title="Third-party services">
            <p>We rely on the following service providers to operate the Service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><span className="text-gray-200">Supabase</span> — account authentication and database hosting;</li>
              <li><span className="text-gray-200">Stripe</span> — subscription billing and payment processing;</li>
              <li><span className="text-gray-200">HERE Technologies</span> — mapping, address search, geocoding, and truck routing;</li>
              <li><span className="text-gray-200">Vercel</span> — application hosting.</li>
            </ul>
            <p className="mt-2">
              Each provider processes the information necessary for its function and is subject to
              its own privacy practices.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              We retain account and shipment information for as long as your account is active and
              as needed to provide the Service, resolve disputes, and comply with legal and
              record-keeping obligations relevant to freight transactions. You may request deletion
              of your account as described below; some information may be retained where required
              by law or legitimate business need (for example, records related to completed
              shipments or billing).
            </p>
          </Section>

          <Section title="Your choices and rights">
            <p className="mb-2">
              You can review and update most profile information directly in your account
              settings. You can revoke location permission at any time through your browser or
              device settings, though this will disable location-dependent features like route
              navigation and "available now" posting.
            </p>
            <p>
              Depending on where you live, you may have additional rights over your personal
              information, such as the right to access, correct, or delete it, or to object to
              certain processing. To make a request, contact us at{" "}
              <span className="text-blue-400">privacy@joinbackhaul.com</span>. We will respond
              consistent with applicable law.
            </p>
          </Section>

          <Section title="Data security">
            <p>
              We use reasonable administrative, technical, and physical safeguards designed to
              protect your information. No method of transmission or storage is completely secure,
              and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="Children's privacy">
            <p>
              The Service is intended for business use by adults operating in the trucking and
              freight industry. It is not directed to, and we do not knowingly collect information
              from, anyone under 18.
            </p>
          </Section>

          <Section title="Changes to this Policy">
            <p>
              We may update this Policy from time to time. If we make material changes, we will
              update the "Last updated" date above and, where appropriate, provide additional
              notice.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about this Policy or how we handle your information can be sent to{" "}
              <span className="text-blue-400">privacy@joinbackhaul.com</span>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      {children}
    </section>
  );
}
