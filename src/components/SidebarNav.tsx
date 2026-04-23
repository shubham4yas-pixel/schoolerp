import { useEffect, useState } from "react";

export interface NavSection {
  id: string;
  label: string;
}

interface SidebarNavProps {
  sections: NavSection[];
  title?: string;
}

const SidebarNav = ({ sections, title = "On this page" }: SidebarNavProps) => {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const observerCallback = (
      entries: IntersectionObserverEntry[],
      sectionId: string
    ) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(sectionId);
        }
      });
    };

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        (entries) => observerCallback(entries, id),
        {
          rootMargin: "-20% 0px -70% 0px",
          threshold: 0,
        }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [sections]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveId(id);
  };

  return (
    <nav className="legal-sidebar" aria-label="Page sections">
      <p className="legal-sidebar-title">{title}</p>
      <ul className="legal-sidebar-list">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <button
              onClick={() => scrollTo(id)}
              aria-current={activeId === id ? "location" : undefined}
              className={`legal-sidebar-link${activeId === id ? " active" : ""}`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SidebarNav;
