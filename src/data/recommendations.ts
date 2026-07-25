export type Horizon = "short" | "medium" | "long";

export type Action = {
  id: string;
  text: string;
  horizon: Horizon;
  pillarId: number;
};

export type Pillar = {
  id: number;
  title: string;
  short: string;
  slug: string;
  icon: string;
  policyIssue: string;
  objective: string;
  challenges: string[];
  actions: { horizon: Horizon; text: string }[];
};

export const HORIZONS: Record<Horizon, { label: string; range: string; blurb: string }> = {
  short: {
    label: "Short Term",
    range: "1–3 years",
    blurb: "Foundations — guidelines, awareness, curriculum and coordination.",
  },
  medium: {
    label: "Medium Term",
    range: "4–6 years",
    blurb: "Build-out — funding, infrastructure, partnerships and pilots.",
  },
  long: {
    label: "Long Term",
    range: "7–10 years",
    blurb: "Institutionalisation — authorities, standards and global positioning.",
  },
};

export const VISION =
  "To empower Jamaica's sustainable economic development through ethical A.I. innovation, enhanced public engagement and cultural preservation, while ensuring fairness, privacy and security.";

export const PILLARS: Pillar[] = [
  {
    id: 1,
    title: "A.I. for Innovation & Economic Growth",
    short: "Innovation & Growth",
    slug: "innovation-economic-growth",
    icon: "M3 17l6-6 4 4 8-8M21 7v5h-5",
    policyIssue:
      "A.I. has the potential to enhance productivity, reduce costs, and open new markets. However, there is a gap between the technological advancements in A.I. and the readiness of Jamaican businesses to leverage these tools for innovation. In spite of the rapid development of A.I. technologies and apparent step changes in capabilities, they require careful fine-tuning in order to be productively deployed with commercial impact. This presents an opportunity to create innovative AI-based high-value products and services for both local and global markets; but grasping that opportunity at a national scale will require significant investment in R&D in AI-related fields.",
    objective:
      "Leverage A.I. research to spur industry innovation and the creation of more sophisticated value chains.",
    challenges: [
      "Limited access to A.I. knowledge and expertise.",
      "Inadequate funding and support for startups and A.I. research.",
      "Limited integration of A.I. in traditional industries like agriculture, manufacturing, and tourism.",
      "Limited awareness of how A.I. use could improve existing business operations, causing a depressed demand for the development of A.I. tools and services.",
      "Relying heavily on foreign A.I. models and technologies exposes Jamaica to economic vulnerability, data privacy risks, and limits on customization to local needs.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Create the ecosystem, through collaboration with universities, to support the virtual and eventual physical establishment of A.I. hubs and tech parks in a bid to support AI-driven startups.",
      },
      {
        horizon: "short",
        text: "Create fora and other spaces for interactions between organisations that are willing to fund the development of A.I. solutions to their problems, and the entities that have the capacity to create those solutions.",
      },
      {
        horizon: "short",
        text: "Increase awareness of the role of intellectual property protection in scaling startups.",
      },
      {
        horizon: "short",
        text: "Update all industry policies and strategies to facilitate A.I. adoption in the private sector.",
      },
      {
        horizon: "medium",
        text: "Introduce government grants, venture capital incentives, and public-private partnerships (PPPs) to fund A.I. research and innovation.",
      },
      {
        horizon: "medium",
        text: "Develop incentive programmes, including tax breaks and grants, to encourage private sector investment in A.I. innovation.",
      },
      {
        horizon: "long",
        text: "Develop AI-centred industrial policies encouraging traditional industries to adopt AI, aiming to make Jamaica a regional A.I. innovation hub by 2035.",
      },
    ],
  },
  {
    id: 2,
    title: "Education and Workforce Development",
    short: "Education & Workforce",
    slug: "education-workforce",
    icon: "M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5",
    policyIssue:
      "Within education, generative A.I. technologies have already disrupted traditional assessment methodologies as they push the boundaries of academic integrity and challenge teaching objectives; for example, allowing students to produce perfect answers without engaging with the educational material. However, A.I. competencies can be beneficial in the workforce, providing a productivity boost in diverse sectors. While some jobs will be automated, new roles will emerge requiring specialized A.I. knowledge. Jamaica's education system must find ways to build competences in A.I. literacy for both teachers and students alike, without compromising the validity of student assessment, and to equip the workforce with the necessary A.I. and STEAM (Science, Technology, Engineering, Arts, Mathematics) skills to be competitive in the global economy.",
    objective: "Prepare Jamaicans to integrate into an AI-enabled global workforce.",
    challenges: [
      "Insufficient AI-related curricula in secondary and tertiary education.",
      "Effecting change in curricula in a dynamic, technological environment is slow and lengthy, resulting in curricula not necessarily being adequately responsive to training needs.",
      "Lack of vocational training programmes in A.I. and related fields.",
      "Inadequate teacher training to effectively deliver A.I. education.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Integrate A.I. and coding into the national curriculum at all education levels.",
      },
      {
        horizon: "short",
        text: "Launch teacher training programmes focused on responsible A.I. use and effective assessments.",
      },
      {
        horizon: "medium",
        text: "Establish specialized A.I. vocational and professional development courses in collaboration with local and international institutions.",
      },
      {
        horizon: "long",
        text: "Develop partnerships with global tech companies to establish A.I. centres of excellence, fostering research, internships, and continuous education in A.I. technologies.",
      },
    ],
  },
  {
    id: 3,
    title: "Public Awareness and Sensitization",
    short: "Public Awareness",
    slug: "public-awareness",
    icon: "M3 11v2a1 1 0 001 1h3l5 4V6L7 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8",
    policyIssue:
      "Public understanding of A.I. is critical to ensuring its acceptance and integration. However, there is limited awareness among the general population about AI, its benefits, and potential risks. Without adequate sensitization, misconceptions about A.I. could hinder its adoption and create resistance, particularly in sectors like healthcare, finance, and public services. Furthermore, the less informed our population is, the more susceptible they will be to AI-driven misinformation and disinformation. In contrast, attaining this awareness is likely to lead to new cultural expressions that incorporate A.I. technologies, with potential for global influence and commerce.",
    objective: "Ensure Jamaicans understand, adopt and can take advantage of the benefits of A.I.",
    challenges: [
      "Low public awareness of A.I.'s potential and risks.",
      "Limited communication between policymakers, technologists, and the public.",
      "Potential public fear regarding A.I.'s impact on employment and privacy.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Develop a programme on Digital Media and Information Literacy including A.I.'s benefits, challenges, ethical considerations and responsible use of A.I.",
      },
      {
        horizon: "medium",
        text: "Organize public consultations, workshops, and town halls to educate citizens about A.I. and address concerns directly.",
      },
    ],
  },
  {
    id: 4,
    title: "A.I. Infrastructure and Technology",
    short: "Infrastructure",
    slug: "infrastructure-technology",
    icon: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
    policyIssue:
      "For A.I. to thrive, a robust digital infrastructure is essential. Jamaica must modernize its ICT infrastructure, including high-speed internet, data centres, and cloud computing services, to support A.I. development and deployment. On the other hand, not all of these infrastructural components are simultaneously required for every A.I. innovation. Jamaica needs to be strategic in its priorities for funding these infrastructural components, because the costs of energy and cloud usage can be crippling if not managed well. Additionally, access to high-quality data is a key component in building A.I. systems, and data management policies need to be established to address this.",
    objective: "Expedite the creation of infrastructure to support A.I. adoption and expansion in Jamaica.",
    challenges: [
      "Insufficient digital infrastructure, particularly in rural areas.",
      "Limited access to cloud computing resources and data storage facilities.",
      "Absence of national data management frameworks to support A.I. development.",
      "Cost of energy.",
      "Negative environmental impacts.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Improve broadband coverage and speed across Jamaica, prioritizing underserved areas.",
      },
      {
        horizon: "short",
        text: "Incentivize developer level access to cloud-based A.I.-based services.",
      },
      {
        horizon: "medium",
        text: "Establish national A.I. data centres and cloud infrastructure with the support of international partners.",
      },
      {
        horizon: "long",
        text: "Develop a national data management policy that ensures secure and ethical data sharing while fostering A.I. research and innovation.",
      },
    ],
  },
  {
    id: 5,
    title: "International Cooperation in A.I.",
    short: "International Cooperation",
    slug: "international-cooperation",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
    policyIssue:
      "A.I. development requires international cooperation to exchange knowledge, share resources, and align on global ethical standards. Jamaica must build strategic alliances with global A.I. leaders and participate in international forums that shape A.I. policies and regulations. Jamaica must also protect its cultural assets from being diluted or subverted by A.I. products developed elsewhere.",
    objective:
      "Establish and maintain global partnerships that can be leveraged to ensure Jamaica's global and regional positioning.",
    challenges: [
      "Limited participation in global A.I. initiatives.",
      "Absence of bilateral and multilateral agreements on A.I. cooperation.",
      "Need for alignment with international A.I. ethical standards.",
      "Negligible local presence of multinational firms on the cutting edge of A.I.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Join global A.I. organizations and networks to exchange knowledge and best practices.",
      },
      {
        horizon: "medium",
        text: "Establish A.I. cooperation agreements with leading A.I. nations as well as countries with aligned views and interests, focusing on knowledge transfer and capacity building.",
      },
      {
        horizon: "medium",
        text: "Incentivize multinational technology firms to establish a presence in Jamaica, thereby increasing technology transfer.",
      },
      {
        horizon: "long",
        text: "Position Jamaica as a key player in regional and global A.I. policy discussions by hosting A.I. summits and actively contributing to international A.I. frameworks.",
      },
    ],
  },
  {
    id: 6,
    title: "Legal & Regulatory Frameworks for A.I.",
    short: "Legal & Regulatory",
    slug: "legal-regulatory",
    icon: "M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z",
    policyIssue:
      "A.I. raises new legal and regulatory challenges, particularly around data privacy, security, intellectual property and ethical use. Jamaica lacks a comprehensive regulatory framework to address these challenges, potentially slowing down A.I. adoption and raising concerns about A.I.'s impact on human rights.",
    objective:
      "Strengthen Jamaica's legal and regulatory framework to guide and grow ethical A.I. practices in Jamaica.",
    challenges: [
      "Lack of AI-specific regulations addressing data privacy, security, and ethical concerns.",
      "Potential risks of A.I. misuse in surveillance, decision-making, and data handling.",
      "Uncertainty about liability in cases of AI-driven errors or bias.",
      "Slow resolution of intellectual property litigation.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Develop interim guidelines for A.I. ethics and data privacy, ensuring A.I. applications comply with existing data protection laws.",
      },
      {
        horizon: "short",
        text: "Ensure that the legal system is equipped to deal fairly and expeditiously with disputes, particularly around intellectual property.",
      },
      {
        horizon: "short",
        text: "Implement new and/or review existing legislation to facilitate the use of A.I.",
      },
      {
        horizon: "medium",
        text: "Create a national A.I. regulatory framework addressing issues such as A.I. liability, bias, and transparency.",
      },
      {
        horizon: "long",
        text: "Establish a national A.I. regulatory authority responsible for monitoring A.I. development, enforcing ethical standards, and ensuring compliance with international best practices.",
      },
    ],
  },
  {
    id: 7,
    title: "Government and Industry Collaboration",
    short: "Gov & Industry",
    slug: "government-industry",
    icon: "M9 12a3 3 0 100-6 3 3 0 000 6zM17 12a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.7-5 6-5s6 2 6 5M15 20c0-3 2-5 5-5",
    policyIssue:
      "Collaboration between government and industry is crucial for A.I.'s successful adoption and integration. However, there is a need for a structured approach to facilitate effective partnerships, ensure government support for industry-driven A.I. initiatives, and create a favourable business environment for A.I. companies.",
    objective:
      "Create avenues for partnership between, and among, government and private sector to better monitor impact and needs for greater A.I. integration.",
    challenges: [
      "Lack of coordination between government agencies and the private sector in A.I. initiatives.",
      "Insufficient incentives for industry players to invest in A.I.",
      "Limited public-private partnerships (PPPs) focused on A.I. research and development.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Establish a National A.I. Policy Oversight and Implementation Committee comprising public sector, private sector and civil society representatives to drive collaboration, policy alignment and implementation.",
      },
      {
        horizon: "short",
        text: "Define Government services that would benefit from A.I. use, and use these to seed initial local development in A.I.",
      },
      {
        horizon: "short",
        text: "Recommend that A.I. solutions for the Government be built in ways that can be resold / reused in private companies.",
      },
      {
        horizon: "short",
        text: "Encourage that A.I. solutions are open-source to be used for public good.",
      },
      {
        horizon: "short",
        text: "Incentivize private capital by giving early corporate participants privileged access to those solutions.",
      },
      {
        horizon: "medium",
        text: "Foster government-industry partnerships to co-develop A.I. technologies and applications across key sectors like healthcare, finance, and agriculture.",
      },
    ],
  },
  {
    id: 8,
    title: "Ethical Foundations of A.I.",
    short: "Ethical Foundations",
    slug: "ethical-foundations",
    icon: "M12 21s-7-4.3-7-10V6l7-3 7 3v5c0 5.7-7 10-7 10z",
    policyIssue:
      "A.I. poses ethical challenges, particularly around bias, discrimination, and accountability. Jamaica needs to establish a strong ethical foundation for A.I. development and usage, ensuring that A.I. technologies are used responsibly and in ways that promote fairness, transparency, and human rights.",
    objective: "Ensure Jamaica's A.I. activities are grounded in ethical standards.",
    challenges: [
      "Risk of AI-driven bias and discrimination.",
      "Lack of clear ethical guidelines for A.I. development and deployment.",
      "Potential misuse of A.I. technologies in areas such as surveillance and decision-making.",
    ],
    actions: [
      { horizon: "short", text: "Implement the UNESCO Recommendation on the Ethics of A.I." },
      {
        horizon: "short",
        text: "Develop national A.I. ethics guidelines that outline core principles for responsible A.I. use, focusing on fairness, transparency, and accountability.",
      },
      {
        horizon: "medium",
        text: "Establish an independent A.I. governance body to monitor A.I. developments, ensuring that they adhere to ethical guidelines and rules, as well as address any breaches of A.I. ethics.",
      },
      {
        horizon: "long",
        text: "Embed ethical considerations into all A.I. regulatory frameworks, ensuring that A.I. technologies support inclusive and equitable development.",
      },
    ],
  },
  {
    id: 9,
    title: "Cohesive A.I. Framework",
    short: "Cohesive Framework",
    slug: "cohesive-framework",
    icon: "M4 6h7v7H4zM13 4h7v5h-7zM13 13h7v7h-7zM4 15h7v5H4z",
    policyIssue:
      "Jamaica needs a cohesive framework that outlines how A.I. technologies can be adopted, scaled, and regulated across industries and the public sector. This framework should provide guidance on integrating A.I. into public services, businesses, and infrastructure.",
    objective:
      "Clearly outline a comprehensive, accountable path to successfully achieving a cohesive A.I. framework.",
    challenges: [
      "Absence of a clear roadmap for A.I. integration across sectors.",
      "Limited cross-sector collaboration on A.I. adoption.",
      "Lack of standardized protocols for deploying A.I. solutions in public and private sectors.",
      "Lack of standards for data interchange beyond A.I.",
      "Resistance to interoperability.",
    ],
    actions: [
      {
        horizon: "short",
        text: "Draft a cohesive national A.I. framework that identifies priority sectors for A.I. adoption.",
      },
      {
        horizon: "medium",
        text: "Implement pilot A.I. projects in selected sectors to demonstrate the technology's potential and create scalable models.",
      },
      {
        horizon: "long",
        text: "Develop A.I. standards and best practices for widespread adoption, ensuring interoperability and consistent implementation across sectors.",
      },
    ],
  },
];

export const ALL_ACTIONS: Action[] = PILLARS.flatMap((p) =>
  p.actions.map((a, i) => ({
    id: `${p.id}-${a.horizon}-${i}`,
    text: a.text,
    horizon: a.horizon,
    pillarId: p.id,
  }))
);

export const COUNTS = {
  pillars: PILLARS.length,
  actions: ALL_ACTIONS.length,
  short: ALL_ACTIONS.filter((a) => a.horizon === "short").length,
  medium: ALL_ACTIONS.filter((a) => a.horizon === "medium").length,
  long: ALL_ACTIONS.filter((a) => a.horizon === "long").length,
};

export const getPillar = (id: number) => PILLARS.find((p) => p.id === id)!;
