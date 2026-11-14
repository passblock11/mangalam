export const homeFaqs: [string, string][] = [
  ["Is Mangalam free to join?", "You can create a profile with Google at no charge. Membership and contact-credit packs are optional paid features, charged in Indian rupees through Razorpay."],
  ["What is the difference between a free profile and a membership?", "A free profile lets you join and be discovered. A membership opens the paid features listed on that plan. Contact credits are a separate add-on and can be bought only while a membership is active."],
  ["Who can see my phone number?", "Only a verified member with an active membership, and only if you have allowed your number to be requested."],
  ["Is this the same account as the app?", "Yes. The Google account you use on the phone is the account you use on this website. Your profile, matches, and messages stay together."],
  ["How do I get help with a payment?", "Email the support address in the footer, or open a ticket from your profile after you sign in. Include the time of the charge."],
];

export function FaqList({ items }: { items: [string, string][] }) {
  return (
    <div className="divide-y divide-[#eceff3] border-y border-[#eceff3]">
      {items.map(([question, answer]) => (
        <details key={question} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-medium">
            {question}
            <span className="text-2xl leading-none font-light text-[#98a2b3] group-open:hidden">+</span>
            <span className="hidden text-2xl leading-none font-light text-[#98a2b3] group-open:inline">−</span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{answer}</p>
        </details>
      ))}
    </div>
  );
}
