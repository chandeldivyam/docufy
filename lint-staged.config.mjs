export default {
  '*.{js,jsx,ts,tsx}': ['eslint --fix --max-warnings=0 --no-warn-ignored'],
  '*.{json,md,mdx,css,html,yml,yaml}': ['prettier --write'],
};
