import LegalLayout from "@/components/LegalLayout";
import { NavSection } from "@/components/SidebarNav";

const sections: NavSection[] = [
  { id: "acceptance", label: "Acceptance of terms" },
  { id: "description", label: "Description of service" },
  { id: "eligibility", label: "Eligibility" },
  { id: "accounts", label: "Accounts & access" },
  { id: "school-obligations", label: "School obligations" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "data-ownership", label: "Data ownership" },
  { id: "intellectual-property", label: "Intellectual property" },
  { id: "payment", label: "Payment & billing" },
  { id: "availability", label: "Service availability" },
  { id: "termination", label: "Termination" },
  { id: "liability", label: "Limitation of liability" },
  { id: "changes", label: "Changes to terms" },
  { id: "contact", label: "Contact" },
];

const TermsOfService = () => {
  return (
    <>
      <title>Terms of Service | SchoolPulse ERP</title>
      <meta
        name="description"
        content="Read the Terms of Service for SchoolPulse ERP — the rules, obligations, and rights that govern your use of the platform."
      />

      <LegalLayout
        title="Terms of Service"
        subtitle="These terms govern your use of SchoolPulse ERP. By using the platform, your institution agrees to these terms. Please read them carefully."
        effectiveDate="April 23, 2026"
        sections={sections}
      >
        <section id="acceptance" className="legal-section">
          <h2 className="legal-section-heading">Acceptance of terms</h2>
          <p>
            By accessing or using SchoolPulse ERP (the "Platform"), the school
            institution ("School," "you," or "your") agrees to be bound by these
            Terms of Service ("Terms"). If you do not agree to these Terms, you
            must not use the Platform.
          </p>
          <p>
            These Terms constitute a legally binding agreement between your
            institution and SchoolPulse ERP ("we," "us," or "our"). Use of the
            Platform by any authorised user of your institution constitutes
            acceptance of these Terms on behalf of the institution.
          </p>
        </section>

        <section id="description" className="legal-section">
          <h2 className="legal-section-heading">Description of service</h2>
          <p>
            SchoolPulse ERP is a cloud-based school management platform designed
            to help educational institutions manage students, academics,
            attendance, fees, and administrative operations.
          </p>
          <p>
            The Platform is provided as a software-as-a-service (SaaS) product.
            Features may vary depending on your institution's subscription plan.
            We reserve the right to update, modify, or discontinue features with
            reasonable notice.
          </p>
        </section>

        <section id="eligibility" className="legal-section">
          <h2 className="legal-section-heading">Eligibility</h2>
          <p>
            The Platform is intended for use by registered educational
            institutions and their authorised staff. By using SchoolPulse ERP,
            you represent that:
          </p>
          <ul>
            <li>
              Your institution is a legally recognised educational body.
            </li>
            <li>
              Users granted access are employees, administrators, teachers, or
              other authorised personnel of your institution.
            </li>
            <li>
              You have the authority to bind your institution to these Terms.
            </li>
          </ul>
        </section>

        <section id="accounts" className="legal-section">
          <h2 className="legal-section-heading">Accounts &amp; access</h2>
          <p>
            Access to the Platform is provided through user accounts. Each
            account is tied to a specific role (administrator, teacher, student,
            parent) and must be managed by the school.
          </p>
          <p>
            Schools are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of all login credentials.</li>
            <li>
              Ensuring accounts are assigned to appropriate individuals with
              suitable roles.
            </li>
            <li>
              Promptly disabling access for users who are no longer authorised
              (e.g., when a teacher leaves the institution).
            </li>
          </ul>
          <p>
            You must notify us immediately if you suspect any unauthorised use
            of an account. We are not liable for losses resulting from
            unauthorised access caused by your failure to maintain account
            security.
          </p>
        </section>

        <section id="school-obligations" className="legal-section">
          <h2 className="legal-section-heading">School obligations</h2>
          <p>By using SchoolPulse ERP, your institution agrees to:</p>
          <ul>
            <li>
              Provide accurate and complete information when setting up and
              maintaining student, staff, and institutional records.
            </li>
            <li>
              Obtain all necessary consents, permissions, and authorisations
              required by applicable law before entering personal data of
              students, parents, and staff into the Platform.
            </li>
            <li>
              Use the Platform in compliance with all applicable laws,
              regulations, and educational guidelines.
            </li>
            <li>
              Not use the Platform to facilitate any unlawful activity.
            </li>
          </ul>
        </section>

        <section id="acceptable-use" className="legal-section">
          <h2 className="legal-section-heading">Acceptable use</h2>
          <p>You agree not to use SchoolPulse ERP to:</p>
          <ul>
            <li>
              Upload or transmit any data that is fraudulent, harmful, or
              violates anyone's rights.
            </li>
            <li>
              Attempt to gain unauthorised access to systems, data, or accounts
              that are not assigned to you.
            </li>
            <li>
              Interfere with, disrupt, or overload the Platform's infrastructure.
            </li>
            <li>
              Reverse-engineer, decompile, or attempt to extract the source code
              of the Platform.
            </li>
            <li>
              Use the Platform to compete with or replicate our services
              commercially.
            </li>
          </ul>
          <p>
            Violations of acceptable use may result in immediate suspension or
            termination of access.
          </p>
        </section>

        <section id="data-ownership" className="legal-section">
          <h2 className="legal-section-heading">Data ownership</h2>
          <p>
            All data entered into SchoolPulse ERP by a school — including student
            records, academic data, fee data, and operational data — remains the
            property of that school.
          </p>
          <p>
            We do not claim any ownership over your data. We store and process it
            solely to provide the service. You may request an export or deletion
            of your data at any time, subject to applicable legal constraints.
          </p>
          <p>
            By using the Platform, you grant us a limited licence to store,
            process, and transmit your data as necessary to provide and improve
            the service. This licence ends when your data is deleted from our
            systems.
          </p>
        </section>

        <section id="intellectual-property" className="legal-section">
          <h2 className="legal-section-heading">Intellectual property</h2>
          <p>
            SchoolPulse ERP, including its design, codebase, features, and brand,
            is owned exclusively by us and protected by applicable intellectual
            property laws.
          </p>
          <p>
            Your subscription grants you a limited, non-exclusive, non-transferable
            licence to use the Platform for your institution's internal
            operations. This does not grant you any rights to the underlying
            software, design systems, or proprietary technology.
          </p>
          <p>
            Any feedback, suggestions, or ideas you provide about the Platform
            may be used by us to improve the product without any obligation to
            you.
          </p>
        </section>

        <section id="payment" className="legal-section">
          <h2 className="legal-section-heading">Payment &amp; billing</h2>
          <p>
            Access to SchoolPulse ERP is subject to the subscription or pricing
            plan agreed upon at the time of onboarding. Continued use of the
            Platform constitutes agreement to those fees.
          </p>
          <p>
            Fees are due according to the billing cycle agreed with your
            institution. Failure to pay may result in suspension of access until
            outstanding amounts are cleared.
          </p>
          <p>
            We reserve the right to update pricing with reasonable advance notice.
            Continued use of the Platform after a pricing change constitutes
            acceptance of the new pricing.
          </p>
        </section>

        <section id="availability" className="legal-section">
          <h2 className="legal-section-heading">Service availability</h2>
          <p>
            We strive to keep SchoolPulse ERP available and reliable. However,
            we do not guarantee uninterrupted access.
          </p>
          <p>
            Scheduled maintenance, emergency fixes, or events outside our control
            (including third-party infrastructure issues) may result in temporary
            downtime. Where possible, we will provide advance notice of
            maintenance windows.
          </p>
          <p>
            The Platform is provided "as-is." We do not warrant that the service
            will be error-free or meet every specific requirement of your
            institution.
          </p>
        </section>

        <section id="termination" className="legal-section">
          <h2 className="legal-section-heading">Termination</h2>
          <p>
            Either party may terminate the use of SchoolPulse ERP by providing
            reasonable written notice as specified in your service agreement.
          </p>
          <p>
            We may suspend or terminate access immediately if:
          </p>
          <ul>
            <li>These Terms are materially violated.</li>
            <li>Required by law or legal process.</li>
            <li>Continued access poses a security risk to the Platform.</li>
          </ul>
          <p>
            Upon termination, your access to the Platform will cease. You may
            request a data export before termination. Data will be retained for a
            limited period post-termination in accordance with our data retention
            policy before being permanently deleted.
          </p>
        </section>

        <section id="liability" className="legal-section">
          <h2 className="legal-section-heading">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by applicable law, SchoolPulse ERP
            shall not be liable for any indirect, incidental, special, or
            consequential damages arising from the use of — or inability to use —
            the Platform.
          </p>
          <p>
            Our total liability in connection with the Platform shall not exceed
            the fees paid by your institution in the three months preceding the
            event giving rise to the claim.
          </p>
          <p>
            We are not responsible for any loss of data resulting from user
            error, improper use, or circumstances outside our reasonable control.
          </p>
        </section>

        <section id="changes" className="legal-section">
          <h2 className="legal-section-heading">Changes to these terms</h2>
          <p>
            We reserve the right to update these Terms as the Platform evolves.
            When changes are made, we will update the effective date above and,
            where appropriate, notify users through the Platform.
          </p>
          <p>
            Continued use of SchoolPulse ERP after an update to these Terms
            constitutes acceptance of the revised Terms. If your institution does
            not agree with updated Terms, you should stop using the Platform and
            request data export or deletion.
          </p>
        </section>

        <section id="contact" className="legal-section">
          <h2 className="legal-section-heading">Contact</h2>
          <p>
            If you have questions about these Terms or wish to discuss your
            institution's specific arrangement with SchoolPulse ERP, please
            reach out through the platform or contact your account
            representative directly.
          </p>
          <p>
            <strong>SchoolPulse ERP</strong> — built to help schools run better,
            on terms you can trust.
          </p>
        </section>
      </LegalLayout>
    </>
  );
};

export default TermsOfService;
