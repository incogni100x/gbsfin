import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.jsx";

const questions = [
  {
    answer:
      "You can manage supported global currency balances and convert eligible funds to your preferred local payout account. Rates are shown before you confirm a conversion.",
    question: "Which currencies can I send, receive, and convert?",
  },
  {
    answer:
      "Yes. USDT and USDC are supported for eligible transfers and currency-account conversions. Available networks and payment details are shown when you begin a deposit.",
    question: "Can I use USDT and USDC?",
  },
  {
    answer:
      "Choose the balance you want to send from, select a bank account or eligible currency balance, review the current rate and amount received, then confirm your transfer.",
    question: "How do global money transfers work?",
  },
  {
    answer:
      "Global Stripe Fin offers loan and mortgage options, along with fixed deposits. Your available terms, expected returns, and application details are shown before you submit a request.",
    question: "What financing and savings options are available?",
  },
  {
    answer:
      "Our support team is available around the clock. You can contact us through the help area in your account whenever you need assistance.",
    question: "How can I get help?",
  },
];

function MarketingFaq() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6 sm:pb-24"
      id="faq"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          className="text-display-4-medium text-balance sm:text-display-3-medium"
          id="faq-heading"
        >
          Frequently asked questions
        </h2>
        <p className="text-headline-regular mt-4 text-[var(--color-text-secondary)] text-pretty">
          Everything you need to know about global transfers, stablecoins, and
          financial products.
        </p>
      </div>
      <Accordion className="mx-auto mt-10 max-w-2xl" defaultValue={["currencies"]}>
        {questions.map((item) => (
          <AccordionItem key={item.question} value={item.question === "Which currencies can I send, receive, and convert?" ? "currencies" : item.question}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export default MarketingFaq;
