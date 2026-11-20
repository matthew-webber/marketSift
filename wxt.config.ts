import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MarketSift',
    permissions: ['storage'],
    action: { default_title: 'Show MarketSift' },
  },
});
