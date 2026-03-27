export const PUBLICATION_TEMPLATES = {
  Newsbrief: [
    "New Members",
    "Monthly CEO Briefing",
    "Upcoming Events",
    "Follow-up Content",
    "Member Feedback in Action",
    "CAPMA Caught in the Community",
    "Scholarship Promo",
    "Member Survey",
    "CAPMA Classifieds",
    "Preferred Partners",
    "Good To Know",
    "District Meetings",
    "From the Voice",
    "Staff Contact"
  ],
  "The Voice": [
    "Message from the President",
    "Message from the CEO",
    "State Legislative Report",
    "Insurance Report",
    "Educational Article",
    "Your Member Benefits Explained",
    "From the CAPMA Archives",
    "Center Spread",
    "Event Follow Up",
    "Committee Spotlight",
    "Member Profile",
    "CAPMA in the Community",
    "Staff Contact",
    "BOD Nominations"
  ]
} as const;

export type PublicationTemplateWorkstream = keyof typeof PUBLICATION_TEMPLATES;

export function getPublicationTemplateTitles(workstream: string) {
  if (workstream === "Newsbrief" || workstream === "The Voice") {
    return [...PUBLICATION_TEMPLATES[workstream]];
  }

  return [];
}
