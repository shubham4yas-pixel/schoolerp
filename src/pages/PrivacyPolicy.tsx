import LegalLayout from "@/components/LegalLayout";
import { NavSection } from "@/components/SidebarNav";

const sections: NavSection[] = [
  { id: "commitment", label: "Our commitment" },
  { id: "data-existence", label: "How data exists inside SchoolPulse" },
  { id: "data-collection", label: "What data we collect" },
  { id: "data-usage", label: "Why we process this data" },
  { id: "data-control", label: "Who controls the data" },
  { id: "data-access", label: "When we access data" },
  { id: "data-sharing", label: "Data sharing" },
  { id: "data-security", label: "How we protect data" },
  { id: "retention", label: "Data retention" },
  { id: "responsibilities", label: "Responsibilities" },
  { id: "children", label: "Children's data" },
  { id: "policy-changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact" },
];

const PrivacyPolicy = () => {
  return (
    <>
      <title>Privacy Policy | SchoolPulse ERP</title>
      <meta
        name="description"
        content="Understand how SchoolPulse ERP collects, uses, and protects your school's data. Built for schools, not advertisers."
      />

      <LegalLayout
        title="Privacy Policy"
        subtitle="SchoolPulse ERP is built for schools, not advertisers. Your school owns its data — we exist to securely store and process it."
        effectiveDate="April 23, 2026"
        sections={sections}
      >
        <section id="commitment" className="legal-section">
          <h2 className="legal-section-heading">Our commitment to your data</h2>
          <p>
            SchoolPulse ERP is built for schools, not advertisers. That matters
            because the incentives are completely different.
          </p>
          <p>
            We do not build products to monetise data. We build tools that help
            schools run better. That means the data you trust us with is not a
            business asset to be exploited, but a responsibility to be handled
            carefully.
          </p>
          <p>
            At a basic level, our position is simple: your school owns its data,
            and we exist to securely store and process it so your institution can
            function efficiently.
          </p>
        </section>

        <section id="data-existence" className="legal-section">
          <h2 className="legal-section-heading">
            How data exists inside SchoolPulse
          </h2>
          <p>
            SchoolPulse is a multi-school platform where multiple institutions
            operate within a shared system. Even though the infrastructure is
            shared, the data is not.
          </p>
          <p>
            Every school's data is logically isolated. Users can only access
            information that belongs to their institution and that their role
            allows them to see. There is no mechanism in the product that allows
            one school to view another school's data.
          </p>
          <p>
            We enforce this separation at the system level, not just in the
            interface.
          </p>
        </section>

        <section id="data-collection" className="legal-section">
          <h2 className="legal-section-heading">What data we collect</h2>
          <p>
            We collect and process only the data required to operate a school
            ERP system.
          </p>
          <p>This typically includes:</p>
          <ul>
            <li>Student information and academic records</li>
            <li>Attendance data</li>
            <li>Fee and payment records</li>
            <li>
              Basic account details such as names, email addresses, and roles of
              authorised users
            </li>
            <li>
              Limited technical data such as device type, IP address, and usage
              logs to ensure the system works reliably
            </li>
          </ul>
          <p>
            We do not collect data that is unrelated to the functioning of the
            platform.
          </p>
        </section>

        <section id="data-usage" className="legal-section">
          <h2 className="legal-section-heading">Why we process this data</h2>
          <p>
            The data processed within SchoolPulse exists for one purpose: to
            enable schools to manage their operations.
          </p>
          <p>This includes:</p>
          <ul>
            <li>Maintaining student records</li>
            <li>Generating reports and tracking academic performance</li>
            <li>Managing fees and supporting administrative workflows</li>
          </ul>
          <p>
            We also use limited usage data to improve system performance, fix
            issues, and understand how features are being used so we can make
            the product better.
          </p>
          <p>
            We do not use this data for advertising, profiling, or any unrelated
            commercial activity.
          </p>
        </section>

        <section id="data-control" className="legal-section">
          <h2 className="legal-section-heading">Who controls the data</h2>
          <p>
            Schools are the primary controllers of their data. They decide what
            information is entered into the system, who has access to it, and
            how it is used within their institution.
          </p>
          <p>
            SchoolPulse acts only as a processor. We handle the data strictly to
            provide the service. We do not independently decide how that data
            should be used.
          </p>
          <p>
            If a school chooses to modify or delete its data, that decision
            remains with the institution.
          </p>
        </section>

        <section id="data-access" className="legal-section">
          <h2 className="legal-section-heading">When we access data</h2>
          <p>
            We do not access school data as part of normal operations.
          </p>
          <p>
            Access is limited to situations where it is necessary, such as
            resolving a technical issue, investigating a bug, or responding to a
            direct request from the school. Even in those cases, access is
            restricted and handled carefully.
          </p>
          <p>
            We do not monitor or review data for any other purpose.
          </p>
        </section>

        <section id="data-sharing" className="legal-section">
          <h2 className="legal-section-heading">Data sharing</h2>
          <p>We do not sell, rent, or trade data.</p>
          <p>
            In limited cases, data may be processed by trusted service providers
            who help us operate the platform, such as cloud infrastructure or
            payment systems. These providers are bound by strict confidentiality
            and are only allowed to process data as required to deliver their
            service.
          </p>
          <p>
            Data may also be disclosed if required by law or legal process.
            Outside of these cases, data remains within the control of the
            school and the platform.
          </p>
        </section>

        <section id="data-security" className="legal-section">
          <h2 className="legal-section-heading">How we protect data</h2>
          <p>
            We use industry-standard security practices to protect data stored
            within SchoolPulse.
          </p>
          <p>This includes:</p>
          <ul>
            <li>Secure infrastructure</li>
            <li>Encrypted data transmission</li>
            <li>Controlled access mechanisms</li>
            <li>Continuous monitoring for potential risks</li>
          </ul>
          <p>
            Access to data is governed by authentication and role-based
            permissions.
          </p>
          <p>
            No system can guarantee absolute security, but we design our systems
            to minimise risk and respond quickly if something goes wrong.
          </p>
        </section>

        <section id="retention" className="legal-section">
          <h2 className="legal-section-heading">How long we retain data</h2>
          <p>
            We retain data for as long as a school continues to use SchoolPulse.
          </p>
          <p>
            If a school chooses to stop using the platform, data may be deleted
            or retained for a limited period depending on operational and legal
            requirements. Schools may request export or deletion of their data.
          </p>
        </section>

        <section id="responsibilities" className="legal-section">
          <h2 className="legal-section-heading">
            Responsibility of schools and users
          </h2>
          <p>
            Schools are responsible for managing access within their institution.
            This includes assigning roles correctly, maintaining secure login
            credentials, and ensuring that the data entered into the system is
            accurate and lawful.
          </p>
          <p>
            Users should treat their login access as sensitive and avoid sharing
            credentials.
          </p>
        </section>

        <section id="children" className="legal-section">
          <h2 className="legal-section-heading">Children's data</h2>
          <p>
            SchoolPulse processes student data as part of school operations. This
            data is provided and controlled by the school.
          </p>
          <p>
            We rely on schools to ensure that they have obtained any necessary
            permissions or consents required under applicable laws when handling
            student information.
          </p>
        </section>

        <section id="policy-changes" className="legal-section">
          <h2 className="legal-section-heading">Changes to this policy</h2>
          <p>
            As the product evolves, this policy may be updated. When that
            happens, we will update the effective date and, where appropriate,
            notify users through the platform.
          </p>
          <p>
            Continued use of the system after changes means the updated policy
            is accepted.
          </p>
        </section>

        <section id="contact" className="legal-section">
          <h2 className="legal-section-heading">Contact</h2>
          <p>
            If you have questions about how data is handled in SchoolPulse ERP,
            please reach out to us directly through the platform or contact your
            account representative.
          </p>
          <p>
            <strong>SchoolPulse ERP</strong> is built on a simple principle:
            school data should remain private, controlled, and used only for the
            purpose it was created for.
          </p>
        </section>
      </LegalLayout>
    </>
  );
};

export default PrivacyPolicy;
