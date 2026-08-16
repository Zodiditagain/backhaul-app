import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Backhaul",
};

export default function TermsOfServicePage() {
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
          <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
        </div>

        <p className="text-xs text-gray-500 mb-8">Last updated: August 16, 2026</p>

        <div className="space-y-7 text-sm text-gray-300 leading-relaxed">
          <Section title="1. Agreement to these Terms">
            <p>
              These Terms of Service ("Terms") govern your access to and use of Backhaul,
              operated by{" "}
              <span className="text-gray-500">[Legal Entity Name, e.g. "Backhaul LLC, a [State] limited liability company"]</span>{" "}
              ("Backhaul," "we," "us," or "our"), including the website at joinbackhaul.com and
              any related applications (collectively, the "Service"). By creating an account or
              using the Service, you agree to these Terms. If you do not agree, do not use the
              Service.
            </p>
          </Section>

          <Section title="2. What Backhaul is — and isn't">
            <p>
              Backhaul is a technology platform that helps trucking companies, freight brokers,
              and vendors find and communicate with each other regarding backhaul opportunities,
              lanes, equipment, and availability. Backhaul is a matching and communication
              platform only.{" "}
              <span className="text-gray-200">
                Backhaul is not a motor carrier, freight broker, shipper, or party to any
                shipment, rate agreement, or contract of carriage between users.
              </span>{" "}
              We do not arrange transportation, take possession of freight, guarantee any load,
              rate, or match, or verify the accuracy of information users provide (including DOT
              or MC numbers, insurance coverage, or shipment details). Any agreement to transport
              freight, any rate negotiated, and any resulting contract is solely between the users
              involved.
            </p>
          </Section>

          <Section title="3. Eligibility and accounts">
            <p className="mb-2">
              You must be at least 18 years old and able to form a binding contract to use the
              Service. You represent that any operating authority, licensing, insurance, and
              equipment information you provide is accurate and that you are authorized to act on
              behalf of the company you represent.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials
              and for all activity that occurs under your account. Notify us promptly at{" "}
              <span className="text-blue-400">legal@joinbackhaul.com</span> if you suspect
              unauthorized use of your account.
            </p>
          </Section>

          <Section title="4. Subscriptions and billing">
            <p className="mb-2">
              Certain features (such as Route Map and Market Pulse) require a paid subscription,
              billed on a recurring monthly or yearly basis through Stripe. Subscriptions may
              include a free trial period; if you do not cancel before the trial ends and a
              payment method is on file, you will be charged for the plan you selected. If no
              payment method is added, trial subscriptions are automatically canceled at the end
              of the trial.
            </p>
            <p className="mb-2">
              You can cancel your subscription at any time; cancellation takes effect at the end
              of the current billing period unless otherwise stated. Except where required by law,
              fees are non-refundable.
            </p>
            <p>
              We may change subscription pricing on a going-forward basis with reasonable notice.
            </p>
          </Section>

          <Section title="5. User content and conduct">
            <p className="mb-2">
              You are solely responsible for the accuracy of information you submit to the
              Service, including profile details, Bills of Lading, shipment and rate information,
              messages, and reviews ("User Content"). By submitting User Content, you grant
              Backhaul a license to use, host, and display it as necessary to operate the Service,
              including using anonymized, aggregated shipment data to power features like Market
              Pulse rate estimates.
            </p>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Submit false, misleading, or fraudulent information, including fake availability, ratings, or rate data;</li>
              <li>Use the Service to harass, defraud, or discriminate against other users;</li>
              <li>Misrepresent your operating authority, insurance, or identity;</li>
              <li>Attempt to interfere with, disrupt, or reverse-engineer the Service;</li>
              <li>Use the Service for any purpose that violates applicable law, including federal motor carrier regulations.</li>
            </ul>
          </Section>

          <Section title="6. Relationship between users">
            <p>
              Any negotiation, rate agreement, contract of carriage, load tender, or dispute
              between a trucker, broker, or vendor arising from use of the Service is solely
              between those users.{" "}
              <span className="text-gray-200">
                Backhaul is not responsible for, and does not mediate, disputes over payment,
                cargo condition, delays, cancellations, insurance claims, or any other matter
                arising from a shipment or agreement between users.
              </span>{" "}
              Users are responsible for independently verifying counterparties' operating
              authority, insurance, and standing before entering into any agreement.
            </p>
          </Section>

          <Section title="7. Location and navigation features">
            <p>
              Route Map provides truck-legal routing and turn-by-turn navigation based on data
              from third-party mapping providers and truck specifications you provide.{" "}
              <span className="text-gray-200">
                Routing and navigation guidance is provided for informational purposes only.
              </span>{" "}
              You are solely responsible for operating your vehicle safely, obeying all traffic
              laws and posted signage, and independently verifying that any route is safe and
              legal for your vehicle, regardless of what the Service displays.
            </p>
          </Section>

          <Section title="8. Market Pulse rate data">
            <p>
              Market Pulse rate estimates — including figures not marked "Live" — are
              illustrative estimates intended to assist negotiation and are not a guarantee of any
              achievable rate, a rate quote, or a booking commitment. "Live" figures reflect
              anonymized averages from a minimum number of completed loads on the Service, but
              past rates do not guarantee future rates. You should not rely solely on Market Pulse
              data in making business decisions.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p className="uppercase text-xs tracking-wide text-gray-500 mb-2">
              To the maximum extent permitted by law:
            </p>
            <p>
              The Service is provided "as is" and "as available," without warranties of any kind,
              express or implied, including warranties of merchantability, fitness for a
              particular purpose, and non-infringement. We do not warrant that the Service will be
              uninterrupted, error-free, or secure, or that any match, rate, or routing information
              will be accurate or complete.
            </p>
          </Section>

          <Section title="10. Limitation of liability">
            <p>
              To the maximum extent permitted by law, Backhaul and its officers, employees, and
              affiliates will not be liable for any indirect, incidental, special, consequential,
              or punitive damages, or any loss of profits, revenue, freight, or business, arising
              from your use of the Service or any transaction or dispute between users. Our total
              liability for any claim arising from the Service will not exceed the amount you paid
              us in the twelve months before the claim arose.
            </p>
          </Section>

          <Section title="11. Indemnification">
            <p>
              You agree to indemnify and hold Backhaul harmless from any claims, damages, losses,
              and expenses (including reasonable attorneys' fees) arising from your use of the
              Service, your User Content, your violation of these Terms, or your dealings with
              other users.
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              You may stop using the Service and close your account at any time. We may suspend or
              terminate your access to the Service if we reasonably believe you have violated
              these Terms, engaged in fraudulent or unsafe conduct, or for any other reason with
              reasonable notice where practicable.
            </p>
          </Section>

          <Section title="13. Governing law and disputes">
            <p>
              These Terms are governed by the laws of{" "}
              <span className="text-gray-500">[State]</span>, without regard to conflict-of-law
              principles. Any dispute arising from these Terms or the Service will be resolved in
              the state or federal courts located in{" "}
              <span className="text-gray-500">[County/State]</span>, and you consent to
              jurisdiction there.
            </p>
          </Section>

          <Section title="14. Changes to these Terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we will
              update the "Last updated" date above and, where appropriate, provide additional
              notice. Continued use of the Service after changes take effect constitutes
              acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              Questions about these Terms can be sent to{" "}
              <span className="text-blue-400">legal@joinbackhaul.com</span>.
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
