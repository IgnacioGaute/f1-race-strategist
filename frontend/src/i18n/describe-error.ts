import { ApiError } from "@/lib/api";
import { lookup, type Messages } from "./messages";

export interface DescribedError {
  message: string;
  details: string[];
}

/**
 * Translates an error by its code at render time, so switching language also
 * translates errors already on screen. Unknown codes fall back to the backend's
 * own (Spanish) text rather than hiding what happened.
 */
export function describeError(error: unknown, t: Messages): DescribedError {
  if (!(error instanceof ApiError)) {
    return { message: t.errors.UNKNOWN(), details: [] };
  }
  const { params, problems = [], serverMessage } = error.options;
  const translate = lookup(t.errors, error.code);
  return {
    message: translate ? translate(params) : (serverMessage ?? t.errors.UNKNOWN()),
    details: problems.map((problem) => {
      const translateProblem = lookup(t.problems, problem.code);
      return translateProblem ? translateProblem(problem.params) : problem.message;
    }),
  };
}
