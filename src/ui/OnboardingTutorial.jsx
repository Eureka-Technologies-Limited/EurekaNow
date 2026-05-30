import { useState } from "react";
import { useTokens, useBreakpoint } from "../core/hooks.js";
import { Btn } from "./primitives.jsx";
import { I } from "../core/icons.jsx";

const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to EurekaNow",
    subtitle: "Let's get you started",
    description: "This quick tutorial will show you the key features of the platform. You can skip it anytime.",
    icon: "grid",
    image: null,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    subtitle: "Your command center",
    description: "The Dashboard gives you a quick overview of all your tickets, SLA status, recent activity, and team performance. You can customize the layout to show the metrics that matter most to you.",
    icon: "grid",
    tips: ["Pin your favorite widgets", "Drag to rearrange", "Click 'Customize' to change layout"],
  },
  {
    id: "tickets",
    title: "Tickets & Incidents",
    subtitle: "Track all your work",
    description: "Create and manage Incidents (urgent issues), Requests (service requests), Changes, Problems, and Tasks. Each ticket has a priority, SLA, assignee, and status that you can track.",
    icon: "incident",
    tips: ["Click 'New Ticket' to create", "Filter by status, priority, or assignee", "Click a ticket to view full details"],
  },
  {
    id: "approvals",
    title: "Approvals & Workflows",
    subtitle: "Streamline decision-making",
    description: "Some service requests require approval before they're fulfilled. Use the Approvals view to review pending requests and make decisions. Approvals can be role-based, assigned to a specific person, or require team consensus.",
    icon: "check",
    tips: ["Review pending approvals", "Approve or reject with comments", "Set up approval workflows in Settings"],
  },
  {
    id: "catalog",
    title: "Service Catalog",
    subtitle: "Standardized requests",
    description: "The Service Catalog contains pre-configured request templates for common tasks like software access or equipment requests. End users can browse and submit requests from the catalog with all the right fields pre-filled.",
    icon: "request",
    tips: ["Browse available services", "Click 'Request' to submit", "Manage catalog items in Teams Settings"],
  },
  {
    id: "kb",
    title: "Knowledge Base",
    subtitle: "Self-service support",
    description: "Create and share articles to help users resolve issues independently. Organize articles by category and make them searchable so your team can find answers quickly.",
    icon: "book",
    tips: ["Search for solutions", "Create articles for common issues", "Track article views to see what's helpful"],
  },
  {
    id: "teams",
    title: "Teams & Permissions",
    subtitle: "Organize your organization",
    description: "Manage team members, set role-based permissions, configure approval chains, and customize team-specific settings. You can also set up custom roles and permissions at the organization level.",
    icon: "users",
    tips: ["Add team members", "Assign roles and permissions", "Configure team approval workflows"],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    subtitle: "Monitor performance",
    description: "Track your team's performance with real-time reports showing incident resolution times, SLA compliance, request volumes, and team activity trends.",
    icon: "chart",
    tips: ["View SLA compliance rates", "Track incident trends", "Export data for analysis"],
  },
  {
    id: "complete",
    title: "You're all set!",
    subtitle: "Ready to get started",
    description: "You're now ready to use EurekaNow. Start by exploring the Dashboard, creating your first ticket, or checking out the Service Catalog.",
    icon: "check",
    image: "complete",
  },
];

const TUTORIAL_COMPLETED_KEY = (userId) => `tutorial_completed_${userId || "global"}`;

export function useOnboardingStatus(userId) {
  const isCompleted = () => {
    try {
      return localStorage.getItem(TUTORIAL_COMPLETED_KEY(userId)) === "true";
    } catch {
      return false;
    }
  };

  const markCompleted = () => {
    try {
      localStorage.setItem(TUTORIAL_COMPLETED_KEY(userId), "true");
    } catch {}
  };

  return { isCompleted, markCompleted };
}

export function OnboardingTutorial({ userId, onClose }) {
  const t = useTokens();
  const { isMobile } = useBreakpoint();
  const [currentStep, setCurrentStep] = useState(0);
  const { markCompleted } = useOnboardingStatus(userId);

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      markCompleted();
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    markCompleted();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.60)",
        zIndex: 999,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
      onClick={(e) => e.target === e.currentTarget && handleSkip()}
    >
      <div
        style={{
          background: t.surface,
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          padding: isMobile ? "24px 16px 32px" : "40px 48px",
          maxWidth: isMobile ? "100%" : 540,
          width: isMobile ? "100%" : "auto",
          maxHeight: isMobile ? "85vh" : "auto",
          overflowY: isMobile ? "auto" : "visible",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Step counter */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </div>
          <button
            onClick={handleSkip}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: t.text3,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 2,
            background: t.surface2,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: t.accent,
              width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%`,
              transition: "width 200ms ease-out",
            }}
          />
        </div>

        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: t.accentBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.accent,
            fontSize: 28,
          }}
        >
          <I name={step.icon} size={28} />
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>{step.title}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text3 }}>{step.subtitle}</div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: t.text2 }}>{step.description}</div>

          {step.tips && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>
                💡 Pro Tips
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {step.tips.map((tip, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: t.text2, lineHeight: 1.5 }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            flexDirection: isMobile ? "column-reverse" : "row",
          }}
        >
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {currentStep > 0 && (
              <Btn
                variant="secondary"
                onClick={handlePrev}
                style={{ flex: 1 }}
              >
                ← Back
              </Btn>
            )}
            <Btn
              variant="ghost"
              onClick={handleSkip}
              style={{ flex: 1 }}
            >
              Skip Tutorial
            </Btn>
          </div>
          <Btn variant="primary" onClick={handleNext} style={{ flex: 1 }}>
            {isLastStep ? "Get Started" : "Next →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
