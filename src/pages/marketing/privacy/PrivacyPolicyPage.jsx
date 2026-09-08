import LegalDocumentPage from "../legal/LegalDocumentPage.jsx";

const sections = [
  { id: "information-we-collect", title: "Information we collect", content: ["We may collect identity and contact details, account and transaction information, verification documents, communications, linked-bank details, device information, and records needed to provide or secure our services."] },
  { id: "how-we-use-information", title: "How we use information", content: ["We use personal information to create and maintain accounts, verify identity, process requests, prevent fraud, provide customer support, comply with legal obligations, improve our services, and send essential service communications."] },
  { id: "sharing", title: "How information is shared", content: ["We may share information with payment, banking, identity-verification, hosting, communications, analytics, and professional-service providers when necessary to operate the service. We may also disclose information where required by law, to protect customers, or in connection with a business transfer. We do not sell personal information for money."] },
  { id: "retention-and-security", title: "Retention and security", content: ["We retain information for as long as needed to provide services, resolve disputes, prevent abuse, and meet legal or record-keeping duties. We use administrative and technical safeguards, but no internet or storage system can be guaranteed completely secure."] },
  { id: "choices-and-rights", title: "Your choices and rights", content: ["Depending on where you live, you may have rights to access, correct, delete, restrict, or obtain a copy of certain personal information. Some records may need to be retained for legal, security, or financial-compliance purposes."] },
  { id: "international-and-children", title: "International use and children", content: ["Information may be processed in countries other than your own, subject to appropriate safeguards. Our services are not directed to children, and users must meet the minimum legal age required in their location."] },
  { id: "policy-updates", title: "Policy updates", content: ["We may update this policy when our services or legal obligations change. The effective date above identifies the latest version, and material changes may also be communicated through the service."] },
];

function PrivacyPolicyPage() {
  return <LegalDocumentPage eyebrow="Privacy" introduction="This policy explains the personal information Global Stripe Fin may collect, why we use it, and the choices available to you." sections={sections} title="Privacy policy" />;
}

export default PrivacyPolicyPage;
