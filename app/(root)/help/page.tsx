import { Metadata } from 'next';
import {
  HelpCircle,
  Lightbulb,
  Mail
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Center | Screenage',
  description: 'Support for Screenage users.',
};

export default function HelpPage() {
  const faqs = [
    {
      question: "Is Screenage really free?",
      answer: "Yes! Core features (tracking, alerts, analysis) remain free."
    },
    {
      question: "How do I add stocks to my watchlist?",
      answer: "Use the search bar at the top or in the header to find a company. On the stock's detail page, click the 'Heart' or 'Star' icon to instantly add it to your dashboard."
    },
    {
      question: "Where does the market data come from?",
      answer: "We partner with Finnhub and other providers to offer real-time and delayed data. While robust, please use it for analysis rather than high-frequency trading."
    },
    {
      question: "Can I contribute code or designs?",
      answer: "We welcome feedback from designers, developers, and writers alike. Reach out to our support team to get involved."
    },
    {
      question: "My alerts aren't triggering.",
      answer: "Alerts run every 5 minutes via our background jobs. Ensure you've confirmed your email address, as we send notifications primarily via email."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20">

      {/* Header */}
      <div className="text-center pt-16 pb-12 space-y-4">
        <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-4">
          <HelpCircle className="text-blue-400 h-8 w-8" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white">How can we help?</h1>
        <p className="text-xl text-gray-400">Support for everyone.</p>
      </div>

      {/* FAQs */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">Frequently Asked Questions</h2>
        <div className="grid gap-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:bg-gray-800/50 transition-colors">
              <h3 className="font-semibold text-lg text-gray-200 mb-2 flex items-start gap-3">
                <Lightbulb size={20} className="text-yellow-500/50 mt-1 shrink-0" />
                {faq.question}
              </h3>
              <p className="text-gray-400 leading-relaxed ml-8 pl-1 border-l-2 border-gray-800">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Contact */}
      <div className="mt-20 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Still stuck?</h3>
        <p className="text-gray-400 mb-6">Our team (and community) answers emails, usually entirely for free.</p>
        <a
          href="mailto:opendevsociety@gmail.com"
          className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          <Mail size={18} />
          Contact Support
        </a>
      </div>

    </div>
  );
}
