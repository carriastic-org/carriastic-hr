import Text from "./atoms/Text/Text";

type FAQProps = {
  faqs: {
    question: string;
    answer: string;
  }[];
};

export const FAQ = ({ faqs }: FAQProps) => {
  return (
    <div className="space-y-4 text-white">
      {faqs.map((faq, index) => (
        <div key={index}>
          <Text text={`${index + 1}. ${faq.question}`} className="text-[16px] font-semibold" />
          <Text text={faq.answer} className="text-[14px]" />
        </div>
      ))}
    </div>
  );
};
