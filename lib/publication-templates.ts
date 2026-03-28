import type { OwnerOption } from "@/lib/ops-utils";

export type PublicationTemplateDefinition = {
  title: string;
  defaultOwner: OwnerOption;
};

export const PUBLICATION_TEMPLATES = {
  Newsbrief: [
    { title: "New Members", defaultOwner: "Melissa" },
    { title: "Monthly CEO Briefing", defaultOwner: "Crystelle" },
    { title: "Upcoming Events", defaultOwner: "Melissa" },
    { title: "Follow-up Content", defaultOwner: "Melissa" },
    { title: "Member Feedback in Action", defaultOwner: "Melissa" },
    { title: "CAPMA Caught in the Community", defaultOwner: "Crystelle" },
    { title: "Scholarship Promo", defaultOwner: "Crystelle" },
    { title: "Member Survey", defaultOwner: "Melissa" },
    { title: "CAPMA Classifieds", defaultOwner: "Crystelle" },
    { title: "Preferred Partners", defaultOwner: "Melissa" },
    { title: "Good To Know", defaultOwner: "Crystelle" },
    { title: "District Meetings", defaultOwner: "Melissa" },
    { title: "From the Voice", defaultOwner: "Melissa" },
    { title: "Staff Contact", defaultOwner: "Melissa" }
  ],
  "The Voice": [
    { title: "Message from the President", defaultOwner: "Sitting President" },
    { title: "Message from the CEO", defaultOwner: "Crystelle" },
    { title: "State Legislative Report", defaultOwner: "Governmental Affairs Chair" },
    { title: "Insurance Report", defaultOwner: "External / TBD" },
    { title: "Educational Article", defaultOwner: "Melissa" },
    { title: "Your Member Benefits Explained", defaultOwner: "Melissa" },
    { title: "From the CAPMA Archives", defaultOwner: "Melissa" },
    { title: "Center Spread", defaultOwner: "Melissa" },
    { title: "Event Follow Up", defaultOwner: "Melissa" },
    { title: "Committee Spotlight", defaultOwner: "Melissa" },
    { title: "Member Profile", defaultOwner: "Melissa" },
    { title: "CAPMA in the Community", defaultOwner: "Melissa" },
    { title: "Staff Contact", defaultOwner: "Melissa" },
    { title: "BOD Nominations", defaultOwner: "Crystelle" }
  ]
} as const satisfies Record<string, readonly PublicationTemplateDefinition[]>;

export type PublicationTemplateWorkstream = keyof typeof PUBLICATION_TEMPLATES;

export function getPublicationTemplates(workstream: string) {
  if (workstream === "Newsbrief" || workstream === "The Voice") {
    return [...PUBLICATION_TEMPLATES[workstream]];
  }

  return [];
}

export function getPublicationTemplateTitles(workstream: string) {
  return getPublicationTemplates(workstream).map((template) => template.title);
}
