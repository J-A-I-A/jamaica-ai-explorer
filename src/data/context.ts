export type SwotKey = "strengths" | "weaknesses" | "opportunities" | "threats";

export type SwotItem = { title: string; body: string };

export const SWOT: Record<SwotKey, { label: string; items: SwotItem[] }> = {
  strengths: {
    label: "Strengths",
    items: [
      {
        title: "Government Support and Vision 2030 Alignment",
        body: "Jamaica's commitment to digital transformation, as outlined in Vision 2030, provides a strong policy foundation and government support for A.I. initiatives. The creation of the National A.I. Task Force signifies a proactive approach to integrating A.I. into national development strategies.",
      },
      {
        title: "Strategic Geographic Location",
        body: "Jamaica's location as a gateway between North America, Latin America, and the Caribbean positions it well for international partnerships and investment in AI-related ventures, including logistics, e-commerce, and fintech.",
      },
      {
        title: "Growing Tech Ecosystem",
        body: "The expanding tech sector, including initiatives like the Jamaica Technology and Digital Alliance (JTDA) and the Technology Innovation District, provides a strong base for A.I. adoption, with increasing interest in startups and entrepreneurship in A.I. and machine learning.",
      },
      {
        title: "Youthful and Tech-Savvy Population",
        body: "Jamaica has a young, digitally engaged population that is eager to adopt new technologies. With proper training, this demographic can be mobilized to drive A.I. innovation and economic growth.",
      },
      {
        title: "Collaborative Regional Efforts",
        body: "Jamaica's active participation in regional initiatives, such as the UNESCO Caribbean A.I. Policy Roadmap, enhances the country's ability to adopt best practices tailored to the region's specific needs and challenges.",
      },
      {
        title: "Cultural Superpower",
        body: "Jamaica has a global cultural footprint highly disproportionate to its size, population and economic ranking. Culturally rooted A.I. innovations are more likely to be well received in global markets, and new generative A.I. tools have reduced the technological barrier to producing such innovations.",
      },
    ],
  },
  weaknesses: {
    label: "Weaknesses",
    items: [
      {
        title: "Digital Divide and Limited Infrastructure",
        body: "While Jamaica has made strides in improving digital infrastructure, significant gaps remain, particularly in rural areas. Limited access to high-speed internet and digital devices can hinder widespread A.I. adoption and exacerbate existing inequalities.",
      },
      {
        title: "Skills Gap and Workforce Preparedness",
        body: "There is a shortage of specialized A.I. talent and professionals with advanced technical skills in A.I., data science, and machine learning. The current education system needs further alignment to produce a future-ready workforce.",
      },
      {
        title: "Limited Research, Development and Innovation Funding",
        body: "A.I. research and development in Jamaica are constrained by limited public and private funding, limiting the country's ability to innovate and compete with more advanced economies.",
      },
      {
        title: "Regulatory and Ethical Challenges",
        body: "The lack of established legal and ethical frameworks tailored to Jamaica's context could slow down A.I. implementation. Ensuring data privacy and managing A.I. risks require more robust governance structures.",
      },
      {
        title: "Dependency on External Technology Providers",
        body: "Jamaica's A.I. ecosystem is largely dependent on foreign technology and expertise, leading to challenges related to control, customization, and the risks of importing technologies that may not align with local needs.",
      },
    ],
  },
  opportunities: {
    label: "Opportunities",
    items: [
      {
        title: "A.I. for Economic Growth",
        body: "A.I. can drive significant economic growth by transforming key sectors such as agriculture, tourism, healthcare, and finance — leading to increased productivity, innovation, and job creation.",
      },
      {
        title: "Public and Private Sector Collaboration",
        body: "Stronger collaboration between government and industry can produce A.I. solutions that address national challenges, from improving public services to enhancing disaster resilience and smart city initiatives.",
      },
      {
        title: "International Partnerships",
        body: "Leveraging international partnerships and funding can accelerate adoption and innovation. Collaboration with global A.I. leaders and involvement in international policy forums provide access to cutting-edge research and expertise.",
      },
      {
        title: "A.I. for Sustainable Development",
        body: "A.I. offers ways to address pressing social and environmental challenges — improving climate resilience, optimizing resource management, and supporting social services — helping Jamaica achieve its Sustainable Development Goals.",
      },
      {
        title: "Youth and Entrepreneurial Ecosystem",
        body: "Encouraging A.I. entrepreneurship and supporting youth-led innovation can spur local startups and solutions that cater to Jamaican and regional needs, creating new markets and employment.",
      },
    ],
  },
  threats: {
    label: "Threats",
    items: [
      {
        title: "Cybersecurity Risks",
        body: "Integrating A.I. into critical sectors increases vulnerability to cyberattacks and data breaches. Without proper safeguards, A.I. systems could be exploited, leading to economic disruption, compromised data security, and lost trust in digital systems.",
      },
      {
        title: "Ethical and Social Risks",
        body: "Unchecked adoption could exacerbate social inequalities, increase bias in decision-making systems, and erode privacy — particularly in sensitive areas such as law enforcement and public services.",
      },
      {
        title: "Global Competition",
        body: "Jamaica faces stiff competition from more technologically advanced countries investing heavily in A.I. Without accelerated efforts to close the digital and innovation gap, Jamaica risks falling behind.",
      },
      {
        title: "Resistance to Change",
        body: "Cultural resistance to AI-driven change, particularly among traditional industries and populations unfamiliar with digital technologies, could slow adoption and hinder economic progress.",
      },
      {
        title: "Economic Displacement",
        body: "Rapid deployment could displace jobs in sectors involving routine tasks. Without effective transition policies, A.I. could exacerbate unemployment and social instability.",
      },
    ],
  },
};

