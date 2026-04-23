import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import SidebarNav, { NavSection } from "./SidebarNav";
import "./LegalLayout.css";

interface LegalLayoutProps {
  title: string;
  subtitle?: string;
  effectiveDate?: string;
  sections: NavSection[];
  children: ReactNode;
  metaDescription?: string;
}

const LegalLayout = ({
  title,
  subtitle,
  effectiveDate,
  sections,
  children,
}: LegalLayoutProps) => {
  return (
    <div className="legal-root">
      {/* Top header — standalone, not pulling from AuthContext */}
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/" className="legal-logo" aria-label="SchoolPulse home">
            <div className="legal-logo-icon">
              <BookOpen size={18} strokeWidth={2.2} />
            </div>
            <span className="legal-logo-text">SchoolPulse</span>
          </Link>

          <nav className="legal-header-links" aria-label="Legal pages">
            <Link to="/privacy-policy" className="legal-header-link">
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="legal-header-link">
              Terms of Service
            </Link>
          </nav>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="legal-page-wrapper">
        {/* Left sticky sidebar */}
        <aside className="legal-sidebar-col">
          <div className="legal-sidebar-sticky">
            <SidebarNav sections={sections} />
          </div>
        </aside>

        {/* Right content column */}
        <main className="legal-content-col">
          <div className="legal-content-header">
            <h1 className="legal-page-title">{title}</h1>
            {subtitle && <p className="legal-page-subtitle">{subtitle}</p>}
            {effectiveDate && (
              <p className="legal-effective-date">
                <span className="legal-effective-label">Effective date:</span>{" "}
                {effectiveDate}
              </p>
            )}
          </div>

          <div className="legal-sections">{children}</div>

          {/* Footer row inside content */}
          <footer className="legal-content-footer">
            <p>© {new Date().getFullYear()} SchoolPulse ERP. All rights reserved.</p>
            <div className="legal-footer-links">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/terms-of-service">Terms of Service</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default LegalLayout;
