import { useState } from "react";
import { Button } from "@/components/base/buttons/button.tsx";
import { Input } from "@/components/base/input/input.tsx";

function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    event.currentTarget.reset();
    setSubmitted(true);
  }

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <p className="text-body-medium text-[var(--color-accent-600)]">
            Contact
          </p>
          <h1 className="text-display-4-medium mt-3 text-balance sm:text-display-3-medium">
            How can we help?
          </h1>
          <p className="text-headline-regular mt-4 max-w-xl text-[var(--color-text-secondary)] text-pretty">
            Tell us what you need help with and our team will get back to you as
            soon as possible.
          </p>

          <div className="mt-8 grid gap-6 border-t border-[var(--color-separator-border)] pt-6">
            <div>
              <h2 className="text-headline-medium">Customer support</h2>
              <a
                className="text-body-medium mt-1 inline-block text-[var(--color-text-secondary)] no-underline transition-colors duration-150 hover:text-[var(--color-text-primary)]"
                href="mailto:support@globalstripefin.com"
              >
                support@globalstripefin.com
              </a>
            </div>
            <div>
              <h2 className="text-headline-medium">
                Available around the clock
              </h2>
              <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
                Our customer support team is available 24/7.
              </p>
            </div>
          </div>
        </div>

        <form
          className="rounded-xl border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-5 shadow-xs sm:p-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5">
            <div>
              <h2 className="text-title-3-medium">Send us a message</h2>
              <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
                Fields marked with an asterisk are required.
              </p>
            </div>

            {submitted && (
              <p
                className="text-body-medium text-[var(--color-state-success-text)]"
                role="status"
              >
                Thanks for getting in touch. Your message has been received.
              </p>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                isRequired
                label="First name"
                name="firstName"
                placeholder="Your first name"
              />
              <Input
                isRequired
                label="Last name"
                name="lastName"
                placeholder="Your last name"
              />
            </div>
            <Input
              isRequired
              label="Email address"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
            <Input
              isRequired
              label="Subject"
              name="subject"
              placeholder="How can we help?"
            />
            <div className="grid gap-1">
              <label
                className="text-body-medium text-[var(--color-text-primary)]"
                htmlFor="contact-message"
              >
                Message{" "}
                <span className="text-[var(--color-text-error-primary)]">
                  *
                </span>
              </label>
              <textarea
                className="min-h-32 w-full resize-y rounded-2lg border border-border-button-default bg-transparent p-2.5 text-body-regular text-text-primary outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-text-tertiary hover:border-border-button-hover focus:border-border-focus-ring focus:ring-1 focus:ring-border-focus-ring"
                id="contact-message"
                name="message"
                placeholder="Tell us how we can help."
                required
              />
            </div>
            <Button className="w-full sm:w-auto sm:self-start" type="submit">
              Send message
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ContactPage;
