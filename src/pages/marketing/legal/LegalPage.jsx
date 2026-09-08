import LegalDocumentPage from "./LegalDocumentPage.jsx";

const sections = [
  { id: "service-information", title: "Service information", content: ["Global Stripe Fin provides digital tools for managing accounts, submitting payment requests, converting supported currencies, and applying for financial products. Availability, eligibility, limits, pricing, and processing times may vary by customer, location, payment rail, and product."] },
  { id: "financial-disclosure", title: "Financial disclosure", content: ["Information on this website is general information and is not personal financial, investment, tax, or legal advice. Exchange-rate illustrations may change before a transaction is completed. Loan and fixed-deposit projections are estimates unless confirmed in a final product agreement."] },
  { id: "brand-and-content", title: "Brand and website content", content: ["The Global Stripe Fin name, visual identity, website design, and original content may not be copied, misrepresented, or used to suggest an unauthorized relationship with us. Third-party names and marks remain the property of their respective owners."] },
  { id: "important-notice", title: "Important notice", content: ["No statement on this website should be understood as a guarantee of approval, returns, uninterrupted service, or the future value of any currency or asset. Customers should review the terms presented before confirming a financial instruction."] },
];

function LegalPage() {
  return <LegalDocumentPage eyebrow="Legal" introduction="This page provides important general disclosures about Global Stripe Fin and the information presented across our website and services." sections={sections} title="Legal information" />;
}

export default LegalPage;
