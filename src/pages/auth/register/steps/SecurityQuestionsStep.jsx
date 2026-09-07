import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";

function SecurityQuestionsStep({ answers, onChange, questions }) {
  return (
    <div className="grid gap-5">
      {answers.map((selectedAnswer, index) => (
        <div className="grid gap-2" key={index}>
          <span className="text-body-medium text-[var(--color-text-primary)]">
            Security question {index + 1}
          </span>
          <Select
            aria-label={`Security question ${index + 1}`}
            onSelectionChange={(key) =>
              onChange(index, "questionId", String(key))
            }
            selectedKey={selectedAnswer.questionId || undefined}
          >
            {questions.map((question) => (
              <SelectItem
                id={question.id}
                isDisabled={
                  question.id !== selectedAnswer.questionId &&
                  answers.some((item) => item.questionId === question.id)
                }
                key={question.id}
              >
                {question.question}
              </SelectItem>
            ))}
          </Select>
          <Input
            aria-label={`Answer to security question ${index + 1}`}
            onChange={(value) => onChange(index, "answer", value)}
            placeholder="Enter your answer"
            required
            value={selectedAnswer.answer}
          />
        </div>
      ))}
    </div>
  );
}

export default SecurityQuestionsStep;