export const ETHICS: { title: string; body: string }[] = [
  {
    title: "Limitations of A.I. Systems",
    body: "All A.I. systems, as of 2024, are narrowly trained — they may excel in specific tasks but fail in others. Large Language Models can produce “hallucinations,” generating inaccurate or misleading information. Service providers must ensure users understand these limitations and avoid fostering unwarranted trust.",
  },
  {
    title: "Transparency About A.I. Processes",
    body: "A.I. systems are trained on vast datasets that may contain inherent biases. Organizations must be transparent about the processes underlying these systems, clearly label AI-generated content, and inform users of potential risks and limitations.",
  },
  {
    title: "Accountability",
    body: "Human operators must be held accountable for the behaviour and outcomes of A.I. systems. Organizations may delegate tasks to A.I. tools, but cannot delegate responsibility for the ethical and proper execution of those tasks.",
  },
  {
    title: "Capacity Building",
    body: "All citizens must be equipped with digital, media, and information literacy skills to engage with A.I. Fostering critical thinking, creativity, and a questioning mindset helps individuals avoid automation bias and develop informed trust.",
  },
  {
    title: "Data Privacy",
    body: "A.I. systems must adhere to the data privacy principles of the Jamaica Data Protection Act (2020), which emphasizes transparency, consent, and access rights in the handling of personal data.",
  },
  {
    title: "Inclusivity and Accessibility",
    body: "A.I. technologies should be inclusive and accessible to all Jamaicans. Vulnerable and marginalized groups must not be left behind — advancements should bridge digital divides and promote social inclusion.",
  },
];

export const GLOBAL_THEMES: string[] = [
  "Workforce Adaptation",
  "Accountability and Transparency",
  "Data Governance and Privacy",
  "Risk Assessment and Management",
  "Ethical and Human-Centric Considerations",
  "International Cooperation",
  "Research and Development (R&D)",
  "Investment in A.I.",
  "Cybersecurity",
];

export const CHAIR = {
  name: "Christopher Reckord",
  role: "Private Sector Organisation of Jamaica",
  title: "Chairman",
};

export const MEMBERS: { name: string; role: string }[] = [
  { name: "Adrian Dunkley", role: "CEO, StarApple A.I." },
  { name: "Alexander Causwell", role: "Fellow at the Caribbean Policy Research Institute" },
  { name: "Alok Jain, CD", role: "Senior Advisor to the Prime Minister" },
  { name: "Cordel Green", role: "Executive Director, The Broadcasting Commission" },
  {
    name: "Daniel Coore, PhD",
    role: "Professor of Computer Science, Department of Computing, University of the West Indies (Mona)",
  },
  { name: "Danielle Mullings", role: "International Technology, Media and Youth Engagement Consultant" },
  { name: "Dwayne Russell", role: "General Manager, Management Control Systems (MCS)" },
  { name: "Larren Peart", role: "CEO, Bluedot Insights" },
  { name: "Marjorie Straw", role: "International Development Consultant" },
  {
    name: "Ruth Baker-Gardner, PhD",
    role: "Library & Information Studies, University of the West Indies (Mona)",
  },
  {
    name: "Sean Thorpe, PhD",
    role: "Professor and Head of School of Computing & Information Technology, University of Technology, Jamaica",
  },
  { name: "Shullette Cox", role: "President, JAMPRO" },
  { name: "Dr. Taneisha Ingleton", role: "Managing Director, HEART/NSTA Trust" },
  { name: "Trevor Forrest", role: "CEO, 876 Technology Solutions" },
  { name: "Wahkeen Murray", role: "Chief Technical Director, ICT Division, OPM" },
  { name: "Yoni Epstein, CD", role: "Chairman & CEO, ITEL International" },
];

export const REFERENCES: { text: string; href: string }[] = [
  {
    text: "The Data Protection Act 2020. Jamaica Parliament.",
    href: "https://japarliament.gov.jm/attachments/article/339/The%20Data%20Protection%20Act,%202020.pdf",
  },
  {
    text: "Planning Institute of Jamaica (2009). Vision 2030 Jamaica: National Development Plan.",
    href: "https://www.pioj.gov.jm/wp-content/uploads/2019/08/Vision-2030-Jamaica-NDP-Full-No-Cover-web.pdf",
  },
  {
    text: "UNESCO (2021). Caribbean Artificial Intelligence Policy Roadmap.",
    href: "https://ai4caribbean.com/wp-content/uploads/2021/07/Caribbean-Artificial-Intelligence-Policy-Roadmap.pdf",
  },
  {
    text: "UNESCO (2022). Recommendation on the Ethics of Artificial Intelligence.",
    href: "https://unesdoc.unesco.org/ark:/48223/pf0000381137",
  },
];
