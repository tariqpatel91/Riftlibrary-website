import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

// The site is plain <script> files that share globals with each other and with
// onclick="..." handlers in index.html, so "unused" functions are usually used.
export default [
  { ignores: ['node_modules/', 'cards.json'] },
  js.configs.recommended,
  {
    files: ['riftlibrary.js', 'riftlibrary-play.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        supabase: 'readonly', // supabase-js CDN bundle
        Peer: 'readonly', // PeerJS CDN bundle
        // Defined in riftlibrary.js, used by riftlibrary-play.js
        CARDS: 'writable',
        cardsLoaded: 'writable',
        fetchAllCards: 'readonly',
        myDecks: 'writable',
      },
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      // riftlibrary.js defines setCFType twice; flagged as a warning so it can be cleaned up separately.
      'no-redeclare': 'warn',
    },
  },
];
