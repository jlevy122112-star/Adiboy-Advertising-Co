/** Staged-file lint — keeps pre-commit fast; full suite still via CI / manual `npm run lint`. */
export default {
  "packages/**/*.ts": ["eslint --max-warnings 999 --fix"],
};
