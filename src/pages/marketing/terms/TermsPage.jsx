import LegalDocumentPage from "../legal/LegalDocumentPage.jsx";

const sections = [
  { id: "acceptance", title: "Acceptance and eligibility", content: ["By accessing Global Stripe Fin or creating an account, you agree to these terms and any product-specific terms shown before you submit an instruction. You must provide accurate information, be legally able to enter an agreement, and use the service only for lawful purposes."] },
  { id: "account-security", title: "Account security", content: ["You are responsible for protecting your password, verification codes, security answers, and devices. Notify us promptly if you suspect unauthorized access. We may request additional verification before processing a sensitive request."] },
  { id: "payments-and-conversions", title: "Payments, transfers, and conversions", content: ["You authorize us to act on instructions submitted through your account. A request may be pending, rejected, reversed, delayed, or limited for security, compliance, insufficient funds, incorrect details, or third-party processing reasons. Applicable rates, fees, and estimated recipient amounts should be reviewed before confirmation."] },
  { id: "financial-products", title: "Loans and fixed deposits", content: ["Applications are subject to eligibility and approval. Repayment amounts, interest, maturity estimates, penalties, and early-closure conditions are governed by the final terms presented for the relevant product. Displayed projections do not guarantee approval or returns."] },
  { id: "acceptable-use", title: "Acceptable use", content: ["You must not use the service for fraud, unlawful activity, sanctions evasion, abuse, system interference, impersonation, or transactions involving funds you are not authorized to control. We may restrict or suspend access while investigating suspected misuse."] },
  { id: "availability-and-liability", title: "Availability and liability", content: ["We work to keep the service accurate and available, but maintenance, outages, third-party failures, and events beyond our control may occur. To the extent permitted by law, Global Stripe Fin is not responsible for indirect or consequential losses arising from use of the service."] },
  { id: "changes-and-termination", title: "Changes and termination", content: ["We may update these terms or change, suspend, or discontinue features. You may stop using the service at any time, subject to outstanding obligations. Provisions intended to survive account closure, including payment, liability, and record-keeping provisions, will continue to apply."] },
];

function TermsPage() {
  return <LegalDocumentPage eyebrow="Terms" introduction="These terms describe the basic rules that apply when you access the Global Stripe Fin website, account tools, and financial-service features." sections={sections} title="Terms and conditions" />;
}

export default TermsPage;
